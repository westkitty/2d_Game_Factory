import type { InstalledSystemPack, NormalizedLevel } from '@sw2d/contracts';
import { topDownController, type SceneContext, type ScenePackDefinition } from '@sw2d/runtime';

/**
 * Generated starter shell: top-down controller family.
 *
 * See platformShellPack.ts's file comment for the pattern this follows -
 * copied verbatim by `sw2d new`, edited freely afterward.
 */

const LEVEL_DOCUMENT = 'levels/main';

export const GAME_SPECIFIC_PACK: ScenePackDefinition = {
  id: 'game.top-down-shell',
  version: '0.1.0',
  provides: [],
  dependencies: [],

  install(context: SceneContext): InstalledSystemPack {
    const scene = context.scene;
    const level = context.content.data[LEVEL_DOCUMENT]?.value as NormalizedLevel | undefined;
    const playerKey = context.assets.resolve('player');
    const { width, height } = context.definition.viewport;

    const spawn = level?.objects.find((object) => object.class === 'PlayerSpawn');
    const spawnX = spawn?.x ?? width * 0.5;
    const spawnY = spawn?.y ?? height * 0.5;

    const player = scene.physics.add.sprite(spawnX, spawnY, playerKey);
    player.setCollideWorldBounds(true);
    player.body.setAllowGravity(false);

    const debugHandle = context.debug.contribute('game.top-down-shell', () => ({
      x: Math.round(player.x),
      y: Math.round(player.y),
      vx: Math.round(player.body.velocity.x),
      vy: Math.round(player.body.velocity.y),
    }));

    let disposed = false;

    return {
      id: GAME_SPECIFIC_PACK.id,

      update(): void {
        if (disposed) return;
        const intent = topDownController.read(context.input);
        const speed = 200;
        player.setVelocityX(intent.moveX * speed);
        player.setVelocityY(intent.moveY * speed);
      },

      dispose(): void {
        if (disposed) return;
        disposed = true;
        debugHandle.dispose();
        try {
          player.destroy();
        } catch {
          /* scene already tearing down */
        }
      },
    };
  },
};
