# Proof Contract — lane-defense

Frozen before implementation. Phase 5 of the capability-completion program (navigation & pathfinding, ADR-0022). The route-following + dynamic-re-path consumer (the `tower-defense` requirement's intent).

## Preset

`lane-defense` (`packages/presets/src/catalog/strategyDefense.ts`) — controller families `grid` + `pointer`, required packs `sw2d.world`, `sw2d.world-entities`, `sw2d.progression`, **`sw2d.navigation`**. Content roles `tuning`, `levels`.

Generated via `npm run sw2d -- new proof-lane-defense --preset lane-defense`. Customized only in `src/game-specific/shellPack.ts`.

## Reusable capability exercised

- `sw2d.navigation` — a 12×3 grid; three enemies each hold a `RouteFollower` targeting the base cell `(11,1)`. Placing a blocker calls `NavGrid.setWalkable(cell, false)` and re-requests every living enemy's destination; a placement that leaves any enemy with `NavGrid.findPath === null` is rolled back and rejected.
- `createRouteFollower` / `advanceAlongPath` — continuous route stepping; no hand-rolled pathfinding.

## Terminal success/failure oracle

- **Success surface:** after a mid-lane blocker, all three enemies re-path (`enemiesRepathed >= 3`, `blockRejected === 0`); a placement that would fully wall the column is rejected (`blockRejected >= 1`, `blockersPlaced` unchanged); every enemy still reaches the base (`reachedBase === 3`).
- **Failure surface:** `enemiesActive`, `enemiesRepathed`, `blockersPlaced`, `blockRejected`, `reachedBase`, `enemyCols`.

## Defining journey (automated, real-browser, deterministic frame stepping)

1. Start (`Space`); `sw2d.navigation` installed; `enemiesActive === 3`; `reachedBase === 0`.
2. Step; every enemy's column advances (routes are being followed).
3. `CONFIRM` (cursor at `(4,1)`): one blocker placed; all three enemies re-path (`enemiesRepathed >= 1`); nothing rejected.
4. Move the cursor to wall the rest of column 4 and `CONFIRM` again; the placement that would strand an enemy is **rejected** (`blockRejected >= 1`, `blockersPlaced === 2`).
5. Run on: `reachedBase === 3`, `enemiesActive === 0` — a dynamic block never permanently invalidated the lane.
6. Restart (pause, then `SECONDARY_ACTION`): `enemiesActive === 3`, counters back to 0.

## Acceptance

- Enemies follow authored routes from the reusable navigation grid.
- A placed blocker forces a re-path; a route-destroying placement is rejected.
- Restart genuinely reinstalls.
- Zero console errors, zero external requests.
