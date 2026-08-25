import Phaser from 'phaser';
import type { InstalledSystemPack } from '@sw2d/contracts';
import type { SceneContext, ScenePackDefinition } from '@sw2d/runtime';

/**
 * Game-specific extension: a controllable placeholder actor.
 *
 * This lives in the *game*, not the runtime, and that is the whole point of the
 * file. It proves three boundaries at once:
 *
 *   1. a game can add real behaviour without editing @sw2d/runtime;
 *   2. SystemPackDefinition/InstalledSystemPack is a working contract, not a
 *      speculative interface;
 *   3. gameplay reads semantic actions only - it never sees a key code, so the
 *      same code is driven by keyboard and by the on-screen touch buttons.
 *
 * Real platform movement (coyote time, jump buffering, variable jump height,
 * double jump) belongs to the platform controller family in Phase 3. This is
 * deliberately the minimum that proves the wiring.
 */
export interface PlaceholderMoverConfig {
  readonly moveSpeed: number;
  readonly dashMultiplier: number;
  readonly jumpVelocity: number;
  readonly gravity: number;
}

const DEFAULT_CONFIG: PlaceholderMoverConfig = {
  moveSpeed: 220,
  dashMultiplier: 1.75,
  jumpVelocity: -430,
  gravity: 1100,
};

export const PLACEHOLDER_MOVER_PACK: ScenePackDefinition<Partial<PlaceholderMoverConfig>> = {
  id: 'starter.placeholder-mover',
  version: '0.1.0',
  provides: ['starter.player'],
  dependencies: [],
  // Declared now, enforced by the validator Sonnet builds in Phase 2.
  configSchemaId: 'starter/placeholder-mover.config.json',

  install(context: SceneContext, config): InstalledSystemPack {
    const settings: PlaceholderMoverConfig = { ...DEFAULT_CONFIG, ...config };
    const scene = context.scene;
    const { width, height } = context.definition.viewport;

    const platformKey = context.assets.resolve('platform');
    const playerKey = context.assets.resolve('player');

    const ground = scene.physics.add.staticGroup();
    const addPlatform = (x: number, y: number, tiles: number): void => {
      const platform = ground.create(x, y, platformKey) as Phaser.Physics.Arcade.Sprite;
      platform.setScale(tiles, 1).refreshBody();
    };
    addPlatform(width / 2, height - 24, width / 64 + 1);
    addPlatform(width * 0.24, height * 0.66, 3);
    addPlatform(width * 0.72, height * 0.52, 3);

    const player = scene.physics.add.sprite(width * 0.5, height * 0.4, playerKey);
    player.setCollideWorldBounds(true);
    // Per-body gravity: a pack must never mutate world-level physics state that
    // another pack also depends on.
    player.body.setAllowGravity(true);
    player.setGravityY(settings.gravity);

    const collider = scene.physics.add.collider(player, ground);

    const debugHandle = context.debug.contribute('starter.player', () => ({
      x: Math.round(player.x),
      y: Math.round(player.y),
      vx: Math.round(player.body.velocity.x),
      vy: Math.round(player.body.velocity.y),
      onGround: player.body.blocked.down,
    }));

    let disposed = false;

    return {
      id: PLACEHOLDER_MOVER_PACK.id,

      update(): void {
        if (disposed) return;
        const input = context.input;
        const direction = input.axis('MOVE_LEFT', 'MOVE_RIGHT');
        const speed =
          settings.moveSpeed * (input.isDown('DASH') ? settings.dashMultiplier : 1);

        player.setVelocityX(direction * speed);
        if (direction !== 0) player.setFlipX(direction < 0);

        // Claimed, not merely read: the CONFIRM that started the run must not
        // also make the player jump on the first frame of gameplay.
        const wantsJump = input.consumePress('JUMP') || input.consumePress('CONFIRM');
        if (wantsJump && player.body.blocked.down) {
          player.setVelocityY(settings.jumpVelocity);
          context.audio.playCue('ui.confirm');
        }
      },

      dispose(): void {
        if (disposed) return;
        disposed = true;
        debugHandle.dispose();
        scene.physics.world.removeCollider(collider);
        player.destroy();
        ground.clear(true, true);
        ground.destroy(true);
      },
    };
  },
};
