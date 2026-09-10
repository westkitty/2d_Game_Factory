# ADR-0049: Consume auto-run presentation in course and endless shells

- Status: accepted
- Date: 2026-09-10
- Phase: Category-C capability program, Wave 22

## Context

`auto-runner` and `endless-runner` already required `sw2d.generation` and
`sw2d.arcade`. The generated platform shell still let the player walk, so a
factory endless-runner was not auto-running. Wave 8 already rejected pairing
these two via `sw2d.stage-scroll`: generation already owns the level stream.

Inventing a climbing or chase pack would duplicate 1-consumer leftovers.
Folding auto-run into stage-scroll would lie about a scrolling shmup camera.

They still share auto-run + jump on an authored gap. Course wins by reaching
a flag. Endless wins by banking distance on `arcade.score`.

## Decision

**Do not add a pack, schema, or capability id. Do not invent a runner,
climbing, or chase engine. Present auto-run in the platform shell.**

- **`auto-runner`** generated packConfig sets `RUN_STARTER = 'course'`.
  Constant +X velocity, Space jumps the gap, complete occupying FLAG at x
  820 on the ground.
- **`endless-runner`** generated packConfig sets `RUN_STARTER = 'endless'`.
  Same auto-run and gap; `arcade.addScore` from distance; complete at score
  80.
- **No third consumer.** Climbing-game, chase-platformer and collectathon
  keep `RUN_STARTER = null`. Overlay runner kits stay local.

## Consequences

- No new pack. Pack count stays 28.
- Catalog maturity stays unchanged. `endless-runner` remains proof-validated
  on the frozen proof.
- Climbing / chase-pressure stay leftovers.
- Segment-chain generation still emits a NormalizedLevel; the starter strip
  is the playable collision.

## Rejected

- **Pairing via `sw2d.stage-scroll`.** Already rejected; generation owns the
  stream, not a shmup camera.
- **A climbing / wall-slide pack.** Only climbing-game needs it.
- **A chase / pursuit pack.** Only chase-platformer needs it.
- **Using generated segment solids as the playable course.** Jump timing
  would be seed-fragile for the factory play journey.
