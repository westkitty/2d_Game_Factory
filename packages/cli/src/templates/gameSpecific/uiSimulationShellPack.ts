import type { InstalledSystemPack } from '@sw2d/contracts';
import { mutedStyle, uiSimulationController, type SceneContext, type ScenePackDefinition } from '@sw2d/runtime';

/**
 * Generated starter shell: ui-simulation controller family.
 *
 * A menu-style selection loop - `navigateLeft`/`navigateRight` cycle a
 * fixed option list, `confirm` locks one in. No canvas movement, matching
 * this controller family's own contract (menu-style navigation and
 * mode-changing intent only). See platformShellPack.ts's file comment for
 * the template pattern.
 */

const OPTIONS = ['Option A', 'Option B', 'Option C', 'Option D'];

export const GAME_SPECIFIC_PACK: ScenePackDefinition = {
  id: 'game.ui-simulation-shell',
  version: '0.1.0',
  provides: [],
  dependencies: [],

  install(context: SceneContext): InstalledSystemPack {
    const scene = context.scene;
    const { width, height } = context.definition.viewport;

    let selectionIndex = 0;
    let confirmed = false;

    const label = scene.add
      .text(width * 0.5, height * 0.5, '', mutedStyle(20))
      .setOrigin(0.5)
      .setScrollFactor(0);

    function render(): void {
      const marker = confirmed ? '[confirmed] ' : '';
      label.setText(`${marker}< ${OPTIONS[selectionIndex]} >`);
    }
    render();

    const debugHandle = context.debug.contribute('game.ui-simulation-shell', () => ({ selectionIndex, confirmed }));

    let disposed = false;

    return {
      id: GAME_SPECIFIC_PACK.id,

      update(): void {
        if (disposed) return;
        const intent = uiSimulationController.read(context.input);
        if (intent.navigateLeftPressed) {
          selectionIndex = (selectionIndex - 1 + OPTIONS.length) % OPTIONS.length;
          confirmed = false;
          render();
        } else if (intent.navigateRightPressed) {
          selectionIndex = (selectionIndex + 1) % OPTIONS.length;
          confirmed = false;
          render();
        } else if (intent.confirmPressed) {
          confirmed = true;
          context.audio.playCue('ui.confirm');
          render();
        }
      },

      dispose(): void {
        if (disposed) return;
        disposed = true;
        debugHandle.dispose();
        try {
          label.destroy();
        } catch {
          /* scene already tearing down */
        }
      },
    };
  },
};
