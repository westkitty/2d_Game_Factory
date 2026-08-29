# Proof Contract — pong

Frozen before implementation. Post-ten program Phase 15 (local multiplayer & gamepad routing).

**Scope: the input foundation only.** There is deliberately no ball, no bounce, no serve and no
score in this proof. Those belong to `arcade.ball-paddle` in Phase 16, which will consume this
shell rather than replace it. What this proof establishes is the property Phase 16 is built on and
cannot itself demonstrate: two paddles driven by two isolated semantic channels, including
simultaneous *opposite* intent.

## Preset

`pong` (`packages/presets/src/catalog/puzzleArcade.ts`) — controller family `top-down`,
required pack `sw2d.arcade`, content roles `tuning`, **`players`**.

## Reusable capability exercised

- **`input.players`** — a two-slot roster (`left`, `right`) with `requireReady: false`, exclusive
  keyboard-profile ownership, and one `ActionInput` per player.
- `topDownController` — a paddle is a body with one axis; the shared controller reads each
  player's own channel.

## What is deliberately game-specific

Paddle geometry, court bounds and the clamp. No input handling of any kind.

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
| every channel given every profile's bindings (cross-talk) | steps 3 and 7 FAIL |
