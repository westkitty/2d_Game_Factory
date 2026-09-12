# ADR-0032: Arcade ball, paddle and rebound are one reusable table capability

- Status: accepted
- Date: 2026-09-09
- Phase: Category-C capability program, Wave 5

## Context

`breakout` and `pong` carried the limitation that no reusable ball/paddle
collision-and-bounce system existed. Both recipes need the same underlying
machine (serve, paddle rebound, wall bounce, miss/reset) with different
scoring rules: breakout clears bricks with lives; pong is first-to-N against
a chasing opponent. Folding that into `sw2d.arcade` would have turned a
score/combo counter into a genre monolith. Pinball tables and local
multiplayer input routing do not fit this contract.

## Decision

**One renderer-neutral ball/paddle capability with two bounded modes. Not two
engines, and not a pinball DSL.**

- **`sw2d.ball-paddle` → `arcade.ball`.** `BallPaddleService` owns paddle
  axis motion, ball integration, wall bounce, paddle contact, brick-clear,
  drain/lives, and a lerp opponent. No Phaser, no wall clock, no RNG.
- **Two modes of one machine:**
  - `breakout` — one paddle, a brick field, three lives, clear-or-drain.
  - `pong` — one player paddle, a chasing opponent, first to 3.
- **`content/ball-paddle.json`** (schema `ball-paddle-catalog`, document
  `ball-paddle`), always emitted. Empty/inert unless the preset installs the
  pack. The generator maps breakout → breakout, pong → pong. Constants match
  the expanded overlay shells so factory and overlay stay aligned.
- **The generated `topDownShellPack`** calls `bindStarterBallPaddle`. When
  active it hides the dummy wander, feeds `setPaddleAxis` / `tick` each frame,
  and draws a high-contrast table HUD.
- **Workbench:** `POST /api/ball-paddle/inspect` + a compact inspector
  (mode, bricks, lives, win score). Read-only; editing is JSON work on the
  file.

## Consequences

- Consumers: `breakout` (bricks/lives/clear), `pong` (two paddles/score-to-3).
  Both require `sw2d.ball-paddle` and content role `ball-paddle`.
- `LIMITATIONS.ballPaddleSystem` names what is reusable and what is not.
  Twenty-four packs now have a preset consumer.
- Duplicate brick ids throw at install. A missing document yields an inert
  service, not a crash.
- `bindStarterBallPaddle` resets the session on bind so a PlayScene restart
  is a new serve.
- Catalog maturity stays unchanged. Pinball-lite stays on Matter. Pong still
  has no proven multi-player input-routing abstraction; opponent AI is the
  machine.

## Rejected

- **Folding this into `sw2d.arcade`.** That pack is score/combo/lives
  counters and explicitly is not rebound geometry.
- **A Matter pinball table.** Flippers, bumpers and lanes are a different
  contract; pinball-lite already uses the Matter backend.
- **Local multiplayer paddles.** Input routing is a separate cluster.
