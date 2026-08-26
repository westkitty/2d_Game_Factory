import type { InstalledSystemPack, NormalizedLevel } from '@sw2d/contracts';
import { gridController, type SceneContext, type ScenePackDefinition } from '@sw2d/runtime';

/**
 * Generated starter shell: grid controller family.
 *
 * One discrete cell per physical press, no physics body - `gridController`
 * already guarantees at most one `step` per frame. See
 * platformShellPack.ts's file comment for the template pattern.
 */

const LEVEL_DOCUMENT = 'levels/main';
const CELL_SIZE = 32;

export const GAME_SPECIFIC_PACK: ScenePackDefinition = {
  id: 'game.grid-shell',
  version: '0.1.0',
  provides: [],
  dependencies: [],

  install(context: SceneContext): InstalledSystemPack {
    const scene = context.scene;
    const level = context.content.data[LEVEL_DOCUMENT]?.value as NormalizedLevel | undefined;
    const playerKey = context.assets.resolve('player');
    const { width, height } = context.definition.viewport;

    const spawn = level?.objects.find((object) => object.class === 'PlayerSpawn');
    let col = Math.round((spawn?.x ?? width * 0.5) / CELL_SIZE);
    let row = Math.round((spawn?.y ?? height * 0.5) / CELL_SIZE);
    const minCol = 0;
    const minRow = 0;
    const maxCol = Math.floor(width / CELL_SIZE) - 1;
    const maxRow = Math.floor(height / CELL_SIZE) - 1;

    const actor = scene.add.sprite(col * CELL_SIZE, row * CELL_SIZE, playerKey);

    const debugHandle = context.debug.contribute('game.grid-shell', () => ({ col, row }));

    let disposed = false;

    return {
      id: GAME_SPECIFIC_PACK.id,

      update(): void {
        if (disposed) return;
        const intent = gridController.read(context.input);
        if (intent.step === 'up' && row > minRow) row -= 1;
        else if (intent.step === 'down' && row < maxRow) row += 1;
        else if (intent.step === 'left' && col > minCol) col -= 1;
        else if (intent.step === 'right' && col < maxCol) col += 1;
        actor.setPosition(col * CELL_SIZE, row * CELL_SIZE);
      },

      dispose(): void {
        if (disposed) return;
        disposed = true;
        debugHandle.dispose();
        try {
          actor.destroy();
        } catch {
          /* scene already tearing down */
        }
      },
    };
  },
};
