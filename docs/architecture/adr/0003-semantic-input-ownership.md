# ADR-0003: One frame owner, and presses are claimed

- Status: accepted
- Date: 2026-08-24
- Phase: 1 (Opus 5)

## Context

`MASTER_PROJECT.md` §3.6 requires gameplay to consume semantic actions rather than key codes.
Mapping alone is not enough. The `c_chase` audit's top finding was that one physical keypress
was consumed twice - once by a `keydown` handler and once by the animation-loop, both reading
the same `pressed` set before it was cleared - which broke pause, level select, the briefing
system and several toggles. An indirection layer that still lets two readers act on one press
reproduces that bug with better naming.

Phase 1 hit the same class of failure on its first real browser run: pressing P paused, and
pressing P again resumed and then *immediately re-paused*, because the pause overlay resumed
the play scene within the same frame and the freshly-resumed scene then read the same
`justPressed('PAUSE')` edge. Observed live, confirmed from the call stack.

## Decision

Two rules, both structural.

**1. One owner advances the frame.** `ActionInputHost.update()` runs exactly once per game
step, from Phaser's `prestep` event, before any scene updates. Adapters only write raw values;
they never compute edges. Two systems reading `justPressed` in the same frame always agree.

**2. A press can be claimed.** `ActionInput.consumePress(action)` returns whether the action was
just pressed and, if so, collapses the edge for the rest of the frame. Holding is unaffected -
`isDown` still reports true. Discrete, mode-changing reads (title confirm, pause, resume,
restart, quit, jump) use `consumePress`; continuous reads (movement axis, dash held) use
`isDown` / `axis`.

Supporting rules:

- Phaser's own keyboard plugin is disabled, so nothing can consume a key behind this layer.
- A press and release inside a single frame is latched, not dropped, so fast menu taps survive.
- Adapters attach listeners once at construction and rebuild only a lookup table on rebind, so
  remapping and restarting cannot accumulate handlers.
- Focus loss and tab-hide clear held actions, because the browser will not deliver the keyup.

## Consequences

- One physical press produces one effect regardless of how many layers are alive, without any
  layer knowing what the others are.
- `consumePress` is a mutation on an otherwise read-only interface. That is deliberate and
  documented on the contract; the alternatives were worse (below).
- Later menu, HUD and dialogue layers get the same guarantee for free.
- Covered by regression tests: only the first reader gets the press, holding survives a claim,
  and the next press is still reported.

## Rejected

- **Deferring scene resume to the next frame.** Fixes this instance and leaves every future
  overlapping-layer case to be discovered the same way.
- **Priority ordering between scenes.** Every new layer becomes a global ordering question.
- **Letting each consumer track "did I already handle this".** Restores the per-system bookkeeping
  that produced the original `c_chase` bug.
