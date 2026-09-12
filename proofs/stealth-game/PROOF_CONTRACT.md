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

Final Product Completion Wave 2 (matrix L09): the guard patrols a route and runs the reusable observer state machine (`content/perception.json`).

1. Start; `sw2d.perception` installed; mode `infiltrate`; not seen; guard `patrol`, `patrolling true`.
2. Wait -> the guard has walked east (x > 560) facing 0.
3. Hold Right to x >= 330 and stand -> guard `chase`, `seen`; wait -> `failed`, `caught`.
4. Restart: `playing`, guard `patrol`, `transitions 0`. Right to x >= 330 until `chase`; hold Left to x <= 70 -> guard `investigate`, then `return` / `patrol`, `alarm false`, at least four transitions, still `playing`.
5. Wait until the guard walks east again (facing 0, x > 540); hold Right until 30 px behind it; PRIMARY (J) -> guard `downed`, `takedowns 1`, `takedown`.
6. Up to y <= 150; Right until `objectiveCollected`; Up to y <= 100; Left until `complete`, `escaped`.

## Acceptance

- Patrol routes, chase / catch, investigation, return-to-patrol, noise reaction and takedowns are the reusable `sw2d.perception` stealth AI - no catalog limitation remains.
- Zero console errors, zero external requests.
