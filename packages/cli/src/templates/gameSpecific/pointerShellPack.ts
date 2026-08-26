import type { InstalledSystemPack } from '@sw2d/contracts';
import { pointerActionController, type SceneContext, type ScenePackDefinition } from '@sw2d/runtime';

/**
 * Generated starter shell: pointer controller family.
 *
 * `pointerActionController` is press-style only - no cursor coordinates,
 * hover or drag exist yet (spatial pointer remains deferred, see
 * docs/architecture/ARCHITECTURE_OVERVIEW.md). This shell proves the real
 * capability honestly: a primary press toggles a target's highlighted
 * state and counts activations. See platformShellPack.ts's file comment
 * for the template pattern.
 */

export const GAME_SPECIFIC_PACK: ScenePackDefinition = {
  id: 'game.pointer-shell',
  version: '0.1.0',
  provides: [],
  dependencies: [],

  install(context: SceneContext): InstalledSystemPack {
    const scene = context.scene;
    const targetKey = context.assets.resolve('pickup');
    const { width, height } = context.definition.viewport;

    const target = scene.add.sprite(width * 0.5, height * 0.5, targetKey);
    target.setScale(3);

    let activations = 0;
    let highlighted = false;

    const debugHandle = context.debug.contribute('game.pointer-shell', () => ({ activations, highlighted }));

    let disposed = false;

    return {
      id: GAME_SPECIFIC_PACK.id,

      update(): void {
        if (disposed) return;
        const intent = pointerActionController.read(context.input);
        if (intent.primaryPressed) {
          activations += 1;
          highlighted = !highlighted;
          target.setTint(highlighted ? 0xffe14d : 0xffffff);
          context.audio.playCue('ui.confirm');
        }
      },

      dispose(): void {
        if (disposed) return;
        disposed = true;
        debugHandle.dispose();
        try {
          target.destroy();
        } catch {
          /* scene already tearing down */
        }
      },
    };
  },
};
