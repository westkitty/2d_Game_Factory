# Proof Contract — pinball-lite

Frozen before implementation. Category-C Wave 24 + Wave 30 (`sw2d.pinball`, ADR-0051 / ADR-0057) - a table whose flippers are load-bearing.

## Preset

`pinball-lite` (`packages/presets/src/catalog/puzzleArcade.ts`) — controller family `ui-simulation`, required packs `sw2d.arcade`, **`sw2d.pinball`** (mode `table`). Content roles tuning.

Generated via `npm run sw2d -- new proof-pinball-lite --preset pinball-lite` (the canonical factory, unmodified - the Category-C shells consume the capability directly, so no `src/game-specific/` customization was needed).

## Reusable capability exercised

- `sw2d.pinball` (`arcade.table`) from `content/pinball.json`: gravity, bounce, three bumpers, two flippers, a drain that resets the ball in table mode, `winScore 3`.
- `bindStarterPhysics` (table): PRIMARY flips left, SECONDARY flips right; flipper sprites and the HUD win score are read from the same catalog the pack simulates. The convergence program replaced the first Wave-30 table, which completed with zero input.

## Terminal success/failure oracle

- **Success surface:** hands off, the ball falls, misses every bumper, drains and resets with `score 0`; flipping only when the ball is over a flipper produces bumper hits and the win (`score >= 3`, `lastResult 'score'`, `complete`), with `flips` equal to the presses made; restart reinstalls (`score 0`, `flips 0`).
- **Failure surface:** `physicsPlay.{ballX,ballY,score,flips,lastResult,outcome}`.

## Defining journey (automated, real-browser, deterministic frame stepping)

1. Start; `sw2d.pinball` installed; mode `table`; `score 0`, `flips 0`.
2. 6 frames -> `ballY` increased (falling).
3. Wait -> `lastResult 'drain'`, `score 0`, ball back near the launch point.
4. Loop: when the ball is within a flipper's half-width and 36 px of its y, tap that flipper; -> bumper hits, `score >= 3`, `complete`; `flips` === presses.
5. Restart: `score 0`, `flips 0`, `playing`.

## Acceptance

- `packages/cli/test/pinballTable.test.ts` pins the generated table's two halves (never self-completes; completes with flips) through the real pack.
- Zero console errors, zero external requests.
