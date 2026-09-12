# Proof Contract — colony-lite

Frozen before implementation. Category-C Wave 13 (existing `sw2d.simulation`, ADR-0040) - the worker/job presentation.

## Preset

`colony-lite` (`packages/presets/src/catalog/simulationManagement.ts`) — controller family `ui-simulation`, required packs **`sw2d.simulation`**, `sw2d.world`. Content roles tuning.

Generated via `npm run sw2d -- new proof-colony-lite --preset colony-lite` (the canonical factory, unmodified - the Category-C shells consume the capability directly, so no `src/game-specific/` customization was needed).

## Reusable capability exercised

- `sw2d.simulation` (resource ledger + job queue): assigning a worker runs a timed gather job that credits materials; construction is a job gated on materials. `SIMULATION_STARTER = 'colony'`.

## Terminal success/failure oracle

- **Success surface:** building with no materials is refused (`need-materials`); assigning a worker makes it busy for real time and a second assignment while busy is refused; the gather credits one material; two materials allow construction, which completes into `built` / `complete`; restart reinstalls.
- **Failure surface:** `simulation.{materials,workers[].busy,constructing,built,lastResult,outcome}`.

## Defining journey (automated, real-browser, deterministic frame stepping)

1. Start; mode `colony`; `materials 0`; `built false`.
2. Select build; CONFIRM -> `need-materials`.
3. Select worker 0; CONFIRM -> `assigned`, busy; CONFIRM -> still busy, `materials 0`; wait -> `materials 1`, idle.
4. Worker 1 gathers -> `materials 2`; build -> `constructing`, `building`; wait -> `built true`, `complete`.
5. Restart: `materials 0`, `built false`, `playing`.

## Acceptance

- Colony assignment AI stays out (catalog limitation).
- Zero console errors, zero external requests.
