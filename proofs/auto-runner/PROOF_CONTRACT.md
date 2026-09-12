# Proof Contract — auto-runner

Frozen before implementation. Category-C Wave 22 (auto-run course presentation over `sw2d.generation`, ADR-0049) on the platform shell.

## Preset

`auto-runner` (`packages/presets/src/catalog/platforming.ts`) — controller family `platform`, required packs `sw2d.arcade`, `sw2d.generation`. Content roles tuning, levels.

Generated via `npm run sw2d -- new proof-auto-runner --preset auto-runner` (the canonical factory, unmodified - the Category-C shells consume the capability directly, so no `src/game-specific/` customization was needed).

## Reusable capability exercised

- `bindStarterRun` (`RUN_STARTER 'course'`): the runner moves on its own along an authored gap strip; JUMP is the only input; a missed gap fails, the finish completes. `sw2d.generation` provides the segment chain underneath. **`sw2d.pursuit`** (`chaser` mode, Final Product Completion Wave 1, matrix L02) trails the runner by the catalog gap (150 px) and closes at 200 px/s while the runner is tripped on an authored block (`block-a` at x 520, `block-b` at x 760); two trips catch the runner, a clean run escapes at the flag.

## Terminal success/failure oracle

- **Success surface:** the runner advances with no input and pause freezes it; doing nothing at the gap is `failed` / `fell` with `jumps 0`; after restart, jumping the gap then running into both blocks is `stumbled` then `failed` / `caught` with `stumbles 2`; after another restart, jumping the gap and both blocks is `complete` / `escaped` at x >= 820 with `stumbles 0` and the gap intact.
- **Failure surface:** `run.{x,score,jumps,stumbles,stumbling,chaserX,gap,hazardsLeft,lastResult,outcome}`.

## Defining journey (automated, real-browser, deterministic frame stepping)

1. Start; `sw2d.generation` and `sw2d.pursuit` installed; mode `course`; `jumps 0`; `hazardsLeft 2`; chaser behind the runner.
2. 6 frames -> x increased; pause/resume -> x advanced < 40 across the pause.
3. Wait -> `failed`, `fell`, `jumps 0`.
4. Restart; JUMP at x >= 210 on the ground; run into block-a -> `stumbled`, `stumbling`; run into block-b -> `failed`, `caught`, `stumbles 2`.
5. Restart; JUMP at x >= 210, 455 and 700 on the ground -> `complete`, `escaped`, `jumps 3`, `stumbles 0`, x >= 820.

## Acceptance

- Runner pressure is the reusable `sw2d.pursuit` chaser from `content/pursuit.json` - no catalog limitation remains.
- Zero console errors, zero external requests.
