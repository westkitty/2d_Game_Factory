import type Phaser from 'phaser';

/**
 * A small, bounded projectile-lifecycle helper: spawn a moving sprite,
 * advance it, expire it after a fixed lifetime or when it leaves the
 * world bounds, dispose cleanly.
 *
 * Demo-support code (MASTER_PROJECT.md section 13), not a promoted
 * `@sw2d/packs` capability: `twin-stick-shooter`, `bullet-hell` and
 * `tower-defense` all need substantially this same shape (the
 * three-consumer trigger section 15 names), but none needs persistence, a
 * config schema, or a capability id - copying this ~90-line file three
 * times is the smaller, more honest choice for Phase 8's smoke demos.
 * Recorded for Phase 9 Opus to review whether promotion is now warranted:
 * see docs/architecture/PHASE8_OPUS_GATE_B_HANDOFF.md.
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
