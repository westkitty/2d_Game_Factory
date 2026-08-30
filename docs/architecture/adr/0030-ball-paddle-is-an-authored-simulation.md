# ADR-0030: Ball/paddle is an authored simulation with a single frame owner

- Status: accepted
- Date: 2026-08-29
- Phase: Post-ten capability program, Phase 16

## Context

`breakout` and `pong` both carried `LIMITATIONS.ballPaddleSystem` - "No reusable ball/paddle
collision-and-bounce system exists yet." `pong` additionally had no two-player input story until
Phase 15 supplied `input.players`.

The obvious answer is "use a physics engine". Arcade Physics is already the platformer's world
solver, and Matter is already an opt-in profile (ADR-0026). Both were rejected for this capability.

## Decision

**One pure, renderer-neutral simulation, `sw2d.ball-paddle` → `arcade.ball-paddle`, authored by
`content/ball-paddle.json` (`urn:sw2d:schema:content-ball-paddle:v1`).**

### Why not a physics engine

1. **A ball/paddle bounce is authored, not simulated.** The outgoing angle is a *designed* function
   of where the ball struck the paddle - that is the whole feel of the genre. A restitution solver
   computes the opposite thing, so expressing the design through it means fighting it every frame.
2. **Determinism.** A pure integrator with bounded substeps produces identical results on every
   machine, which is what lets the browser proof assert exact speeds and exact scores. This follows
   the Phase-10 vehicle/racing precedent, where the same reasoning produced the same shape.

Matter in particular is untouched: nothing here needs constraints, joints or polygon collision.

### The bounce rule

```
relative     = (ball position along the paddle axis - paddle centre) / (paddle length / 2), clamped
angle        = relative * maxBounceAngle * bounceInfluence
outgoing     = normal * cos(angle) + tangent * sin(angle)
```

`tangent` points along the paddle's own travel axis - the same direction `relative` is measured in.
Writing this per-facing instead invites a sign error that steers two of the four facings backwards;
an earlier draft had exactly that bug and a contract test caught it.

**`maximumBounceAngleDegrees` is capped at 80 by validation, and that cap *is* the
degenerate-trajectory prevention.** An outgoing vector built by rotating the paddle normal by at
most 80 degrees always retains a real component along the normal, so a ball can never leave a paddle
travelling parallel to its face and grind along it. No special case is needed because the bound
makes the bad state unreachable.

### High-speed safety: bounded substeps, not CCD

The ball moves at most half its radius per integration substep, so it cannot pass through a paddle
or a brick at any speed the definition permits. The substep count is bounded (64), and a definition
whose top speed would exceed that budget at 30fps is **rejected at install** with
`UnsupportedBallSpeedError` rather than silently tunnelling later. This is deliberately *not* a claim
of universal continuous collision detection, and the narrowed limitation says so.

### Single ownership of frame advancement

`update()` is absent from the `BallPaddleService` interface. The pack advances the simulation exactly
once per frame; a consumer observes through `drainEvents()`.

This mirrors `ActionInput`, whose header has said since Phase 1 that "frame advancement is
deliberately absent: only the runtime host advances edges". The rule earned its place again here:
the first draft let both the pack and the consuming shell call `update()`, so the ball double-stepped
and the shell saw only the events of its own half. The browser proof caught it as a brick count that
disagreed with the board. Removing `update()` from the interface makes the mistake unrepresentable
rather than merely documented.

### Events, not state diffing

`drainEvents()` returns an ordered list (`served`, `wall-bounce`, `paddle-bounce`, `brick-hit`,
`brick-destroyed`, `goal`, `ball-lost`, `round-complete`, `match-complete`). A consumer reacts to
facts rather than inferring them, so "two bricks died this frame" is reported as two events rather
than a count that has to be diffed.

### One document, two genres

Arena edges carry a behaviour (`bounce` | `goal` | `loss`), which is what lets one simulation be both
games: Breakout is three bouncing walls plus a `loss` floor with bricks and lives; Pong is two
bouncing walls plus two `goal` edges naming their scorer, with a target score and no bricks.

Brick drops name a **canonical `sw2d.items` id** (Phase 2). This system never invents an item.

## Consequences

- `LIMITATIONS.ballPaddleSystem` narrows from "does not exist" to what is actually true, including
  the honest substep caveat.
- `pong` composes Phases 15 and 16: `input.players` seats two players and gives each an isolated
  `ActionInput`; `arcade.ball-paddle` owns everything else. The shell is only the wire, reading each
  player's own channel through the ordinary shared `topDownController`.
- A completed match parks the ball. `status: 'complete'` alongside `ball.live: true` is contradictory
  state a consumer would draw as a ball hanging in mid-air; the proof asserted it and the
  implementation was corrected.
- Proof consumers: `proofs/breakout/` (12 steps, new) and `proofs/pong/` (12 steps, upgraded - its six
  Phase-15 steps are unchanged and still asserted).
