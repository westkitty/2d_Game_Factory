import type {
  EffectDefinition,
  EventBus,
  FireRequest,
  FireResult,
  GameContext,
  InstalledSystemPack,
  ProjectileSpawn,
  SystemPackDefinition,
  WeaponCatalog,
  WeaponDefinition,
  WeaponOwnerState,
  WeaponsService,
} from '@sw2d/contracts';
import { CAPABILITY_IDS, PACK_IDS } from '../ids.ts';

/**
 * Weapons pack: the reusable weapon/projectile *model* (capability program
 * Phase 3), publishing `combat.weapons`. Renderer-neutral - it owns cooldown,
 * fire mode, burst timing, spread and ammo, and turns a fire request into a
 * deterministic list of `ProjectileSpawn`s. `@sw2d/runtime`'s
 * `createProjectileRuntime` renders those spawns and resolves collisions
 * through `combat.health`. Bullet-pattern choreography is Phase 4.
 */

export class UnknownWeaponError extends Error {
  constructor(weaponId: string) {
    super(`No weapon defined with id "${weaponId}" in content/weapons.json.`);
    this.name = 'UnknownWeaponError';
  }
}

interface BurstEntry {
  remaining: number;
  delayRemainingMs: number;
  readonly origin: { x: number; y: number };
  readonly dir: { x: number; y: number };
  readonly ownerId: string;
  readonly weapon: WeaponDefinition;
}

interface OwnerState {
  weapon: WeaponDefinition | null;
  cooldownRemainingMs: number;
  ammo: number | null;
  reloadRemainingMs: number;
}

function normalise(x: number, y: number): { x: number; y: number } {
  const length = Math.hypot(x, y);
  return length === 0 ? { x: 1, y: 0 } : { x: x / length, y: y / length };
}

function rotate(v: { x: number; y: number }, radians: number): { x: number; y: number } {
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return { x: v.x * cos - v.y * sin, y: v.x * sin + v.y * cos };
}

class WeaponsServiceImpl implements WeaponsService {
  readonly #defs = new Map<string, WeaponDefinition>();
  readonly #owners = new Map<string, OwnerState>();
  readonly #bursts: BurstEntry[] = [];
  #pending: ProjectileSpawn[] = [];
  readonly #events: EventBus;

  constructor(events: EventBus, catalog: WeaponCatalog | undefined) {
    this.#events = events;
    for (const def of catalog?.weapons ?? []) {
      if (this.#defs.has(def.id)) throw new Error(`Duplicate weapon id "${def.id}" in content/weapons.json.`);
      this.#defs.set(def.id, def);
    }
  }

  lookup(weaponId: string): WeaponDefinition | undefined {
    return this.#defs.get(weaponId);
  }

  definitionIds(): readonly string[] {
    return [...this.#defs.keys()].sort();
  }

  equip(ownerId: string, weaponId: string): void {
    const weapon = this.#defs.get(weaponId);
    if (!weapon) throw new UnknownWeaponError(weaponId);
    this.#owners.set(ownerId, {
      weapon,
      cooldownRemainingMs: 0,
      ammo: weapon.magazine ?? null,
      reloadRemainingMs: 0,
    });
  }

  unequip(ownerId: string): void {
    this.#owners.delete(ownerId);
    for (let i = this.#bursts.length - 1; i >= 0; i--) {
      if (this.#bursts[i]!.ownerId === ownerId) this.#bursts.splice(i, 1);
    }
  }

  ownerState(ownerId: string): WeaponOwnerState {
    const state = this.#owners.get(ownerId);
    if (!state || !state.weapon) return { weaponId: null, cooldownRemainingMs: 0, ammo: null, reloading: false };
    return {
      weaponId: state.weapon.id,
      cooldownRemainingMs: state.cooldownRemainingMs,
      ammo: state.ammo,
      reloading: state.reloadRemainingMs > 0,
    };
  }

  tryFire(request: FireRequest): FireResult {
    const state = this.#owners.get(request.ownerId);
    if (!state || !state.weapon) return { fired: false, spawns: [], blockedBy: 'no-weapon' };
    if (state.reloadRemainingMs > 0) return { fired: false, spawns: [], blockedBy: 'reloading' };
    if (state.cooldownRemainingMs > 0) return { fired: false, spawns: [], blockedBy: 'cooldown' };
    if (state.ammo !== null && state.ammo <= 0) return { fired: false, spawns: [], blockedBy: 'no-ammo' };

    const weapon = state.weapon;
    const dir = normalise(request.dirX, request.dirY);
    const origin = {
      x: request.originX + dir.x * (weapon.muzzleOffset ?? 0),
      y: request.originY + dir.y * (weapon.muzzleOffset ?? 0),
    };

    state.cooldownRemainingMs = weapon.cooldownMs;
    if (state.ammo !== null) {
      state.ammo -= 1;
      this.#events.emit('weapons:ammoChanged', { ownerId: request.ownerId, ammo: state.ammo });
    }

    const spawns = this.#shotSpawns(weapon, request.ownerId, origin, dir);

    if (weapon.fireMode === 'burst' && (weapon.burstCount ?? 1) > 1) {
      this.#bursts.push({
        remaining: (weapon.burstCount ?? 1) - 1,
        delayRemainingMs: weapon.burstDelayMs ?? 60,
        origin,
        dir,
        ownerId: request.ownerId,
        weapon,
      });
    }

