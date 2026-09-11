# Proof Contract — drawing-game

Frozen before implementation. Category-C Wave 16 (ADR-0018 spatial pointer drag, ADR-0043) - strokes on the pointer shell.

## Preset

`drawing-game` (`packages/presets/src/catalog/partyToyWeird.ts`) — controller family `pointer`, required packs (none required - ADR-0018 spatial pointer). Content roles tuning.

Generated via `npm run sw2d -- new proof-drawing-game --preset drawing-game` (the canonical factory, unmodified - the Category-C shells consume the capability directly, so no `src/game-specific/` customization was needed).

## Reusable capability exercised

- `SceneContext.spatialPointer` drag: `bindStarterPointer` (`POINTER_STARTER 'draw'`) turns a captured drag into a stroke with a measured length; two strokes complete the sketch.

## Terminal success/failure oracle

- **Success surface:** a press-release with no movement is not a stroke; a 320 px drag is one stroke with `strokeLength >= 300`; a second stroke completes; restart reinstalls (`strokes 0`).
- **Failure surface:** `pointerPlay.{strokes,strokeLength,lastResult,outcome}`.

## Defining journey (automated, real-browser, deterministic frame stepping)

1. Start; mode `draw`; `strokes 0`.
2. Pointer down/up at (200,200) -> `strokes 0`.
3. Drag (200,200)->(520,200) -> `stroke`, `strokes 1`, length >= 300.
4. Drag (200,320)->(520,320) -> `strokes 2`, `complete`.
5. Restart: `strokes 0`, `playing`.

## Acceptance

- Pressure, layers and export stay out (catalog limitation).
- Zero console errors, zero external requests.
