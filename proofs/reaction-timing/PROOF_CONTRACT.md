# Proof Contract — reaction-timing

Frozen before implementation. Category-C Wave 10 (`sw2d.timing`, ADR-0037) - the reaction-cue consumer.

## Preset

`reaction-timing` (`packages/presets/src/catalog/puzzleArcade.ts`) — controller family `ui-simulation`, required packs `sw2d.arcade`, **`sw2d.timing`** (mode `reaction`). Content roles tuning.

Generated via `npm run sw2d -- new proof-reaction-timing --preset reaction-timing` (the canonical factory, unmodified - the Category-C shells consume the capability directly, so no `src/game-specific/` customization was needed).

## Reusable capability exercised

- `sw2d.timing` (`arcade.timing`) from `content/timing.json`: a visual wait/go cue, a hit window, measured latency, two cues to complete.
- `bindStarterTiming` (shared ui-simulation shell): CONFIRM/PRIMARY hits.

## Terminal success/failure oracle

- **Success surface:** pressing before the cue is not a hit; a press inside the open window is a hit with a numeric latency; the second cue completes the round; restart reinstalls.
- **Failure surface:** `timing.{phase,windowOpen,hits,misses,lastLatencyMs,outcome}`.

## Defining journey (automated, real-browser, deterministic frame stepping)

1. Start; `sw2d.timing` installed; mode `reaction`; `hits 0`.
2. CONFIRM before the cue -> `hits 0`.
3. Wait for `windowOpen`; CONFIRM -> `hits 1`, `lastLatencyMs` numeric.
4. Wait for the second window; CONFIRM -> `hits >= 2`, `complete`.
5. Restart: `hits 0`, `playing`.

## Acceptance

- Visual cues only; music-beat synchronization stays out (catalog limitation).
- Zero console errors, zero external requests.