    this.#events.emit('weapons:fired', { ownerId: request.ownerId, weaponId: weapon.id, shots: spawns.length });
    return { fired: true, spawns };
  }

  reload(ownerId: string): void {
    const state = this.#owners.get(ownerId);
    if (!state || !state.weapon || state.weapon.magazine === undefined) return;
    if (state.ammo === state.weapon.magazine || state.reloadRemainingMs > 0) return;
    state.reloadRemainingMs = Math.max(1, state.weapon.reloadMs ?? 0);
    if ((state.weapon.reloadMs ?? 0) === 0) {
      state.ammo = state.weapon.magazine;
      state.reloadRemainingMs = 0;
      this.#events.emit('weapons:ammoChanged', { ownerId, ammo: state.ammo });
    }
  }

  update(deltaMs: number): readonly ProjectileSpawn[] {
    for (const state of this.#owners.values()) {
      if (state.cooldownRemainingMs > 0) state.cooldownRemainingMs = Math.max(0, state.cooldownRemainingMs - deltaMs);
      if (state.reloadRemainingMs > 0) {
        state.reloadRemainingMs = Math.max(0, state.reloadRemainingMs - deltaMs);
        if (state.reloadRemainingMs === 0 && state.weapon?.magazine !== undefined) {
          state.ammo = state.weapon.magazine;
        }
      }
    }
    const due: ProjectileSpawn[] = [];
    for (let i = this.#bursts.length - 1; i >= 0; i--) {
      const burst = this.#bursts[i]!;
      burst.delayRemainingMs -= deltaMs;
      while (burst.delayRemainingMs <= 0 && burst.remaining > 0) {
        due.push(...this.#shotSpawns(burst.weapon, burst.ownerId, burst.origin, burst.dir));
        burst.remaining -= 1;
        burst.delayRemainingMs += burst.weapon.burstDelayMs ?? 60;
      }
      if (burst.remaining <= 0) this.#bursts.splice(i, 1);
    }
    if (due.length > 0) this.#pending.push(...due);
    return due;
  }

  drainPendingSpawns(): readonly ProjectileSpawn[] {
    if (this.#pending.length === 0) return [];
    const out = this.#pending;
    this.#pending = [];
    return out;
  }

  #shotSpawns(
    weapon: WeaponDefinition,
    ownerId: string,
    origin: { x: number; y: number },
    dir: { x: number; y: number },
  ): ProjectileSpawn[] {
    const pellets = Math.max(1, weapon.pelletCount ?? 1);
    const spreadRad = ((weapon.spreadDeg ?? 0) * Math.PI) / 180;
    const p = weapon.projectile;
    const spawns: ProjectileSpawn[] = [];
    for (let i = 0; i < pellets; i++) {
      // Deterministic even fan: pellet 0..n-1 mapped to [-spread/2, +spread/2].
      const t = pellets === 1 ? 0.5 : i / (pellets - 1);
      const angle = spreadRad * (t - 0.5);
      const d = rotate(dir, angle);
      spawns.push({
        x: origin.x,
        y: origin.y,
        vx: d.x * p.speed,
        vy: d.y * p.speed,
        damage: p.damage,
        team: weapon.team,
        ownerId,
        pierce: p.pierce ?? 0,
        bounce: p.bounce ?? 0,
        lifetimeMs: p.lifetimeMs,
        assetRole: p.assetRole,
        size: p.size ?? 8,
        onHitEffects: (p.onHitEffects ?? []) as readonly EffectDefinition[],
      });
    }
    return spawns;
  }
}

export const weaponsPack: SystemPackDefinition<undefined, GameContext> = {
  id: PACK_IDS.weapons,
  version: '0.1.0',
  provides: [CAPABILITY_IDS.weapons],
  dependencies: [CAPABILITY_IDS.combat],

  install(context: GameContext): InstalledSystemPack {
    const catalog = context.content.data['weapons']?.value as WeaponCatalog | undefined;
    const service = new WeaponsServiceImpl(context.events, catalog);
    const handle = context.capabilities.provide(CAPABILITY_IDS.weapons, service);
    return {
      id: PACK_IDS.weapons,
      update(deltaMs: number): void {
        // Queued burst shots that come due are rendered by the runtime bridge,
        // which polls `update()` itself; the host tick here keeps cooldowns and
        // reloads advancing even when nothing is firing.
        service.update(deltaMs);
      },
      dispose(): void {
        handle.dispose();
      },
    };
  },
};

export type { WeaponsService } from '@sw2d/contracts';
