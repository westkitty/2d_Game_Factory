import type { InstalledSystemPack, NormalizedLevel } from '@sw2d/contracts';
import { topDownController, ProjectilePool, type SceneContext, type ScenePackDefinition } from '@sw2d/runtime';

/**
 * Bullet Hell demo (Phase 8 representative demo 6/12).
 *
 * Smoke contract: movement, deterministic projectile pattern, survival/
 * clear condition, bounded projectile lifecycle, clean restart baseline.
 * The pattern is a fixed 8-directional radial burst on a fixed cadence -
 * no Math.random() anywhere (MASTER_PROJECT.md's determinism ethos, the
 * same reason simulation packs take deltaMs explicitly rather than reading
 * the wall clock).
 */

const LEVEL_DOCUMENT = 'levels/main';
const BURST_INTERVAL_MS = 1000;
const BULLETS_PER_BURST = 8;
const BULLET_SPEED = 160;
const SURVIVAL_TARGET_MS = 6000;

export const GAME_SPECIFIC_PACK: ScenePackDefinition = {
  id: 'game.top-down-shell',
  version: '0.1.0',
  provides: [],
  dependencies: [],

  install(context: SceneContext): InstalledSystemPack {
    const scene = context.scene;
    const level = context.content.data[LEVEL_DOCUMENT]?.value as NormalizedLevel | undefined;
    const { width, height } = context.definition.viewport;

    const spawn = level?.objects.find((object) => object.class === 'PlayerSpawn');
    const player = scene.physics.add.sprite(spawn?.x ?? width * 0.5, spawn?.y ?? height * 0.7, context.assets.resolve('player'));
    player.setCollideWorldBounds(true);
    player.body.setAllowGravity(false);

    const emitterX = width * 0.5;
    const emitterY = height * 0.25;
    const emitter = scene.add.sprite(emitterX, emitterY, context.assets.resolve('enemy'));

    const pool = new ProjectilePool({
      scene,
      textureKey: context.assets.resolve('hazard'),
      displaySize: 10,
      lifetimeMs: 2500,
      worldWidth: width,
      worldHeight: height,
    });

    let elapsedMs = 0;
    let sinceLastBurstMs = 0;
    let burstCount = 0;
    let hits = 0;
    let cleared = false;

    function fireBurst(): void {
      for (let i = 0; i < BULLETS_PER_BURST; i++) {
        // Deterministic angle sequence, not random - the same burst every run.
        const angle = (i / BULLETS_PER_BURST) * Math.PI * 2;
        const sprite = pool.spawn(emitterX, emitterY, Math.cos(angle) * BULLET_SPEED, Math.sin(angle) * BULLET_SPEED);
        scene.physics.add.overlap(player, sprite, () => {
          hits += 1;
          pool.remove(sprite);
        });
      }
      burstCount += 1;
    }

    const debugHandle = context.debug.contribute('game.top-down-shell', () => ({
      x: Math.round(player.x),
      y: Math.round(player.y),
      elapsedMs,
      burstCount,
      hits,
      projectilesLive: pool.liveCount,
      projectilesSpawned: pool.spawnedTotal,
      projectilesExpired: pool.expiredTotal,
      cleared,
    }));

    let disposed = false;

    return {
      id: GAME_SPECIFIC_PACK.id,

      update(deltaMs: number): void {
        if (disposed) return;
        elapsedMs += deltaMs;
        const intent = topDownController.read(context.input);
        player.setVelocity(intent.moveX * 200, intent.moveY * 200);

        sinceLastBurstMs += deltaMs;
        if (sinceLastBurstMs >= BURST_INTERVAL_MS) {
          sinceLastBurstMs -= BURST_INTERVAL_MS;
          fireBurst();
        }

        pool.update(deltaMs);

        if (!cleared && elapsedMs >= SURVIVAL_TARGET_MS) cleared = true;
      },

      dispose(): void {
        if (disposed) return;
        disposed = true;
        debugHandle.dispose();
        pool.dispose();
        try {
          player.destroy();
        } catch {
          /* scene already tearing down */
        }
        try {
          emitter.destroy();
        } catch {
          /* scene already tearing down */
        }
      },
    };
  },
};
