# Proof Contract — turn-based-tactics

Frozen before implementation. Phase 5 of the capability-completion program (navigation & pathfinding, ADR-0022).

**Extended in post-ten Phase 14** (strategy orders & tactical actions). The five Phase 5 steps below
are unchanged and still asserted; ten further named steps prove `sw2d.strategy-actions` is not
RTS-only. Nothing in the Phase 5 half was relaxed to make the Phase 14 half pass.

## Preset

`turn-based-tactics` (`packages/presets/src/catalog/strategyDefense.ts`) — controller families `grid` + `ui-simulation`, required packs `sw2d.strategy`, `sw2d.combat`, **`sw2d.navigation`**, **`sw2d.strategy-actions`**. Content roles `tuning`, `levels`.

Generated via `npm run sw2d -- new proof-turn-based-tactics --preset turn-based-tactics`; the preset requires `sw2d.navigation`, so the generated game installs the pack. Customized only in `src/game-specific/shellPack.ts`.

## Reusable capability exercised

- `sw2d.navigation` (`NavService` / `NavGrid`) — `defineGrid` a 10×8 battlefield with four wall cells; `NavGrid.reachable(unitCell, budget)` returns the deterministic movement range; `NavGrid.findPath` (via `RouteFollower`) returns the route to a chosen cell.
- `createRouteFollower` + `advanceAlongPath` (`@sw2d/contracts`) — the unit walks the returned route; no hand-rolled BFS or route stepping in the shell.

## Reusable capability exercised — Phase 14

- `sw2d.strategy-actions` → `strategy.tactics`, reading the validated `content/strategy-actions.json`
  (`urn:sw2d:schema:content-strategy-actions:v1`): `range`, `minRange`, action-point `cost`,
  `usesPerTurn`, tick-based `cooldownTicks`, `targetFilter` (`enemy`), and the `TacticalValidity`
  verdict a targeting UI would render.
- `sw2d.strategy-actions` → `strategy.orders`: every action raises a real order, and the order's
  `completed` / `failed` verdict (with the adapter's `unreachable` reason) is what the proof reads.
- `sw2d.strategy` (`strategy.turns`): team rotation on end-of-turn, which drives the tactical refresh.
- The shell contributes only the `OrderWorldAdapter`; move orders inside it reuse the same Phase 5
  `RouteFollower`, not a second path stepper.

## Terminal success/failure oracle

- **Success surface:** `reachableCount` is deterministic (equal across reads); confirming a cell **inside** the reachable set moves the unit there along the grid's route (`lastPathCost === 2`, `lastPathLen === 3`); confirming a cell **outside** the budget does nothing (`confirmsRejected` increments).
- **Failure surface:** `unitCol/Row`, `cursorCol/Row`, `reachableCount`, `cursorReachable`, `moving`, `lastPathCost`, `lastPathLen`, `arrivedAt`, `confirmsRejected`.

## Defining journey (automated, real-browser, deterministic frame stepping)

1. Start (`Space`); `sw2d.navigation` installed; unit at `(2,4)`; `reachableCount === 28` and identical across two reads (deterministic).
2. Move the cursor up twice to `(2,2)` — inside the reachable set (`cursorReachable === true`).
3. `CONFIRM`: the unit follows the returned route; after arrival `unit === (2,2)`, `moving === false`, `lastPathCost === 2`, `lastPathLen === 3`, `arrivedAt === (2,2)`.
4. Move the cursor five cells right (around the wall, `(7,2)`) — outside the movement budget (`cursorReachable === false`). `CONFIRM`: the unit does not move; `confirmsRejected > 0`.
5. Restart (pause, then `SECONDARY_ACTION`): unit back at `(2,4)`, `confirmsRejected === 0`.

## Defining journey — Phase 14 additions (same run, after the restart step)

6. `tacticsBootOk` — 2 action points from the document's `actionPointsPerTurn`, turn 1, active team
   `blue`, all three units at full health, and all four catalog actions available.
7. `rangeOk` — `strike` (range 90) is valid at 60 units and `out-of-range` at 360; `snipe`
   (range 400, minRange 120) is `too-close` at 60 and valid at 360; a position target for an
   entity-targeted action is `invalid-target`.
8. `executeOk` — `strike` spends 1 point, raises an `attack` order carrying `abilityId: 'strike'`,
   and the foe drops to 70 hp when the order runs; the order reports `completed`.
9. `costOk` — with 1 point left the 2-point `snipe` is refused `insufficient-points`, nothing is
   spent, the far foe is untouched, and `snipe` disappears from `available()`.
10. `turnOk` — ending the turn rotates `strategy.turns` to `red`, restores points to 2, and makes
    `snipe` available again.
11. `cooldownOk` — `snipe` fires, sets a tick-measured cooldown, and a second attempt inside the
    window is refused `on-cooldown`.
12. `usesOk` — `brace` (usesPerTurn 1) succeeds once, then is refused `no-uses-remaining`.
13. `moveActionOk` — `reposition` to a cell outside its 130-unit range is refused `out-of-range`; to
    an in-range cell it completes and the unit really relocates.
14. `failurePathOk` — `reposition` into the wall cell one step away is *legal by range* (all the
    tactics service knows) and fails as an order with the adapter's `unreachable`; the unit stays put.
15. `targetValidationOk` — a slain foe is `target-lost` (execution spends nothing), and an ally
    target for an `enemy`-filtered action is `invalid-target`.

## Acceptance

- Selectable unit receives a deterministic reachable-cell set from the reusable service.
- Movement follows the returned route; an out-of-budget cell is rejected.
- Restart genuinely reinstalls.
- Every named Phase 14 step tests an observable property; none is an unconditional `true`.
- Zero console errors, zero external requests.

## Negative-control verification (Phase 14 half)

Each sabotage of `packages/packs/src/strategyActions/strategyActionsPack.ts` was applied, observed to
fail the expected step, and reverted:

| Sabotage | Result |
| --- | --- |
| the adapter's failure reason is discarded in `#settle` | step 14 (`failurePathOk`) FAIL |
| a successful `execute` never records the cooldown | step 11 (`cooldownOk`) FAIL |
