import type Phaser from 'phaser';

/**
 * A small, bounded projectile-lifecycle helper: spawn a moving sprite,
 * advance it, expire it after a fixed lifetime or when it leaves the world
 * bounds, dispose cleanly.
 *
 * Promoted in Phase 9 (Gate B) from three byte-identical copies under
 * `demos/{twin-stick-shooter,bullet-hell,tower-defense}/src/game-specific/`.
 * The promotion argument is semantic stability, not line count: three
 * independent consumers arrived at the *same* interface with zero divergence
 * (only construction arguments differed), and Phase 10's twin-stick arena and
 * tower-defense micro-map add two more. Deferring again would have meant five
 * copies of an interface already proven stable.
 *
 * Deliberately **game support, not a system pack**. It has no capability id,
 * no `configSchemaId`, no install order, and no persistence, because the
 * things a `sw2d.projectiles` *capability* would have to decide - pooling
 * policy, collision integration, whether damage-on-hit is first-class or
 * caller-wired - are still undiscovered. Promoting the proven ~100 lines
 * without promoting the unproven semantics is the bounded move; this is not a
 * weapon framework and must not grow into one. A consumer still wires its own
 * overlap/damage callbacks exactly as the three demos already do.
 *
 * It lives beside the controllers rather than in `@sw2d/packs` for a hard
 * reason: it manipulates Phaser sprites and Arcade bodies, and every
 * `@sw2d/packs` core is renderer-independent by contract. Putting it in
 * `packages/packs` would have broken that invariant.
 */

export interface ProjectileOptions {
  readonly scene: Phaser.Scene;
  readonly textureKey: string;
  readonly displaySize: number;
  readonly lifetimeMs: number;
  readonly worldWidth: number;
  readonly worldHeight: number;
}

interface LiveProjectile {
  readonly sprite: Phaser.Physics.Arcade.Sprite;
  remainingMs: number;
}

export class ProjectilePool {
  readonly #scene: Phaser.Scene;
  readonly #textureKey: string;
  readonly #displaySize: number;
  readonly #lifetimeMs: number;
  readonly #worldWidth: number;
  readonly #worldHeight: number;
  readonly #live: LiveProjectile[] = [];
  #spawnedTotal = 0;
  #expiredTotal = 0;

  constructor(options: ProjectileOptions) {
    this.#scene = options.scene;
    this.#textureKey = options.textureKey;
    this.#displaySize = options.displaySize;
    this.#lifetimeMs = options.lifetimeMs;
    this.#worldWidth = options.worldWidth;
    this.#worldHeight = options.worldHeight;
  }

  spawn(x: number, y: number, vx: number, vy: number): Phaser.Physics.Arcade.Sprite {
    const sprite = this.#scene.physics.add.sprite(x, y, this.#textureKey);
    sprite.setDisplaySize(this.#displaySize, this.#displaySize);
    sprite.body.setAllowGravity(false);
    sprite.setVelocity(vx, vy);
    this.#live.push({ sprite, remainingMs: this.#lifetimeMs });
    this.#spawnedTotal += 1;
    return sprite;
  }

  /** Advance lifetimes and expire anything past its ttl or out of the world bounds. Call once per update(). */
  update(deltaMs: number): void {
    for (let i = this.#live.length - 1; i >= 0; i--) {
      const projectile = this.#live[i]!;
      projectile.remainingMs -= deltaMs;
      const { x, y } = projectile.sprite;
      const outOfBounds = x < -32 || x > this.#worldWidth + 32 || y < -32 || y > this.#worldHeight + 32;
      if (projectile.remainingMs <= 0 || outOfBounds || !projectile.sprite.active) {
        projectile.sprite.destroy();
        this.#live.splice(i, 1);
        this.#expiredTotal += 1;
      }
    }
  }

  /** Remove one projectile immediately (e.g. on hit) - counts as expired, not leaked. */
  remove(sprite: Phaser.Physics.Arcade.Sprite): void {
    const index = this.#live.findIndex((p) => p.sprite === sprite);
    if (index === -1) return;
    this.#live[index]!.sprite.destroy();
    this.#live.splice(index, 1);
    this.#expiredTotal += 1;
  }

  get liveCount(): number {
    return this.#live.length;
  }

  get spawnedTotal(): number {
    return this.#spawnedTotal;
  }

  get expiredTotal(): number {
    return this.#expiredTotal;
  }

  dispose(): void {
    for (const projectile of this.#live) {
      try {
        projectile.sprite.destroy();
      } catch {
        /* scene already tearing down */
      }
    }
    this.#live.length = 0;
  }
}
