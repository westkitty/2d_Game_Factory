import type {
  EncounterDefinition,
  EncounterService,
  EncounterSpawnRequest,
  EncounterUpdateContext,
  EventBus,
  WeaponsService,
} from '@sw2d/contracts';
import type { ProjectileRuntime } from './projectileRuntime.ts';

/**
 * Runtime bridge for the `sw2d.encounters` model (capability program Phase 4).
 *
 * Renderer-adjacent glue only: it builds the `EncounterUpdateContext` from live
 * game state, materialises spawn requests through a game-supplied
 * `spawnEnemy` callback, and fires declarative bullet patterns through Phase
 * 3's `createProjectileRuntime`. Phase transitions (boss invulnerability
 * windows, flags) are applied here from the encounter's own definition.
 */

export interface SpawnedEnemyHandle {
  readonly entityId: string;
  /** Current world position of the spawned entity. */
  pos(): readonly [number, number];
}

export interface EncounterRuntimeOptions {
  readonly encounters: EncounterService;
  readonly weapons: WeaponsService;
  readonly projectiles: ProjectileRuntime;
  readonly events: EventBus;
  readonly viewport: { readonly width: number; readonly height: number };
  /** Player world position, for `aimed` patterns. */
  playerPos(): readonly [number, number];
  /** 0..1 health fraction for `entity-health-below` conditions. */
  healthFraction(entityId: string): number;
  /** World-flag read for `flag` conditions. */
  flag(name: string): boolean;
  /** Set a world flag when a phase's `onEnterFlag` fires. */
  setFlag(name: string, value: boolean): void;
  /** Make an entity invulnerable for `ms` when a phase's `onEnterInvulnMs` fires. */
  setInvulnerable(entityId: string, ms: number, nowMs: number): void;
  /** Origin for phase-level (boss) emitters. Defaults to top-centre of the viewport. */
  bossOrigin?(): readonly [number, number];
  /** Create the game object for a spawn request, or null to skip it. */
  spawnEnemy(request: EncounterSpawnRequest): SpawnedEnemyHandle | null;
}

export interface EncounterRuntime {
  start(encounterId: string): void;
  update(deltaMs: number, nowMs: number): void;
  readonly completed: boolean;
  readonly liveEnemyCount: number;
  readonly bulletsFired: number;
  dispose(): void;
}

function unit(fromX: number, fromY: number, toX: number, toY: number): readonly [number, number] {
  const dx = toX - fromX;
  const dy = toY - fromY;
  const len = Math.hypot(dx, dy);
  return len === 0 ? [1, 0] : [dx / len, dy / len];
}

export function createEncounterRuntime(options: EncounterRuntimeOptions): EncounterRuntime {
  const spawned = new Map<string, SpawnedEnemyHandle>();
  const entityToRequest = new Map<string, string>();
  let bulletsFired = 0;
  let disposed = false;
  let def: EncounterDefinition | undefined;

  const onDeath = options.events.on('combat:entityDied', ({ entityId }) => {
    const requestId = entityToRequest.get(entityId);
    if (!requestId) return;
    entityToRequest.delete(entityId);
    spawned.delete(requestId);
    options.encounters.reportDeath(requestId);
  });

  const ctx: EncounterUpdateContext = {
    aimAt: (sx, sy) => {
      const [px, py] = options.playerPos();
      return unit(sx, sy, px, py);
    },
    healthFraction: (id) => options.healthFraction(id),
    flag: (name) => options.flag(name),
    originOf: (requestId) => spawned.get(requestId)?.pos() ?? null,
    bossOrigin: () => options.bossOrigin?.() ?? [options.viewport.width / 2, 40],
    viewport: () => options.viewport,
  };

  return {
    start(encounterId: string): void {
      def = options.encounters.lookup(encounterId);
      options.encounters.start(encounterId);
    },

    update(deltaMs: number, nowMs: number): void {
      if (disposed) return;
      const tick = options.encounters.update(deltaMs, ctx);

      for (const request of tick.spawns) {
        const handle = options.spawnEnemy(request);
        if (!handle) continue;
        spawned.set(request.requestId, handle);
        entityToRequest.set(handle.entityId, request.requestId);
      }

      for (const fire of tick.fires) {
        const weapon = options.weapons.lookup(fire.weaponId);
        if (!weapon) continue;
        const p = weapon.projectile;
        for (const [dx, dy] of fire.dirs) {
          options.projectiles.spawnRaw({
            x: fire.originX,
            y: fire.originY,
            vx: dx * p.speed,
            vy: dy * p.speed,
            damage: p.damage,
            team: weapon.team,
            ownerId: fire.sourceRequestId ?? 'encounter',
            pierce: p.pierce ?? 0,
            bounce: p.bounce ?? 0,
            lifetimeMs: p.lifetimeMs,
            assetRole: p.assetRole,
            size: p.size ?? 8,
            onHitEffects: p.onHitEffects ?? [],
          });
          bulletsFired += 1;
        }
      }

      if (tick.enteredPhaseId && def) {
        const phase = def.phases.find((ph) => ph.id === tick.enteredPhaseId);
        if (phase?.onEnterFlag) options.setFlag(phase.onEnterFlag.flag, phase.onEnterFlag.value);
        if (phase?.onEnterInvulnMs && def.bossEntityId) {
          options.setInvulnerable(def.bossEntityId, phase.onEnterInvulnMs, nowMs);
        }
      }
    },

    get completed(): boolean {
      return options.encounters.state().completed;
    },
    get liveEnemyCount(): number {
      return spawned.size;
    },
    get bulletsFired(): number {
      return bulletsFired;
    },

    dispose(): void {
      if (disposed) return;
      disposed = true;
      onDeath.dispose();
      options.encounters.stop();
      spawned.clear();
      entityToRequest.clear();
    },
  };
}
