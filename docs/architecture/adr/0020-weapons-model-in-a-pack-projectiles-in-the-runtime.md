# ADR-0020: The weapon model is a pack; projectiles are a runtime bridge

- Status: accepted
- Date: 2026-08-29
- Phase: Capability program, Phase 3 (Sonnet 5)

## Context

`combat.health` is a health/damage core and stays that way (its own doc
comment: "not a combat system - no weapons, projectiles"). ~11 shooter and
top-down-action presets carried a `weaponsProjectiles` limitation. `ProjectilePool`
already existed as renderer-coupled `game-support` (Phase 9), deliberately not a
pack because pooling policy, collision integration and damage-on-hit were
undiscovered.

Phase 3 discovers them. The question was where the weapon/projectile capability
lives given two constraints: `@sw2d/packs` cores are renderer-independent by
contract, and `capabilityIds.test.ts` requires each pack to `provide` exactly one
capability.

## Decision

**Split by renderer boundary.**

- **`sw2d.weapons` → `combat.weapons`** (`@sw2d/packs`, renderer-neutral). Reads
  `content/weapons.json` (schema `weapon-catalog`, reusing the Phase 2 effect
  union for `onHitEffects`). `WeaponsService` owns per-owner cooldown, fire mode
  (`single` / `auto` / `burst`), burst timing, pellet spread, muzzle offset, ammo
  and reload, and turns a `FireRequest` into a deterministic list of
  `ProjectileSpawn`s. No Phaser. `dependencies: ['combat.health']` - a game with
  weapons needs a health model for damage to mean anything (the `aiPack` →
  `combat.health` precedent).
- **`createProjectileRuntime`** (`@sw2d/runtime/game-support`, the `ProjectilePool`
  precedent). The renderer-coupled half: renders spawns as sprites, resolves
  per-projectile overlap against caller-supplied target groups, applies damage
  through a `CombatDamageSink` and on-hit effects through `sw2d.items`, honours
  pierce and bounce, exposes leak counters. No capability id - projectile
  lifecycle is inherently renderer-coupled, the same reason `ProjectilePool` has
  none. The program's conceptual `combat.projectiles` is this bridge.
- **`bindStarterWeapon`** (`@sw2d/runtime/game-support`) - the shared `platform`
  and `top-down` shell templates call it once, capability-guarded, so a newly
  generated weapon-family game equips the first catalog weapon and fires real
  projectiles through the bridge. A starter has no enemies, so
  projectile-vs-target damage / pierce / bounce are proven by the phase's proof
  games, not the starter.

**Adding a moving sprite to an Arcade `Group` zeroes its velocity** (the group
applies its body defaults). `createProjectileRuntime` therefore tracks
projectiles in a plain `Map` and registers a per-projectile overlap - the exact
shape `ProjectilePool` already uses - rather than a projectile physics group.

## Consequences

- `weaponsProjectiles` removed from the presets whose generated `top-down` /
  `platform` shell now wires weapons (`twin-stick-shooter`, `run-and-gun`,
  `horizontal-shmup`, `vertical-shmup`, `bullet-hell`, `action-adventure`,
  `arena-combat`, `survivor-like`), each narrowed to its real remaining gap
  (encounter orchestration / bullet-pattern choreography → Phase 4; melee →
  unbuilt). `gallery-shooter`, `rail-shooter`, `asteroids-shooter` (pointer /
  vehicle shells) keep a narrowed limitation: the capability exists, their shell
  does not wire it yet.
- Proof consumers: `proofs/twin-stick-shooter/` (upgraded - raw pool → reusable
  model+bridge) and `proofs/run-and-gun/` (new, platform). `qa:proof` 9/9 → 10/10.
- `ProjectilePool` stays for consumers that only need a bounded moving-sprite
  helper with no weapon model (`tower-defense`, `chase-platformer` hazards).

## Rejected

- **Enlarging `combat.health`** into a weapon engine. Its doc comment forbids it;
  weapons compose with it.
- **A `sw2d.projectiles` pack.** Projectile simulation is Phaser sprites and
  Arcade bodies; `@sw2d/packs` cores are renderer-free by contract. Same call as
  `ProjectilePool`.
- **One pack providing two capabilities.** `capabilityIds.test.ts` enforces one
  `provides` per pack; the split above is cleaner anyway.
- **Bullet-pattern choreography (fans, rings, boss phases) here.** That is Phase 4
  and consumes this layer; `bullet-hell` keeps a narrowed limitation saying so.
