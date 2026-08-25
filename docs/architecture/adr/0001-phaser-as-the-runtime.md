# ADR-0001: Phaser 4 is the game runtime

- Status: accepted
- Date: 2026-08-24
- Phase: 1 (Opus 5)

## Context

The factory needs a 2D browser runtime covering scene management, input plumbing, arcade
physics, a texture cache and WebGL/Canvas rendering across desktop and mobile browsers, for
genres from platformers to management toys. `MASTER_PROJECT.md` §4 names Phaser 4 as the
intended direction; §3.4 and §47 forbid adopting a second engine or building our own.

## Decision

Use **Phaser 4.2.1** (MIT) as the sole game runtime.

Constrain how the codebase touches it:

- `@sw2d/contracts` never imports Phaser. Engine types stop at `SceneContext` in
  `@sw2d/runtime`.
- Phaser's keyboard plugin is disabled (`input: { keyboard: false }`). The semantic input layer
  is the only reader of physical input.
- Only `SceneRouter` calls Phaser's scene manager.

## Consequences

- Genre breadth is covered without writing a renderer or a physics engine.
- Arcade physics is sufficient for most of the 74 presets. A matter.js-style pack for rope,
  grapple and pinball stays optional and isolated (`MASTER_PROJECT.md` §9.16), added only when
  a proof demands it.
- Phaser is ~1.4 MB minified in the bundle. Acceptable for a self-contained static game;
  revisit with code-splitting only if a real target demands it.
- Phaser 4.2.1's typings omit several documented `SceneManager` methods. Declared in
  `packages/runtime/src/phaser-augmentations.d.ts`, to be deleted when upstream catches up.

## Rejected

- **Excalibur, KAPLAY** - useful architectural references, but adding a second engine is
  explicitly out of scope.
- **A custom engine or ECS** - `MASTER_PROJECT.md` §47. No proof requires one.
