import type { AdvancedPhysicsService, InstalledSystemPack } from '@sw2d/contracts';
import {
  bindStarterDialogue,
  createAdvancedPhysics,
  pointerActionController,
  type SceneContext,
  type ScenePackDefinition,
} from '@sw2d/runtime';

/**
 * Generated starter shell: pointer controller family.
 *
 * The reusable spatial interaction capability (ADR-0018) is what a pointer
 * game is built on: `context.spatialPointer` gives the world-space cursor,
 * and `context.interaction` owns hit-testing, hover tracking and pointer
 * capture. This shell registers one world-space target and lets the service
 * resolve hover and click against the actual cursor position - no
 * cursor/hover/hit-test code is reimplemented here.
 *
 * When `sw2d.dialogue` is installed in adventure mode (Category-C Wave 3)
 * the dummy target is replaced by authored hotspots that start conversations.
 *
 * Press-style semantic actions (`pointerActionController`) are still
 * available for menu-style confirms; this shell demonstrates the spatial
 * layer because that is the part a pointer game cannot fake. See
 * platformShellPack.ts's file comment for the template pattern.
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
    const centre = { x: width * 0.5, y: height * 0.5, radius: 48 };

    const dialogue = bindStarterDialogue(context);

    let activations = 0;
    let highlighted = false;
    let hovered = false;

    const target = dialogue.active
      ? null
      : scene.add.image(centre.x, centre.y, targetKey);
    target?.setDisplaySize(centre.radius * 2, centre.radius * 2);

    const hotspotSprites: { id: string; image: ReturnType<typeof scene.add.image>; handle: { dispose(): void } }[] = [];
    if (dialogue.active) {
      for (const hotspot of dialogue.snapshot().hotspots) {
        const image = scene.add.image(hotspot.x, hotspot.y, targetKey);
        image.setDisplaySize(56, 56);
        if (hotspot.locked) image.setAlpha(0.35);
        const handle = context.interaction.register({
          id: hotspot.id,
          shape: { kind: 'circle', x: hotspot.x, y: hotspot.y, radius: 28 },
          onHoverEnter: () => {
            image.setTint(0xbfe1ff);
          },
          onHoverLeave: () => {
            image.clearTint();
          },
          onClick: () => {
            dialogue.start(hotspot.conversationId);
            for (const entry of hotspotSprites) {
              const live = dialogue.snapshot().hotspots.find((h) => h.id === entry.id);
              entry.image.setAlpha(live?.locked ? 0.35 : 1);
            }
          },
        });
        hotspotSprites.push({ id: hotspot.id, image, handle });
      }
    }

    // Optional advanced physics (capability program Phase 9). Inert unless
    // content/game.json sets physicsProfile: 'matter'. Then a demo rigid body
    // rests on a static floor and a click nudges it, all through the reusable
    // Matter-backed service - no raw Matter here.
    const physics: AdvancedPhysicsService | null = context.definition.physicsProfile === 'matter' ? createAdvancedPhysics(scene) : null;
    const demoBody = physics?.enabled
      ? (() => {
          physics.createBody({ id: 'floor', x: width * 0.5, y: height - 24, shape: { kind: 'rect', width, height: 32 }, static: true, category: 'terrain' });
          return physics.createBody({ id: 'ball', x: width * 0.5, y: 80, shape: { kind: 'circle', radius: 20 }, restitution: 0.6, category: 'prop' });
        })()
      : null;

    const handle = target
      ? context.interaction.register({
          id: 'target',
          shape: { kind: 'circle', x: centre.x, y: centre.y, radius: centre.radius },
          onHoverEnter: () => {
            hovered = true;
            target.setTint(0xbfe1ff);
          },
          onHoverLeave: () => {
            hovered = false;
            if (!highlighted) target.clearTint();
          },
          onClick: () => {
            activations += 1;
            highlighted = !highlighted;
            target.setTint(highlighted ? 0xffe14d : hovered ? 0xbfe1ff : 0xffffff);
            context.audio.playCue('ui.confirm');
            if (physics && demoBody) physics.applyImpulse(demoBody, 0, -180);
          },
        })
      : null;

    const debugHandle = context.debug.contribute('game.pointer-shell', () => ({
      activations,
      highlighted,
      hovered,
      hoveredId: context.interaction.hoveredId,
      pointerWorldX: Math.round(context.spatialPointer.state.worldX),
      pointerWorldY: Math.round(context.spatialPointer.state.worldY),
      ...(dialogue.active ? { dialogue: dialogue.snapshot() } : {}),
      ...(physics
        ? {
            physics: {
              enabled: physics.enabled,
              bodyCount: physics.bodyCount,
              ball: demoBody ? physics.bodyState(demoBody) : null,
            },
          }
        : {}),
    }));

    let disposed = false;

    return {
      id: GAME_SPECIFIC_PACK.id,

      update(): void {
        if (disposed || !dialogue.active) return;
        const intent = pointerActionController.read(context.input);
        if (intent.confirmPressed) {
          if (dialogue.snapshot().kind === 'choice') dialogue.choose();
          else dialogue.advance();
        }
        dialogue.render();
      },

      dispose(): void {
        if (disposed) return;
        disposed = true;
        debugHandle.dispose();
        handle?.dispose();
        for (const entry of hotspotSprites) {
          entry.handle.dispose();
          try {
            entry.image.destroy();
          } catch {
            /* scene already tearing down */
          }
        }
        dialogue.dispose();
        physics?.dispose();
        try {
          target?.destroy();
        } catch {
          /* scene already tearing down */
        }
      },
    };
  },
};
