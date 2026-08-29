import type { AdvancedPhysicsService, InstalledSystemPack } from '@sw2d/contracts';
import { createAdvancedPhysics, mutedStyle, uiSimulationController, type SceneContext, type ScenePackDefinition } from '@sw2d/runtime';

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

    // Optional advanced physics (capability program Phase 9). Inert unless
    // content/game.json sets physicsProfile: 'matter'. Then a ball drops onto a
    // static floor through the reusable Matter-backed service; CONFIRM nudges
    // it. A full pinball table is game-specific code built on this.
    const physics: AdvancedPhysicsService | null = context.definition.physicsProfile === 'matter' ? createAdvancedPhysics(scene) : null;
    const ball = physics?.enabled
      ? (() => {
          physics.createBody({ id: 'table-floor', x: width * 0.5, y: height - 20, shape: { kind: 'rect', width, height: 24 }, static: true, category: 'terrain' });
          return physics.createBody({ id: 'ball', x: width * 0.5, y: 60, shape: { kind: 'circle', radius: 12 }, restitution: 0.7, category: 'prop' });
        })()
      : null;

    const label = scene.add
      .text(width * 0.5, height * 0.5, '', mutedStyle(20))
      .setOrigin(0.5)
      .setScrollFactor(0);

    function render(): void {
      const marker = confirmed ? '[confirmed] ' : '';
      label.setText(`${marker}< ${OPTIONS[selectionIndex]} >`);
    }
    render();

    const debugHandle = context.debug.contribute('game.ui-simulation-shell', () => ({
      selectionIndex,
      confirmed,
      ...(physics ? { physics: { enabled: physics.enabled, bodyCount: physics.bodyCount, ball: ball ? physics.bodyState(ball) : null } } : {}),
    }));

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
          if (physics && ball) physics.applyImpulse(ball, 0, -140);
        }
      },

      dispose(): void {
        if (disposed) return;
        disposed = true;
        debugHandle.dispose();
        physics?.dispose();
        try {
          label.destroy();
        } catch {
          /* scene already tearing down */
        }
      },
    };
  },
};
