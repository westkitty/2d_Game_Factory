# Proof Contract — farming-lite

Frozen before implementation. Category-C Wave 13 (existing `sw2d.simulation`, ADR-0040) - the plot/crop presentation.

## Preset

`farming-lite` (`packages/presets/src/catalog/simulationManagement.ts`) — controller family `ui-simulation`, required packs **`sw2d.simulation`**, `sw2d.world`. Content roles tuning.

Generated via `npm run sw2d -- new proof-farming-lite --preset farming-lite` (the canonical factory, unmodified - the Category-C shells consume the capability directly, so no `src/game-specific/` customization was needed).

## Reusable capability exercised

- `sw2d.simulation` (resource ledger + job queue): planting a plot enqueues a real timed job; the plot is `ripe` when the job completes; harvesting credits the ledger. `SIMULATION_STARTER = 'farm'` (generator stamp), `bindStarterSimulation`.

## Terminal success/failure oracle

- **Success surface:** planting sets the plot `growing` and a job exists; harvesting while growing is refused; the plot ripens on the clock and harvests (`crops 1`); three harvests complete the quota; restart reinstalls (`crops 0`, all plots `empty`).
- **Failure surface:** `simulation.{crops,plots[].phase,jobCount,lastResult,outcome}`.

## Defining journey (automated, real-browser, deterministic frame stepping)

1. Start; `sw2d.simulation` installed; mode `farm`; `crops 0`; plot 0 `empty`.
2. CONFIRM -> `planted`, plot 0 `growing`, `jobCount >= 1`; CONFIRM again -> `crops 0` (still growing).
3. Wait for `ripe`; CONFIRM -> `crops 1`, `harvested`.
4. Plots 1 and 2 the same -> `crops 3`, `complete`.
5. Restart: `crops 0`, every plot `empty`, `playing`.

## Acceptance

- Crop/season/plot framework beyond this presentation stays out (catalog limitation).
- Zero console errors, zero external requests.
