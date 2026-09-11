# Proof Contract — rhythm-action

Frozen before implementation. Category-C Wave 10 (`sw2d.timing`, ADR-0037) - the beat-window consumer.

## Preset

`rhythm-action` (`packages/presets/src/catalog/puzzleArcade.ts`) — controller family `ui-simulation`, required packs `sw2d.arcade`, **`sw2d.timing`** (mode `rhythm`). Content roles tuning.

Generated via `npm run sw2d -- new proof-rhythm-action --preset rhythm-action` (the canonical factory, unmodified - the Category-C shells consume the capability directly, so no `src/game-specific/` customization was needed).

## Reusable capability exercised

- `sw2d.timing` (`arcade.timing`) from `content/timing.json`: a repeating beat with an open window around each beat, three beats to complete.

## Terminal success/failure oracle

- **Success surface:** three consecutive presses each land inside an open window and count (`hits` 1, 2, 3); the round completes; restart reinstalls.
- **Failure surface:** `timing.{windowOpen,hits,misses,cueIndex,nextBeatInMs,outcome}`.

## Defining journey (automated, real-browser, deterministic frame stepping)

1. Start; mode `rhythm`; `hits 0`.
2. ×3: wait for `windowOpen`, CONFIRM -> `hits` +1.
3. -> `complete`, `hits >= 3`.
4. Restart: `hits 0`, `playing`.

## Acceptance

- Zero console errors, zero external requests.
