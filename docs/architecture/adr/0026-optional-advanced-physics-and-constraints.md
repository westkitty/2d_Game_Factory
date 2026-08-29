# ADR-0026: Advanced physics is an opt-in Matter profile with a renderer-neutral service

- Status: accepted
- Date: 2026-08-29
- Phase: Capability program, Phase 9 (Sonnet 5)

## Context

`grappling-platformer`, `physics-toy`, `physics-puzzle` and `pinball-lite`
carried `LIMITATIONS.grapplingPhysics` / `LIMITATIONS.advancedPhysics`:
"optional advanced rigid-body / constraint physics has not been implemented".
Arcade physics (AABB overlap, no rotation, no constraints) is the factory
default and correct for most recipes; a few genuinely need rigid bodies,
angular motion, constraints and a grapple.

## Decision

**An opt-in Matter physics profile plus a renderer-neutral advanced-physics
service. No new dependency (Phaser's Matter is already bundled); Arcade stays
the default and no existing game changes backend.**

- **`GameDefinition.physicsProfile: 'arcade' | 'matter'`** (default `'arcade'`),
  mirrored on `PresetDefinition.physicsProfile: 'matter'` and written into
  `content/game.json` by the generator. `createGame` adds a Matter world to the
  Phaser config only when the profile is `'matter'`, and `PlayScene`'s own
  scene config names the Matter system so Phaser injects `scene.matter` (it
  does this per-scene, not from the global config).
- **`@sw2d/contracts` `advancedPhysics.ts`** - the stable logical surface:
  opaque `PhysicsBodyHandle` / `PhysicsConstraintHandle`, plain
  `PhysicsBodyDefinition` (`rect` / `circle`, static / sensor, density /
  friction / restitution, named `CollisionCategory`), `PhysicsBodyState`,
  `AdvancedPhysicsService` (`createBody` / `removeBody` / `bodyState` /
  `setVelocity` / `setAngularVelocity` / `applyImpulse` /
  `createDistanceConstraint` / `createSpring` / `createPin` /
  `createWorldConstraint` / `removeConstraint` / `dispose`), and
  `GrappleService`. **No `Matter.*` or `Phaser.*` type crosses this module.**
- **`@sw2d/runtime` `createAdvancedPhysics(scene)`** - the Matter-backed
  implementation. Owns every Matter body, constraint and the logical-handle
  map; named collision layers map to Matter category bits in exactly one
  place; `removeBody` also drops any constraint referencing that body;
  `dispose()` removes all of it (repeated restarts retain nothing). Inert
  (every method a safe no-op, `enabled === false`) when the game did not opt
  into Matter.
- **`@sw2d/runtime` `createGrappleService(physics, def)`** - a real physical
  grapple: a near-rigid distance constraint between the player body and an
  anchor world point through the service. One active grapple; `attach`
  validates anchor existence, eligibility and range; `notifyAnchorRemoved`
  detaches safely; reeling adjusts rope length within bounds. It does **not**
  lerp the player in a circle - the swing is Matter solving the constraint.
- **There is no `@sw2d/packs` pack.** `@sw2d/packs` cores are Phaser-free by
  contract; a Matter-owning service cannot live there. Following the ADR-0020
  precedent (weapons model in a pack, projectiles a runtime bridge), the
  advanced-physics service is a `@sw2d/runtime/game-support` factory the shells
  and proofs call directly - the same shape as `ProjectilePool` and the
  interaction service.
- **Generated shells** (`pointer`, `platform`, `ui-simulation`) create the
  service and a demo rigid body when the game's profile is `'matter'`.
- **Workbench**: `POST /api/physics/inspect` + an inspector panel reporting the
  backend and Matter gravity.

## Consequences

- Proof consumers: `proofs/grappling-platformer/` (the player is a Matter
  body; attach → a real distance constraint; the swing keeps the player near a
  fixed distance from the anchor while its position changes; detach; re-attach;
  reel shortens the rope; restart leaves no constraint and no extra bodies) and
  `proofs/physics-toy/` (several rigid bodies falling and colliding on a static
  floor; one spring constraint; a Phase-1 spatial-pointer click shakes the
  field; restart restores the fresh body/constraint counts). `qa:proof` 19/19 →
  21/21.
- `grappling-platformer`, `physics-toy`, `physics-puzzle`, `pinball-lite` set
  `physicsProfile: 'matter'`. `LIMITATIONS.grapplingPhysics` and
  `LIMITATIONS.advancedPhysics` **removed** (both constants deleted).
  `physics-puzzle` keeps `puzzleConfigIsCode` (its physics-goal integration via
  `sw2d.puzzle-rules` is deferred); `pinball-lite` keeps a narrow limitation (a
  full table - flippers, bumpers, scoring - is game-specific code on the Matter
  ball + collision the shell provides).
- Existing Arcade games are byte-for-byte unaffected: no `physicsProfile` →
  the `createGame` / `PlayScene` config is identical to before.

## Rejected

- **Migrating the factory to Matter.** Arcade is right for most recipes and
  cheaper; Matter is opt-in per game.
- **A second physics engine dependency.** Phaser's Matter is already bundled.
- **A `sw2d.physics` pack in `@sw2d/packs`.** That package is renderer-free by
  contract; a Matter-owning service belongs in `@sw2d/runtime`.
- **Exposing raw Matter options as arbitrary JSON.** The body definition is a
  bounded, named set of properties.
- **Claiming wall-jump / ledge-grab climbing is solved.** That is a separate
  future capability (`LIMITATIONS.climbingMechanics`), untouched here.
