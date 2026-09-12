# Proof Contract — virtual-pet

Frozen before implementation. Category-C Wave 2 (`sw2d.needs`, ADR-0029) - the complete-on-threshold companion consumer.

## Preset

`virtual-pet` (`packages/presets/src/catalog/partyToyWeird.ts`) — controller family `ui-simulation`, required packs `sw2d.simulation`, `sw2d.progression`, **`sw2d.needs`** (mode `companion`). Content roles tuning.

Generated via `npm run sw2d -- new proof-virtual-pet --preset virtual-pet` (the canonical factory, unmodified - the Category-C shells consume the capability directly, so no `src/game-specific/` customization was needed).

## Reusable capability exercised

- `sw2d.needs` (`simulation.needs`) from `content/needs.json`: hunger and happiness, PRIMARY feeds, SECONDARY plays, `complete` when both meters >= 85 after two acts, no hold, no fail floor.

## Terminal success/failure oracle

- **Success surface:** one act alone is still `playing`; the second act completes; acting after completion is inert; restart reinstalls.
- **Failure surface:** `needs.{needValues,actionsTaken,outcome}`.

## Defining journey (automated, real-browser, deterministic frame stepping)

1. Start; mode `companion`.
2. PRIMARY -> hunger up, `actionsTaken 1`, `playing`.
3. SECONDARY -> happiness up, `actionsTaken 2`, `complete`.
4. PRIMARY again -> `actionsTaken` still 2.
5. Restart: `playing`, `actionsTaken 0`.

## Acceptance

- Zero console errors, zero external requests.
