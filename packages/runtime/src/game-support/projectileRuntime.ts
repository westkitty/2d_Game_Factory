import type Phaser from 'phaser';
import type {
  CombatDamageSink,
  FireRequest,
  FireResult,
  ItemsService,
  ProjectileSpawn,
  WeaponsService,
} from '@sw2d/contracts';

/**
 * Runtime bridge for the `sw2d.weapons` model (capability program Phase 3).
 *
 * The renderer-coupled half of weapons/projectiles - the same reason
 * `ProjectilePool` lives here and not in `@sw2d/packs`. It renders the
 * deterministic `ProjectileSpawn`s the `WeaponsService` produces, resolves
 * collisions against target groups through `combat.health`, honours pierce
 * and bounce, and applies on-hit effects through `sw2d.items` when present.
 * A game-specific shell wires `fire()` to input and `update()` to its step;
 * `sw2d.weapons`' own pack host advances cooldowns/reload/burst timing.
 */

export interface ProjectileRuntimeOptions {
  readonly scene: Phaser.Scene;
  readonly weapons: WeaponsService;
  readonly combat: CombatDamageSink;
  readonly items?: Pick<ItemsService, 'applyEffects'>;
  readonly worldWidth: number;
  readonly worldHeight: number;
  /** Resolve a projectile's asset role (or undefined) to a texture key. */
  readonly resolveTexture: (assetRole: string | undefined) => string;
  /** Candidate target sprites, grouped. */
  readonly targetGroups: readonly Phaser.GameObjects.Group[];
  /** Map a hit sprite to its combat entity id and team, or null if not a target. */
  readonly resolveTarget: (sprite: Phaser.GameObjects.GameObject) => { entityId: string; team: string } | null;
}

interface LiveProjectile {
  readonly sprite: Phaser.Physics.Arcade.Sprite;
  readonly team: string;
  readonly ownerId: string;
  readonly damage: number;
  pierceLeft: number;
  bounceLeft: number;
  remainingMs: number;
  readonly onHitEffects: ProjectileSpawn['onHitEffects'];
  readonly hit: Set<string>;
  readonly overlaps: Phaser.Physics.Arcade.Collider[];
}

export interface ProjectileRuntime {
  fire(request: FireRequest): FireResult;
  /** Advance projectile lifetimes, bounces and out-of-bounds; spawn any due burst shots. */
  update(deltaMs: number, nowMs: number): void;
  readonly liveCount: number;
  readonly spawnedTotal: number;
  readonly expiredTotal: number;
  readonly hitsResolved: number;
  readonly overlapFires: number;
  dispose(): void;
}

export function createProjectileRuntime(options: ProjectileRuntimeOptions): ProjectileRuntime {
  const { scene } = options;
  // No physics Group: adding a moving sprite to an Arcade Group applies the
  // group's body defaults and zeroes its velocity. Projectiles are tracked in
  // `live` and collided per-sprite, the shape `ProjectilePool` already proves.
  const live = new Map<Phaser.GameObjects.GameObject, LiveProjectile>();
  let spawnedTotal = 0;
  let expiredTotal = 0;
  let hitsResolved = 0;
  let overlapFires = 0;
  let disposed = false;

  function removeProjectile(sprite: Phaser.GameObjects.GameObject): void {
    const record = live.get(sprite);
    if (!record) return;
    live.delete(sprite);
    for (const collider of record.overlaps) {
      try {
        scene.physics.world.removeCollider(collider);
      } catch {
        /* scene already tearing down */
      }
    }
    try {
      (sprite as Phaser.GameObjects.Sprite).destroy();
    } catch {
      /* scene already tearing down */
    }
    expiredTotal += 1;
  }

  function onHit(projectileObj: Phaser.GameObjects.GameObject, targetObj: Phaser.GameObjects.GameObject): void {
    overlapFires += 1;
    const projectile = live.get(projectileObj);
    if (!projectile) return;
    const target = options.resolveTarget(targetObj);
    if (!target || target.team === projectile.team) return;
    if (projectile.hit.has(target.entityId)) return;
    if (!options.combat.has(target.entityId)) return;

    projectile.hit.add(target.entityId);
    options.combat.damage(target.entityId, projectile.damage, nowMsRef.value);
    if (projectile.onHitEffects.length > 0 && options.items) {
      options.items.applyEffects(projectile.onHitEffects, { combatTargetId: target.entityId, nowMs: nowMsRef.value });
    }
    hitsResolved += 1;

    if (projectile.pierceLeft <= 0) removeProjectile(projectileObj);
    else projectile.pierceLeft -= 1;
  }

  const nowMsRef = { value: 0 };

  function spawn(s: ProjectileSpawn): void {
    const sprite = scene.physics.add.sprite(s.x, s.y, options.resolveTexture(s.assetRole));
    sprite.setDisplaySize(s.size, s.size);
    (sprite.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);
    if (s.bounce > 0) sprite.setBounce(1, 1).setCollideWorldBounds(true);
    sprite.setVelocity(s.vx, s.vy);
    // A per-projectile overlap against each target group - the same shape the
    // proven demos use, robust to groups populated after construction.
    const overlaps = options.targetGroups.map((targetGroup) =>
      scene.physics.add.overlap(sprite, targetGroup, (proj, tgt) =>
        onHit(proj as Phaser.GameObjects.GameObject, tgt as Phaser.GameObjects.GameObject),
      ),
    );
    live.set(sprite, {
      sprite,
      team: s.team,
      ownerId: s.ownerId,
      damage: s.damage,
      pierceLeft: s.pierce,
      bounceLeft: s.bounce,
      remainingMs: s.lifetimeMs,
      onHitEffects: s.onHitEffects,
      hit: new Set(),
      overlaps,
    });
    spawnedTotal += 1;
  }

  return {
    fire(request: FireRequest): FireResult {
      if (disposed) return { fired: false, spawns: [], blockedBy: 'no-weapon' };
      nowMsRef.value = request.nowMs;
      const result = options.weapons.tryFire(request);
      for (const s of result.spawns) spawn(s);
      return result;
    },

    update(deltaMs: number, nowMs: number): void {
      if (disposed) return;
      nowMsRef.value = nowMs;
      for (const s of options.weapons.drainPendingSpawns()) spawn(s);
      for (const [obj, projectile] of [...live]) {
        projectile.remainingMs -= deltaMs;
        const { x, y } = projectile.sprite;
        const margin = 48;
        const oob = x < -margin || x > options.worldWidth + margin || y < -margin || y > options.worldHeight + margin;
        // A bounce keeps the projectile alive; only a real out-of-world escape
        // (bounce budget spent) or ttl expiry removes it.
        if (projectile.remainingMs <= 0 || !projectile.sprite.active || (oob && projectile.bounceLeft <= 0)) {
          removeProjectile(obj);
        }
      }
    },

    get liveCount(): number {
      return live.size;
    },
    get spawnedTotal(): number {
      return spawnedTotal;
    },
    get expiredTotal(): number {
      return expiredTotal;
    },
    get hitsResolved(): number {
      return hitsResolved;
    },
    get overlapFires(): number {
      return overlapFires;
    },

    dispose(): void {
      if (disposed) return;
      disposed = true;
      for (const projectile of live.values()) {
        for (const collider of projectile.overlaps) {
          try {
            scene.physics.world.removeCollider(collider);
          } catch {
            /* scene already tearing down */
          }
        }
        try {
          projectile.sprite.destroy();
        } catch {
          /* scene already tearing down */
        }
      }
      live.clear();
    },
  };
}
