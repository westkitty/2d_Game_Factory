# Proof Contract — breakout

Frozen before implementation. Category-C Wave 5 (`sw2d.ball-paddle`, ADR-0032) - the brick-clear consumer.

## Preset

`breakout` (`packages/presets/src/catalog/puzzleArcade.ts`) — controller family `top-down`, required packs `sw2d.arcade`, **`sw2d.ball-paddle`** (mode `breakout`). Content roles tuning.

Generated via `npm run sw2d -- new proof-breakout --preset breakout` (the canonical factory, unmodified - the Category-C shells consume the capability directly, so no `src/game-specific/` customization was needed).

## Reusable capability exercised

- `sw2d.ball-paddle` (`arcade.ball`) from `content/ball-paddle.json`: ball, paddle, rebound, 12 bricks, lives, score. `bindStarterBallPaddle` (shared top-down shell): move axis drives the paddle.

## Terminal success/failure oracle

- **Success surface:** the paddle moves under input; pause freezes and resume continues the rally; tracking the ball with the paddle returns it (`paddleReturns >= 1` by mid-game) and clears all 12 bricks (`score >= 120`, lives left, `complete`); restart reinstalls (12 bricks, score 0).
- **Failure surface:** `ballPaddle.{paddleX,ballX,ballY,bricksRemaining,lives,score,paddleReturns,outcome}`.

## Defining journey (automated, real-browser, deterministic frame stepping)

1. Start; `sw2d.ball-paddle` installed; mode `breakout`; `bricksRemaining 12`.
2. Hold Right 10 frames -> `paddleX` +8 or more.
3. Pause/resume -> still `playing`.
4. Loop: steer the paddle under the ball until `outcome !== 'playing'` -> `bricksRemaining 0`, `score >= 120`, `lives > 0`, `complete`; `paddleReturns >= 1` at 6 bricks and at the end.
5. Restart: 12 bricks, `score 0`, `playing`.

## Acceptance

- A full pinball table is not this pack (catalog limitation; see `pinball-lite`).
- Zero console errors, zero external requests.
