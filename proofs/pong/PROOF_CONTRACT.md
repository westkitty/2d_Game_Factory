# Proof Contract — pong

Frozen before implementation. Category-C Wave 5 + Wave 7 (`sw2d.ball-paddle` first-to-N + `sw2d.local-play` versus seats, ADR-0032 / ADR-0034).

## Preset

`pong` (`packages/presets/src/catalog/puzzleArcade.ts`) — controller family `top-down`, required packs `sw2d.arcade`, **`sw2d.ball-paddle`** (mode `pong`), **`sw2d.local-play`** (mode `versus`). Content roles tuning.

Generated via `npm run sw2d -- new proof-pong --preset pong` (the canonical factory, unmodified - the Category-C shells consume the capability directly, so no `src/game-specific/` customization was needed).

## Reusable capability exercised

- `sw2d.ball-paddle` pong mode: two paddles, rebound, first-to-3.
- `sw2d.local-play` versus mode: seat 0 (ArrowUp/ArrowDown) drives the left paddle, seat 1 (W/S) drives the right paddle - two independent axes on one keyboard, the shell feeds `axis(1)` into the table instead of lerp AI.

## Terminal success/failure oracle

- **Success surface:** seat 0's axis moves only the player paddle and seat 1's axis moves only the opponent paddle; seat 0 returns the ball at least once (`player-return`, ball heading back right); the match ends first-to-3 either way (`complete` if the player, `failed` if the opponent) and no point is scored after; restart reinstalls (0-0).
- **Failure surface:** `localPlay.{axis0,axis1}`, `ballPaddle.{paddleY,opponentY,ballX,ballY,playerScore,opponentScore,lastResult,outcome}`.

## Defining journey (automated, real-browser, deterministic frame stepping)

1. Start; `sw2d.ball-paddle` + `sw2d.local-play` installed; pong / versus; 0-0.
2. Hold ArrowDown 20 frames -> `axis0 1`, `axis1 0`, `paddleY` +8; hold W 20 frames -> `axis0 0`, `axis1 -1`, `opponentY` lower.
3. Track the ball with seat 0 until `player-return`; 8 frames later `ballX` has increased.
4. Play a deliberately bad policy until `outcome !== 'playing'` -> max score 3, min < 3, outcome matches the winner; 30 frames later scores unchanged.
5. Restart: 0-0, `playing`.

## Acceptance

- Netcode, gamepads and split-screen are not this pack (catalog limitation).
- Zero console errors, zero external requests.
