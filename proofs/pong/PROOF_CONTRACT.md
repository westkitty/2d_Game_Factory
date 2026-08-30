# Proof Contract — pong

Frozen before implementation. Post-ten program Phase 15 (local multiplayer & gamepad routing).

**Scope: the composition of two post-ten phases.** Phase 15 (`input.players`) seats two players and
gives each an isolated semantic `ActionInput`; Phase 16 (`arcade.ball-paddle`) owns the ball, both
paddles, the serve, the bounce, the goals and the match rules. The shell is only the wire between
them.

The six Phase-15 steps are unchanged and still asserted — Phase 16 was added on top of the input
foundation rather than replacing it.

## Preset

`pong` (`packages/presets/src/catalog/puzzleArcade.ts`) — controller family `top-down`,
required packs `sw2d.arcade`, **`sw2d.ball-paddle`**. Content roles `tuning`, **`players`**,
**`ball-paddle`**.

## Reusable capability exercised

- **`input.players`** (Phase 15) — a two-slot roster (`left`, `right`) with `requireReady: false`,
  exclusive keyboard-profile ownership, and one `ActionInput` per player.
- **`arcade.ball-paddle`** (Phase 16) — the ball, both paddles, the serve policy, wall bounce,
  hit-location steering, the speed ramp, the two `goal` edges naming their scorer, and the target
  score, all from the validated `content/ball-paddle.json`.
- `topDownController` — a paddle is a body with one axis; the shared controller reads each
  player's own channel.

## What is deliberately game-specific

Nothing but the wire: reading each player's own channel and handing the resulting intent to that
player's paddle, plus drawing what the simulation reports. No input handling, no ball, no score, no
bounce maths. The shell cannot advance the simulation - `update()` is absent from
`BallPaddleService` and it observes through `drainEvents()`.

## Terminal success/failure oracle

- **Success surface:** per-paddle `y`, `moveY`, `atTop`/`atBottom`, the derived `oppositeIntent`
  flag, roster slots and `playerAdapterCount`.
- **Failure surface:** the same, plus zero console errors and zero external requests.

## Defining journey (automated, real-browser, 7-step verification)

1. Two authored slots, `input.players` present in the live capability list, nobody seated, cannot start.
2. Both players seat on disjoint keyboard profiles; two adapters; the match starts (`requireReady`
   is false, so seating is sufficient).
3. The left player moves up while the right paddle stays **exactly** where it was (`moveY === 0`).
4. The right player moves down at the same time — simultaneous opposite intent, both paddles moving
   the way their own player pressed.
5. Releasing one player's key stops only that paddle; the other keeps moving.
6. The moving paddle clamps at the court edge rather than leaving it.
7. The right player's key never moved the left paddle at any point in the journey.

## Acceptance

- Every named step tests an observable property. No step is an unconditional `true`.
- Zero console errors, zero external requests.

## Negative-control verification

| Sabotage | Result |
| --- | --- |
| every channel given every profile's bindings (cross-talk) | steps 3 and 6 FAIL |
| goal-edge ownership ignored (nobody credited) | steps 10 and 11 FAIL |
