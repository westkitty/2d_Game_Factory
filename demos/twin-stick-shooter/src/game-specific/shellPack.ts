import type { InstalledSystemPack, NormalizedLevel } from '@sw2d/contracts';
import { topDownController, ProjectilePool, type SceneContext, type ScenePackDefinition } from '@sw2d/runtime';
import { CAPABILITY_IDS, type CombatService } from '@sw2d/packs';

/**
 * Twin-Stick Shooter demo (Phase 8 representative demo 4/12).
 *
 * Smoke contract: independent movement and aim, primary action fires a
 * projectile, target takes damage, score/clear feedback. Movement
 * (moveX/moveY) and aim (aimX/aimY) are genuinely independent controller
 * fields (Phase 8's AIM_LEFT/RIGHT/UP/DOWN addition to TopDownIntent - see
 * packages/contracts/src/controllers.ts) - not "last move direction"
 * standing in for aim.
 */

const LEVEL_DOCUMENT = 'levels/main';
const TARGET_ID = 'target-1';
const TARGET_MAX_HEALTH = 30;
const PROJECTILE_DAMAGE = 10;
const PROJECTILE_SPEED = 420;

export const GAME_SPECIFIC_PACK: ScenePackDefinition = {
  id: 'game.top-down-shell',
  version: '0.1.0',
  provides: [],
  dependencies: [CAPABILITY_IDS.combat],

  install(context: SceneContext): InstalledSystemPack {
    const scene = context.scene;
    const level = context.content.data[LEVEL_DOCUMENT]?.value as NormalizedLevel | undefined;
    const combat = context.capabilities.require<CombatService>(CAPABILITY_IDS.combat);
    const { width, height } = context.definition.viewport;

    const spawn = level?.objects.find((object) => object.class === 'PlayerSpawn');
    const spawnX = spawn?.x ?? width * 0.3;
    const spawnY = spawn?.y ?? height * 0.5;
    const player = scene.physics.add.sprite(spawnX, spawnY, context.assets.resolve('player'));
    player.setCollideWorldBounds(true);
    player.body.setAllowGravity(false);

    // Same y as the player's spawn: a purely horizontal aim (the smoke
    // proof's shot) only needs to line up with *something* real, not with
    // wherever the player happens to have moved to.
    const target = scene.physics.add.sprite(width * 0.85, spawnY, context.assets.resolve('enemy'));
    target.body.setAllowGravity(false);
    target.body.setImmovable(true);
    combat.register(TARGET_ID, TARGET_MAX_HEALTH);

    const pool = new ProjectilePool({
      scene,
      textureKey: context.assets.resolve('pickup'),
      displaySize: 8,
      lifetimeMs: 2000,
      worldWidth: width,
      worldHeight: height,
    });

    let score = 0;
    let cleared = false;
    let elapsedMs = 0;

    const debugHandle = context.debug.contribute('game.top-down-shell', () => ({
      x: Math.round(player.x),
      y: Math.round(player.y),
      targetHealth: combat.has(TARGET_ID) ? combat.get(TARGET_ID).current : 0,
      projectilesLive: pool.liveCount,
      projectilesSpawned: pool.spawnedTotal,
      projectilesExpired: pool.expiredTotal,
      score,
      cleared,
    }));

    let disposed = false;

    return {
      id: GAME_SPECIFIC_PACK.id,

      update(deltaMs: number): void {
        if (disposed) return;
        elapsedMs += deltaMs;
        const intent = topDownController.read(context.input);
        const moveSpeed = 200;
        player.setVelocity(intent.moveX * moveSpeed, intent.moveY * moveSpeed);

        if (intent.primaryPressed && intent.aimMagnitude > 0) {
          const projectile = pool.spawn(player.x, player.y, intent.aimX * PROJECTILE_SPEED, intent.aimY * PROJECTILE_SPEED);
          scene.physics.add.overlap(projectile, target, () => {
            if (cleared || !combat.has(TARGET_ID)) return;
            const health = combat.damage(TARGET_ID, PROJECTILE_DAMAGE, elapsedMs);
            score += 1;
            pool.remove(projectile);
            if (health.current <= 0) {
              cleared = true;
              combat.remove(TARGET_ID);
              target.destroy();
            }
          });
        }

        pool.update(deltaMs);
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
          target.destroy();
        } catch {
          /* scene already tearing down */
        }
      },
    };
  },
};
