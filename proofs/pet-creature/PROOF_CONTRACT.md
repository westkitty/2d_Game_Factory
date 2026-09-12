# Proof Contract — pet-creature

Frozen before implementation. Category-C Wave 2 (`sw2d.needs`, ADR-0029) - the hold-then-complete creature consumer.

## Preset

`pet-creature` (`packages/presets/src/catalog/simulationManagement.ts`) — controller family `ui-simulation`, required packs `sw2d.simulation`, `sw2d.progression`, **`sw2d.needs`** (mode `creature`). Content roles tuning.

Generated via `npm run sw2d -- new proof-pet-creature --preset pet-creature` (the canonical factory, unmodified - the Category-C shells consume the capability directly, so no `src/game-specific/` customization was needed).

## Reusable capability exercised

- `sw2d.needs` (`simulation.needs`) from `content/needs.json`: two decaying meters (hunger, mood), two care actions (PRIMARY feeds, SECONDARY plays), affinity, a 1600 ms wellbeing hold before `complete`.
- `bindStarterNeeds` (shared ui-simulation shell). No private decay loop.

## Terminal success/failure oracle

- **Success surface:** hunger decays on the simulation clock; feeding raises it and spam-feeding clamps at 100; playing raises mood; both above threshold for the hold window -> `outcome 'complete'` with `holdMs >= 1600` and positive affinity; pause/resume keeps the outcome; restart reinstalls (`playing`, `actionsTaken 0`, `affinity 0`).
- **Failure surface:** `needs.{needValues,actionsTaken,holdMs,outcome,lastResult,affinity}`.

## Defining journey (automated, real-browser, deterministic frame stepping)

1. Start; `sw2d.needs` installed; mode `creature`; `outcome 'playing'`.
2. 30 frames idle -> hunger lower than at start.
3. PRIMARY -> hunger up, `actionsTaken 1`; PRIMARY ×12 -> hunger <= 100.
4. SECONDARY -> mood up, `actionsTaken >= 2`; wait -> `complete`, `holdMs >= 1600`, `affinity > 0`.
5. Pause/resume: still `complete`. Restart: `playing`, `actionsTaken 0`, `affinity 0`.

## Acceptance

- Needs, decay, care, affinity and hold/fail are the reusable service; creature behaviour AI is not (catalog limitation).
- Zero console errors, zero external requests.
