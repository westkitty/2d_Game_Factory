# Proof Contract — auto-runner

Frozen before implementation. Category-C Wave 22 (auto-run course presentation over `sw2d.generation`, ADR-0049) on the platform shell.

## Preset

`auto-runner` (`packages/presets/src/catalog/platforming.ts`) — controller family `platform`, required packs `sw2d.arcade`, `sw2d.generation`. Content roles tuning, levels.

Generated via `npm run sw2d -- new proof-auto-runner --preset auto-runner` (the canonical factory, unmodified - the Category-C shells consume the capability directly, so no `src/game-specific/` customization was needed).

## Reusable capability exercised

- `bindStarterRun` (`RUN_STARTER 'course'`): the runner moves on its own along an authored gap strip; JUMP is the only input; a missed gap fails, the finish completes. `sw2d.generation` provides the segment chain underneath.

## Terminal success/failure oracle

- **Success surface:** the runner advances with no input and pause freezes it; doing nothing at the gap is `failed` with `jumps 0`; after restart a jump at x >= 200 (`jump`, `jumps 1`) clears it and the course is `finished` / `complete` at x >= 820.
- **Failure surface:** `run.{x,score,jumps,lastResult,outcome}`.

## Defining journey (automated, real-browser, deterministic frame stepping)

1. Start; `sw2d.generation` installed; mode `course`; `jumps 0`.
2. 6 frames -> x increased; pause/resume -> x advanced < 40 across the pause.
3. Wait -> `failed`, `jumps 0`.
4. Restart; wait for x >= 200; JUMP -> `jump`, `jumps 1`; wait -> `finished`, `complete`, x >= 820.

## Acceptance

- Chase pressure / climbing on the strip stay out (catalog limitation).
- Zero console errors, zero external requests.
