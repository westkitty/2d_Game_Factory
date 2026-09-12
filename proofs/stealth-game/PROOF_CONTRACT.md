# Proof Contract — stealth-game

Frozen before implementation. Category-C Wave 4 (`sw2d.perception`, ADR-0031) - the infiltrate consumer. Supersedes the Phase 8 demo's smoke-level evidence.

## Preset

`stealth-game` (`packages/presets/src/catalog/topDownAction.ts`) — controller family `top-down`, required packs `sw2d.ai`, `sw2d.combat`, `sw2d.world`, **`sw2d.perception`** (mode `infiltrate`). Content roles tuning, levels.

Generated via `npm run sw2d -- new proof-stealth-game --preset stealth-game` (the canonical factory, unmodified - the Category-C shells consume the capability directly, so no `src/game-specific/` customization was needed).

## Reusable capability exercised

- `sw2d.perception` (`ai.perception`) from `content/perception.json`: a guard vision cone, suspicion, seen/alarm state, a loot objective and an exit. `bindStarterPerception` (shared top-down shell).

## Terminal success/failure oracle

- **Success surface:** walking into the cone is `seen` and `failed`; after restart, sneaking above the cone collects the loot unseen (`alarm false`) and reaching the exit is `complete` with no alarm.
- **Failure surface:** `perception.{seen,alarm,suspicion,objectiveCollected,outcome,lastResult}`, player `x`/`y`.

## Defining journey (automated, real-browser, deterministic frame stepping)

1. Start; `sw2d.perception` installed; mode `infiltrate`; not seen.
2. Hold Right into the cone -> `seen`, `failed`, suspicion > 0.
3. Restart: `runIndex` +1, `playing`, not seen, objective not collected.
4. Up to y <= 120; Right until `objectiveCollected` with `alarm false`.
5. Up to y <= 100; Left until `complete`, `alarm false`.

## Acceptance

- Vision cones / suspicion / hiding are the reusable service; patrol pathfinding and takedowns are not (catalog limitation).
- Zero console errors, zero external requests.
