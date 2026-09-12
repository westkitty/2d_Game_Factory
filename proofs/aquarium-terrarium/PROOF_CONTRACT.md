# Proof Contract — aquarium-terrarium

Frozen before implementation. Category-C Wave 2 (`sw2d.needs`, ADR-0029) - the long-hold habitat consumer with a fail floor.

## Preset

`aquarium-terrarium` (`packages/presets/src/catalog/simulationManagement.ts`) — controller family `ui-simulation`, required packs `sw2d.simulation`, **`sw2d.needs`** (mode `habitat`). Content roles tuning.

Generated via `npm run sw2d -- new proof-aquarium-terrarium --preset aquarium-terrarium` (the canonical factory, unmodified - the Category-C shells consume the capability directly, so no `src/game-specific/` customization was needed).

## Reusable capability exercised

- `sw2d.needs` (`simulation.needs`) from `content/needs.json`: water and food meters, PRIMARY feeds, SECONDARY refreshes water, `completeAt 55`, `holdMs 7000`, `failBelow 10`. Materially different from `pet-creature` (short hold) and `virtual-pet` (threshold only).

## Terminal success/failure oracle

- **Success surface:** both care actions raise their own meter (`actionsTaken 2`); the habitat is still `playing` 2 s into the hold and `complete` only after `holdMs >= 7000`; restart reinstalls (`playing`, `actionsTaken 0`, hold clock reset).
- **Failure surface:** `needs.{needValues,actionsTaken,holdMs,outcome}`.

## Defining journey (automated, real-browser, deterministic frame stepping)

1. Start; mode `habitat`.
2. PRIMARY -> food up; SECONDARY -> water up; `actionsTaken 2`.
3. Wait until `holdMs >= 2000` -> still `playing`.
4. Wait -> `complete`, `holdMs >= 7000`.
5. Restart: `playing`, `actionsTaken 0`, `holdMs < 1000` (fresh meters start above the floor, so the hold clock is already running).

## Acceptance

- The 7 s hold is real simulation time on the deterministic clock.
- Zero console errors, zero external requests.
