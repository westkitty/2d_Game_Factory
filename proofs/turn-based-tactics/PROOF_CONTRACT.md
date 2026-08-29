# Proof Contract — turn-based-tactics

Frozen before implementation. Phase 5 of the capability-completion program (navigation & pathfinding, ADR-0022).

## Preset

`turn-based-tactics` (`packages/presets/src/catalog/strategyDefense.ts`) — controller families `grid` + `ui-simulation`, required packs `sw2d.strategy`, `sw2d.combat`, **`sw2d.navigation`**. Content roles `tuning`, `levels`.

Generated via `npm run sw2d -- new proof-turn-based-tactics --preset turn-based-tactics`; the preset requires `sw2d.navigation`, so the generated game installs the pack. Customized only in `src/game-specific/shellPack.ts`.

## Reusable capability exercised

- `sw2d.navigation` (`NavService` / `NavGrid`) — `defineGrid` a 10×8 battlefield with four wall cells; `NavGrid.reachable(unitCell, budget)` returns the deterministic movement range; `NavGrid.findPath` (via `RouteFollower`) returns the route to a chosen cell.
- `createRouteFollower` + `advanceAlongPath` (`@sw2d/contracts`) — the unit walks the returned route; no hand-rolled BFS or route stepping in the shell.

## Terminal success/failure oracle

- **Success surface:** `reachableCount` is deterministic (equal across reads); confirming a cell **inside** the reachable set moves the unit there along the grid's route (`lastPathCost === 2`, `lastPathLen === 3`); confirming a cell **outside** the budget does nothing (`confirmsRejected` increments).
- **Failure surface:** `unitCol/Row`, `cursorCol/Row`, `reachableCount`, `cursorReachable`, `moving`, `lastPathCost`, `lastPathLen`, `arrivedAt`, `confirmsRejected`.

## Defining journey (automated, real-browser, deterministic frame stepping)

1. Start (`Space`); `sw2d.navigation` installed; unit at `(2,4)`; `reachableCount === 28` and identical across two reads (deterministic).
2. Move the cursor up twice to `(2,2)` — inside the reachable set (`cursorReachable === true`).
3. `CONFIRM`: the unit follows the returned route; after arrival `unit === (2,2)`, `moving === false`, `lastPathCost === 2`, `lastPathLen === 3`, `arrivedAt === (2,2)`.
4. Move the cursor five cells right (around the wall, `(7,2)`) — outside the movement budget (`cursorReachable === false`). `CONFIRM`: the unit does not move; `confirmsRejected > 0`.
5. Restart (pause, then `SECONDARY_ACTION`): unit back at `(2,4)`, `confirmsRejected === 0`.

## Acceptance

- Selectable unit receives a deterministic reachable-cell set from the reusable service.
- Movement follows the returned route; an out-of-budget cell is rejected.
- Restart genuinely reinstalls.
- Zero console errors, zero external requests.
