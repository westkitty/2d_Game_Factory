# Proof Contract — museum-exhibit

Frozen before implementation. Category-C Wave 26 + Wave 30 (look plaques + `sw2d.codex` exhibit, ADR-0053 / ADR-0057).

## Preset

`museum-exhibit` (`packages/presets/src/catalog/narrativeExploration.ts`) — controller family `top-down (+ pointer)`, required packs `sw2d.world`, `sw2d.world-entities`, **`sw2d.codex`** (mode `exhibit`). Content roles tuning, levels.

Generated via `npm run sw2d -- new proof-museum-exhibit --preset museum-exhibit` (the canonical factory, unmodified - the Category-C shells consume the capability directly, so no `src/game-specific/` customization was needed).

## Reusable capability exercised

- `bindStarterLook` (`LOOK_STARTER 'museum'`): walk to plaques, PRIMARY reads the one in reach; `sw2d.codex` (`narrative.codex`, exhibit mode) records each inspected exhibit once.

## Terminal success/failure oracle

- **Success surface:** reading with no plaque in reach is `too-far`; the plinth is inspected once (`inspected-plinth`; a second read does not add an entry); the bust completes the exhibit (`inspected 2`, `read`, `complete`); restart reinstalls (`inspected 0`, start x).
- **Failure surface:** `look.{inspected,nearId,lastResult,outcome}`, player `x`.

## Defining journey (automated, real-browser, deterministic frame stepping)

1. Start; `sw2d.codex` installed; mode `museum`; `inspected 0`.
2. PRIMARY -> `too-far`.
3. Hold Right until `nearId 'plinth'`; PRIMARY -> `inspected 1`, `inspected-plinth`; PRIMARY -> still 1.
4. Hold Right until `nearId 'bust'`; PRIMARY -> `inspected 2`, `read`, `complete`.
5. Restart: `inspected 0`, `playing`, x back to start.

## Acceptance

- Zero console errors, zero external requests.
