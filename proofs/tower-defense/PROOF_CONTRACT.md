# Proof Contract — tower-defense

Frozen before implementation.

## Preset

`tower-defense` (`packages/presets/src/catalog/strategyDefense.ts`) — controller families `grid` + `pointer`, required packs `sw2d.world`, `sw2d.world-entities`, `sw2d.progression`, `sw2d.combat`, optional `sw2d.ai`. Content roles `tuning`, `levels`. Currently `smoke-validated`. Known limitations (still true, still deferred): spatial placement/hover targeting not implemented; no reusable pathfinding/route/targeting/upgrade system exists yet — all of that stays bounded game-specific code here, same as the Phase 8 demo.

Generated via `npm run sw2d -- new proof-tower-defense --preset tower-defense`, moved into this committed `proofs/tower-defense/` tree.

## Reusable capabilities exercised

- `gridController.read()` — keyboard cursor movement (`step`) and `confirmPressed` for placement. Spatial pointer stays deferred; placement is exclusively through this keyboard-driven grid cursor, the same accepted path the smoke-validated demo already uses.
- `sw2d.progression` (`ProgressionService`) — `currency()`/`addCurrency()` for tower cost and upgrade cost.
- `sw2d.combat` (`CombatService`) — every enemy registered with finite health; projectile damage drives real kills.
- `@sw2d/runtime`'s shared `ProjectilePool` — tower fire uses it exactly as Proof A/B do; no proof-local projectile code.
- `sw2d.world` / `sw2d.world-entities` are required by this preset and are installed via `content/game.json` exactly as the smoke-validated demo already does; this proof does not force an artificial use of their capabilities where the demo's own approved precedent (Gate B passed) did not need one either — the route and placement cells stay hand-authored code, per the demo's own documented reasoning (no "Route"/"Waypoint" Tiled class exists in the 19-class catalog; ADR-0014).
- `content/tuning.json` is validated as part of every generated game's content bundle; this preset's shell has no tunable numeric field the schema covers (route/economy numbers are the genre's own game-specific balance, same as the demo), so no new reads are added beyond what the generator already validates.

## Game-specific mechanics (`src/game-specific/shellPack.ts`)

- Fixed enemy route (hand-authored waypoint array), two sequential enemy spawns.
- Tower placement via the grid cursor: `CONFIRM` off a placement cell is rejected (no currency spent); `CONFIRM` on a placement cell with sufficient currency places a tower and deducts cost.
- Real target selection: the tower fires at the closest in-range, not-yet-defeated enemy, recomputed every eligible tick (matches the demo's proven logic).
- **New for this proof:** tower upgrade. `SECONDARY_ACTION` while the grid cursor sits on the tower's own cell attempts an upgrade: rejected (no currency spent, no stat change) if the tower isn't placed yet, is already upgraded, or currency is insufficient; otherwise currency is deducted and the tower's projectile damage measurably increases (10 → 20), provable by the second enemy dying in one hit instead of two.
- Win/fail state: `victory` if every spawned enemy is defeated with zero breaches; `defeat` if any enemy reaches the route's end or lives reach 0.

## Content roles used

- `tuning` — generator-default `content/tuning.json`, validated, unchanged (no top-down/platform movement in this controller family to tune).
- `levels` — generator-default `content/levels/main.json` (a `PlayerSpawn` object only, same as the generated placeholder); the route and placement cells are hand-authored pixel/cell coordinates in code, matching the demo's justified precedent.

## Terminal success/failure oracle

- **Success:** debug snapshot from `game.grid-shell` reports `outcome === 'victory'`.
- **Failure surface (all observable):** `cursor` (`{col,row}`), `currency`, `towerPlaced`, `towerUpgraded`, `towerDamage`, `placementRejections`, `upgradeRejections`, `spawnedTotal`, `defeatedTotal`, `breachedTotal`, `lives`, `outcome`.

## Defining journey (automated, real-browser, deterministic frame stepping)

1. Start with known currency (`currency === 100` at spawn, matching the demo's starting balance).
2. Move the placement cursor (grid steps).
3. Invalid placement (`CONFIRM` off a placement cell) → rejected, `placementRejections` increments, currency unchanged, no tower.
4. Valid placement (`CONFIRM` on a placement cell) → currency decreases by exactly the tower cost, `towerPlaced === true`.
5. Start/advance the wave — enemies spawn and follow the fixed route automatically.
6. The tower acquires a legal target and damages it (first enemy takes two hits at base damage before dying).
7. Upgrade the tower (`SECONDARY_ACTION` on the tower's cell) → currency decreases by the upgrade cost, `towerUpgraded === true`, `towerDamage` increases from 10 to 20.
8. The second enemy dies in a single hit at the upgraded damage — the measurable stat change from step 7 is what wins the run, not merely asserted in isolation.
9. Reach `outcome === 'victory'` with `breachedTotal === 0`.

## Acceptance

- Invalid placement is rejected (no spend, no tower).
- Route is deterministic (fixed waypoints, fixed spawn timings).
- Target selection is real (closest-in-range recomputed live, not hard-coded to one enemy id).
- Currency is correct at every step (placement cost, then upgrade cost, both exact).
- Upgrade is real: it changes a measurable tower stat (`towerDamage`) that the win condition actually depends on.
- Terminal result (`victory`) is reachable by the automated journey.
- No spatial-pointer claim — placement and upgrade both go through the keyboard grid cursor only.
