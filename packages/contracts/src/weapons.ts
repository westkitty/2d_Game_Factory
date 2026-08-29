/**
 * Data-driven weapons and projectiles (capability program Phase 3).
 *
 * `combat.health` is a health/damage core and stays that way. This is the
 * reusable weapon/projectile layer that composes with it: validated
 * `WeaponDefinition`s in `content/weapons.json`, a renderer-neutral
 * `WeaponsService` that owns cooldown / fire-mode / spread / ammo and turns a
 * fire request into a deterministic list of `ProjectileSpawn`s, and a
 * runtime bridge (`@sw2d/runtime`) that renders those spawns as sprites and
 * resolves collisions through `CombatService`.
 *
 * Bullet-pattern choreography (fans, rings, sweeps, boss phases) is NOT here
 * - that is Phase 4, and it consumes this layer.
 */

import type { EffectDefinition } from './items.ts';

/** Capability id the `sw2d.weapons` pack publishes. */
export const WEAPONS_CAPABILITY_ID = 'combat.weapons';

export type FireMode = 'single' | 'auto' | 'burst';

export interface ProjectileSpec {
  /** Semantic asset role for the projectile sprite (theme-resolved by the runtime). */
  readonly assetRole?: string;
  /** World units per second. */
  readonly speed: number;
  readonly lifetimeMs: number;
  /** Display size in px (square). */
  readonly size?: number;
  /** How many targets it passes through before expiring. 0 = dies on first hit. */
  readonly pierce?: number;
  /** How many times it bounces off world bounds before expiring. */
  readonly bounce?: number;
  /** Damage applied to a hit combat entity. */
  readonly damage: number;
  /** Effects applied to the hit entity (Phase 2 `sw2d.items` effect union). */
  readonly onHitEffects?: readonly EffectDefinition[];
}

export interface WeaponDefinition {
  readonly id: string;
  readonly displayName: string;
  readonly projectile: ProjectileSpec;
  /** Minimum simulation time between shots (or between bursts). */
  readonly cooldownMs: number;
  readonly fireMode: FireMode;
  /** For `burst`: shots per trigger pull. Default 1. */
  readonly burstCount?: number;
  /** For `burst`: delay between the shots of one burst. Default 60. */
  readonly burstDelayMs?: number;
  /** Pellets per shot (a shotgun spread). Default 1. */
  readonly pelletCount?: number;
  /** Total spread cone in degrees, distributed across pellets and jittered deterministically. Default 0. */
  readonly spreadDeg?: number;
  /** Muzzle offset from the owner's origin, along the fire direction. Default 0. */
  readonly muzzleOffset?: number;
  /** Ammo capacity. Omit for infinite ammo. */
  readonly magazine?: number;
  /** Time to refill the magazine on `reload()`. Default 0 (instant). */
  readonly reloadMs?: number;
  /** Team/faction tag; a projectile never damages an entity on its own team. */
  readonly team: string;
}

export interface WeaponCatalog {
  readonly schemaVersion: number;
  readonly weapons: readonly WeaponDefinition[];
}

export interface FireRequest {
  readonly ownerId: string;
  readonly originX: number;
  readonly originY: number;
  /** Unit direction. The service normalises it. */
  readonly dirX: number;
  readonly dirY: number;
  /** Simulation time. Never the wall clock. */
  readonly nowMs: number;
}

export interface ProjectileSpawn {
  readonly x: number;
  readonly y: number;
  readonly vx: number;
  readonly vy: number;
  readonly damage: number;
  readonly team: string;
  readonly ownerId: string;
  readonly pierce: number;
  readonly bounce: number;
  readonly lifetimeMs: number;
  readonly assetRole: string | undefined;
  readonly size: number;
  readonly onHitEffects: readonly EffectDefinition[];
}

export interface FireResult {
  /** Whether the trigger produced any shots this call. */
  readonly fired: boolean;
  /** Projectiles to spawn now. `burst` weapons enqueue the rest; poll via `drain()`. */
  readonly spawns: readonly ProjectileSpawn[];
  /** Reason a fire request produced nothing, when `fired` is false. */
  readonly blockedBy?: 'cooldown' | 'no-ammo' | 'no-weapon' | 'reloading';
}

export interface WeaponOwnerState {
  readonly weaponId: string | null;
  readonly cooldownRemainingMs: number;
  /** Rounds left, or null for infinite. */
  readonly ammo: number | null;
  readonly reloading: boolean;
}

/** The slice of `combat.health` the projectile runtime needs. Avoids a runtime→packs dependency. */
export interface CombatDamageSink {
  has(entityId: string): boolean;
  damage(entityId: string, amount: number, nowMs: number): unknown;
}

export interface WeaponsService {
  lookup(weaponId: string): WeaponDefinition | undefined;
  definitionIds(): readonly string[];
  /** Assign a weapon to an owner (a player, an enemy). Resets that owner's cooldown/ammo. */
  equip(ownerId: string, weaponId: string): void;
  unequip(ownerId: string): void;
  ownerState(ownerId: string): WeaponOwnerState;
  /** Deterministic: same request + same prior state → same spawns. Respects cooldown, fire mode, ammo. */
  tryFire(request: FireRequest): FireResult;
  /** Begin a reload for the owner's weapon. No-op if full or no magazine. */
  reload(ownerId: string, nowMs: number): void;
  /**
   * Advance cooldowns, burst queues and reloads. Burst shots that come due are
   * buffered; the return value is those same shots, and `drainPendingSpawns()`
   * clears the buffer. The runtime bridge calls `drainPendingSpawns()` each
   * frame; the pack host calls `update()`. They must not both call `update()`.
   */
  update(deltaMs: number): readonly ProjectileSpawn[];
  /** Take and clear the buffered burst-continuation spawns. */
  drainPendingSpawns(): readonly ProjectileSpawn[];
}
