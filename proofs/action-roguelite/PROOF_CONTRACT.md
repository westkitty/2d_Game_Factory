# Proof Contract — action-roguelite

Frozen before implementation. Category-C Wave 17 (existing `sw2d.progression`, ADR-0044) - the relic run consumer, over `sw2d.generation`.

## Preset

`action-roguelite` (`packages/presets/src/catalog/topDownAction.ts`) — controller family `top-down`, required packs `sw2d.combat`, **`sw2d.progression`**, `sw2d.generation`. Content roles tuning, levels.

Generated via `npm run sw2d -- new proof-action-roguelite --preset action-roguelite` (the canonical factory, unmodified - the Category-C shells consume the capability directly, so no `src/game-specific/` customization was needed).

## Reusable capability exercised

- `sw2d.progression` (`PROGRESSION_STARTER 'run'`): walk to two relics, PRIMARY takes one (item + currency), the second clears the run (XP, `run-cleared` unlock). `sw2d.generation` provides the room graph underneath.

## Terminal success/failure oracle

- **Success surface:** taking with no relic in reach is `too-far`; the core relic is `taken` (item, currency 1, still `playing`); taking it again does not double-credit; the spark relic clears the run (currency 2, xp 10, `run-cleared`, `complete`); restart reinstalls (no items, start x).
- **Failure surface:** `progression.{xp,currency,items,unlocked,nearId,lastResult,outcome}`, player `x`.

## Defining journey (automated, real-browser, deterministic frame stepping)

1. Start; `sw2d.progression` + `sw2d.generation` installed; mode `run`; no items; x 120.
2. PRIMARY -> `too-far`.
3. Hold Right until `nearId 'core'`; PRIMARY -> `taken`, items [core], currency 1; PRIMARY -> unchanged.
4. Hold Right until `nearId 'spark'`; PRIMARY -> `cleared`, currency 2, xp 10, `run-cleared`, `complete`.
5. Restart: no items, currency 0, `playing`, x 120.

## Acceptance

- Permadeath / meta-progression between runs is not a reusable system (catalog limitation).
- Zero console errors, zero external requests.
