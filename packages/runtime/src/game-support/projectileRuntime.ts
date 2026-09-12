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
 * Runtime bridge for the `sw2d.weapons` model (capability program Phase 3;
 * pooled since the Final Product Completion program, Wave 3 - matrix L12).
 *
 * The renderer-coupled half of weapons/projectiles - the same reason
 * `ProjectilePool` lives here and not in `@sw2d/packs`. It renders the
 * deterministic `ProjectileSpawn`s the `WeaponsService` produces, resolves
 * collisions against target groups through `combat.health`, honours pierce
 * and bounce, and applies on-hit effects through `sw2d.items` when present.
 * A game-specific shell wires `fire()` to input and `update()` to its step;
 * `sw2d.weapons`' own pack host advances cooldowns/reload/burst timing.
 *
 * Pooling: a projectile that expires is parked (inactive, invisible, body
 * disabled - its overlap colliders stay registered and skip disabled bodies)
 * and the next spawn reuses it, so a bullet-hell pattern that emits and
 * retires hundreds of bullets a second allocates sprites and colliders only
 * up to its peak, never per bullet. `tools/scripts/qa-bullet-budget.ts`
 * measures the resulting live-bullet budget on the target desktop browser.
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
  /** Flat damage added to projectiles by owner (a run loadout's damage bonus). Default 0. */
  readonly damageBonusFor?: (ownerId: string) => number;
  /** Live play-area bounds (a scrolling camera); defaults to (0, 0, worldWidth, worldHeight). */
  readonly bounds?: () => { readonly x: number; readonly y: number; readonly width: number; readonly height: number };
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
  /** Spawn one projectile directly from a fully-resolved spec (used by encounter fire patterns). */
  spawnRaw(spec: ProjectileSpawn): void;
  /** Advance projectile lifetimes, bounces and out-of-bounds; spawn any due burst shots. */
  update(deltaMs: number, nowMs: number): void;
  readonly liveCount: number;
  readonly spawnedTotal: number;
  readonly expiredTotal: number;
  readonly hitsResolved: number;
  readonly overlapFires: number;
  /** Pool statistics: sprites ever allocated (the peak), spawns served from the pool, and the current parked count. */
  readonly poolAllocated: number;
  readonly poolReused: number;
  readonly poolFree: number;
  dispose(): void;
}

export function createProjectileRuntime(options: ProjectileRuntimeOptions): ProjectileRuntime {
  const { scene } = options;
  // No physics Group: adding a moving sprite to an Arcade Group applies the
  // group's body defaults and zeroes its velocity. Projectiles are tracked in
  // `live` and collided per-sprite, the shape `ProjectilePool` already proves.
  const live = new Map<Phaser.GameObjects.GameObject, LiveProjectile>();
  /** Parked sprites (with their persistent overlap colliders) ready for reuse. */
  const free: { sprite: Phaser.Physics.Arcade.Sprite; overlaps: Phaser.Physics.Arcade.Collider[] }[] = [];
  let spawnedTotal = 0;
  let expiredTotal = 0;
  let hitsResolved = 0;
  let overlapFires = 0;
  let poolAllocated = 0;
  let poolReused = 0;
  let disposed = false;

  function removeProjectile(sprite: Phaser.GameObjects.GameObject): void {
    const record = live.get(sprite);
    if (!record) return;
    live.delete(sprite);
    expiredTotal += 1;
    // Park, do not destroy: the sprite and its colliders are reused by the
    // next spawn. A disabled body takes no part in overlap checks.
    try {
      const parked = record.sprite;
      parked.setVelocity(0, 0);
      parked.setActive(false).setVisible(false);
      (parked.body as Phaser.Physics.Arcade.Body).enable = false;
      free.push({ sprite: parked, overlaps: record.overlaps });
    } catch {
      /* scene already tearing down */
    }
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
    const texture = options.resolveTexture(s.assetRole);
    let sprite: Phaser.Physics.Arcade.Sprite;
    let overlaps: Phaser.Physics.Arcade.Collider[];
    const parked = free.pop();
    if (parked) {
      sprite = parked.sprite;
      overlaps = parked.overlaps;
      poolReused += 1;
      if (sprite.texture.key !== texture) sprite.setTexture(texture);
      const body = sprite.body as Phaser.Physics.Arcade.Body;
      body.enable = true;
      sprite.setActive(true).setVisible(true);
      body.reset(s.x, s.y);
    } else {
      sprite = scene.physics.add.sprite(s.x, s.y, texture);
      poolAllocated += 1;
      (sprite.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);
      // A per-projectile overlap against each target group - the same shape the
      // proven demos use, robust to groups populated after construction. The
      // colliders live as long as the pooled sprite does.
      overlaps = options.targetGroups.map((targetGroup) =>
        scene.physics.add.overlap(sprite, targetGroup, (proj, tgt) =>
          onHit(proj as Phaser.GameObjects.GameObject, tgt as Phaser.GameObjects.GameObject),
        ),
      );
    }
    sprite.setDisplaySize(s.size, s.size);
    if (s.bounce > 0) sprite.setBounce(1, 1).setCollideWorldBounds(true);
    else sprite.setBounce(0, 0).setCollideWorldBounds(false);
    sprite.setVelocity(s.vx, s.vy);
    live.set(sprite, {
      sprite,
      team: s.team,
      ownerId: s.ownerId,
      damage: s.damage + (options.damageBonusFor?.(s.ownerId) ?? 0),
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
    spawnRaw(spec: ProjectileSpawn): void {
      if (!disposed) spawn(spec);
    },

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
        const b = options.bounds?.() ?? { x: 0, y: 0, width: options.worldWidth, height: options.worldHeight };
        const oob = x < b.x - margin || x > b.x + b.width + margin || y < b.y - margin || y > b.y + b.height + margin;
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
    get poolAllocated(): number {
      return poolAllocated;
    },
    get poolReused(): number {
      return poolReused;
    },
    get poolFree(): number {
      return free.length;
    },

    dispose(): void {
      if (disposed) return;
      disposed = true;
      const everything = [...[...live.values()].map((p) => ({ sprite: p.sprite, overlaps: p.overlaps })), ...free];
      for (const projectile of everything) {
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
      free.length = 0;
    },
  };
}
