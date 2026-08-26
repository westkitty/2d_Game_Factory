import Phaser from 'phaser';
import type { InstalledSystemPack, NormalizedLevel } from '@sw2d/contracts';
import { platformController, type SceneContext, type ScenePackDefinition } from '@sw2d/runtime';

/**
 * Generated starter shell: platform controller family.
 *
 * Copied verbatim by `sw2d new` for any preset whose primary controller
 * family is `platform` - this is the "bounded shared template per real
 * controller family" MASTER_PROJECT.md section 8 asks for, the same pattern
 * `starter/src/game-specific/placeholderMoverPack.ts` and `tiledLevelPack.ts`
 * already prove: the runtime is never edited, only this game-specific file
 * reads `platformController` intent and decides how the body moves.
 *
 * Edit this file freely - it lives in `src/game-specific/`, the part of a
 * generated game normal game work touches.
 */

const LEVEL_DOCUMENT = 'levels/main';

export const GAME_SPECIFIC_PACK: ScenePackDefinition = {
  id: 'game.platform-shell',
  version: '0.1.0',
  provides: [],
  dependencies: [],

  install(context: SceneContext): InstalledSystemPack {
    const scene = context.scene;
    const level = context.content.data[LEVEL_DOCUMENT]?.value as NormalizedLevel | undefined;
    const platformKey = context.assets.resolve('platform');
    const playerKey = context.assets.resolve('player');

    const ground = scene.physics.add.staticGroup();
    for (const solid of level?.solids ?? []) {
      const body = ground.create(solid.x + solid.width / 2, solid.y + solid.height / 2, platformKey) as Phaser.Physics.Arcade.Sprite;
      body.setDisplaySize(solid.width, solid.height);
      body.refreshBody();
    }

    const spawn = level?.objects.find((object) => object.class === 'PlayerSpawn');
    const { width, height } = context.definition.viewport;
    const spawnX = spawn?.x ?? width * 0.5;
    const spawnY = spawn?.y ?? height * 0.4;

    const player = scene.physics.add.sprite(spawnX, spawnY, playerKey);
    player.setCollideWorldBounds(true);
    player.body.setAllowGravity(true);
    player.setGravityY(1100);
    scene.physics.add.collider(player, ground);

    const debugHandle = context.debug.contribute('game.platform-shell', () => ({
      x: Math.round(player.x),
      y: Math.round(player.y),
      vx: Math.round(player.body.velocity.x),
      vy: Math.round(player.body.velocity.y),
      onGround: player.body.blocked.down,
    }));

    let disposed = false;

    return {
      id: GAME_SPECIFIC_PACK.id,

      update(): void {
        if (disposed) return;
        const intent = platformController.read(context.input);
        player.setVelocityX(intent.moveAxis * 220);
        if (intent.moveAxis !== 0) player.setFlipX(intent.moveAxis < 0);
        if (intent.jumpPressed && player.body.blocked.down) {
          player.setVelocityY(-430);
          context.audio.playCue('ui.confirm');
        }
      },

      dispose(): void {
        if (disposed) return;
        disposed = true;
        debugHandle.dispose();
        // A restart's batched stop+start can already have torn down this
        // scene's physics world by the time this runs - see
        // placeholderMoverPack.ts's own comment for the full story. Each
        // step is independently guarded for the same reason.
        try {
          player.destroy();
        } catch {
          /* scene already tearing down */
        }
        try {
          ground.clear(true, true);
          ground.destroy(true);
        } catch {
          /* scene already tearing down */
        }
      },
    };
  },
};
