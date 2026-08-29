# ADR-0018: Spatial pointer is a scene service, not part of ActionInput

- Status: accepted
- Date: 2026-08-28
- Phase: Capability program, Phase 1 (Sonnet 5)

## Context

`ActionInput` carries semantic digital/analog actions with a one-frame owner and
claimable presses (ADR-0003). ADR-0016 added aim as a fourth digital axis and
recorded that a genuine spatial pointer — world-space cursor position, hover
targets, drag vectors — was still deferred, and would "need its own ADR on input
ownership when it comes, because hover has no press to claim and so does not fit
`ActionInput` the way ADR-0016's aim extension did." It was deferred four times
(Phases 3, 8, 9, 10) for want of a real consumer.

The capability program's Phase 1 is that consumer: `gallery-shooter` needs
world-space click targeting, `point-and-click` needs hover + drag/drop, and
neither can be built honestly on press-style actions alone.

Two shapes were possible: bolt `x`/`y`/`hover`/`drag` fields onto `ActionInput`,
or a separate service beside it.

## Decision

**Spatial pointer is a separate service, exposed on `SceneContext`, never on
`ActionInput` or the closed `GameContext`.**

- `@sw2d/contracts/spatial.ts` (renderer-neutral): `SpatialPointerState` /
  `SpatialPointerInput` (read-only, host-advanced), `HitShape`
  (`rect | circle | polygon`) with a pure `hitTestPoint`, `aimFromPointer`, and
  the `InteractionService` / `InteractionTargetOptions` contract.
- `@sw2d/runtime` `SpatialPointerHost` — the single owner of pointer state.
  DOM listeners write raw values; `update()` runs exactly once per game step
  from the same PRE_STEP handler that advances `ActionInputHost`, so two readers
  in one frame always agree. A press+release inside one frame is latched, not
  dropped, identical to the semantic host. Listeners attach once and detach on
  dispose, so restarts cannot accumulate handlers.
- `@sw2d/runtime` `InteractionServiceImpl` (`game-support/`, the `ProjectilePool`
  precedent) — renderer-neutral, consumes only a `SpatialPointerInput` and hit
  shapes. Constructed per `SceneContext`, disposed with the scene, and ticked
  from the scene's own `UPDATE` event (after PRE_STEP, so hit-testing reads a
  fresh pointer). Higher `priority` wins overlaps; a drag captures its origin
  target until release; drop zones resolve on release.
- `aimFromPointer(origin, pointer)` complements — never replaces — the digital
  `AIM_*` axis. A game reads it only when digital aim magnitude is zero.

**Why `SceneContext`, not `GameContext`:** world-space resolution needs a live
camera, which only exists inside a scene. `GameContext` stays closed on the same
negative-evidence rule ADR-0004 and Phase 5 established — the screen→world
closure is injected into the host by `createGame`, and the host is attached to
each `SceneContext` the same way `scene` / `sceneDisposables` already are.

**Why not on `ActionInput`:** hover and drag-delta have no discrete edge to
claim; `consumePress` is meaningless for them. Mixing a continuous positional
signal into the claim-based semantic layer would blur exactly the boundary
ADR-0003 exists to keep sharp. The digital `PAUSE`/`CONFIRM`/`AIM_*` actions and
the `PointerAdapter`'s `data-sw2d-action` DOM buttons are untouched.

## Consequences

- Every generated game receives `spatialPointer` and `interaction` automatically
  through `createSceneContext` — no template edit, no runtime-internals edit by a
  game author.
- `gallery-shooter` and `point-and-click` are the two substantially different
  proof consumers (world-space click targeting; hover + drag/drop). Both are
  real generated games driven with real `PointerEvent`s in `npm run qa:proof`.
  `twin-stick-shooter` is the regression consumer: pointer aim is an optional
  fallback and digital aim is proven still independent and authoritative.
- The `pointer`-family preset limitation is removed only where a proof consumer
  actually wires the capability (`gallery-shooter`, `point-and-click`). Presets
  that still do not consume it (`rail-shooter`, `tower-defense` placement,
  `drawing-game`, `dress-up-character-toy`, `simple-rts`, `escape-room`,
  `breakout`/`pong`) keep their limitations, narrowed only to say the capability
  now exists but that starter does not use it. Those are removed by the later
  phases that wire those presets.

## Rejected

- **`x`/`y`/`hover`/`drag` fields on `ActionInput`.** See "Why not on
  `ActionInput`" — it breaks the claim-based boundary for a positional signal
  that never needed it.
- **A new `sw2d.interaction` system pack.** Interaction targeting maps Phaser
  game objects to hit shapes; `@sw2d/packs` cores are renderer-independent by
  contract. Same reasoning that put `ProjectilePool` in `game-support/`.
- **A field on `GameContext`.** World resolution needs a scene camera; nothing
  outside a scene has a use for it.
- **Phaser's own input plugin.** Still disabled (ADR-0001/0003). The host uses
  raw DOM `pointer*` events and `camera.getWorldPoint`; nothing re-enables
  Phaser keyboard/pointer capture.
