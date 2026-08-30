import type Phaser from 'phaser';
import {
  DIALOGUE_CAPABILITY_ID,
  type DialogueService,
  type InstalledSystemPack,
} from '@sw2d/contracts';
import { CAPABILITY_IDS, type WorldService } from '@sw2d/packs';
import {
  createDialogueOverlay,
  phaserBoundsShape,
  uiSimulationController,
  type SceneContext,
  type ScenePackDefinition,
} from '@sw2d/runtime';

/**
 * Phase 1 proof - point-and-click (see ../PROOF_CONTRACT.md).
 *
 * Exercises the hover / click / drag / drop side of the reusable spatial
 * interaction capability (ADR-0018):
 *
 * - a lever whose hover state tracks the cursor (enter/leave) and whose click
 *   pulls it;
 * - a key the player drags; its live bounds are the hit shape
 *   (`phaserBoundsShape`), so it stays grabbable as it moves;
 * - a chest drop-zone that resolves the drop and reports which target it
 *   received.
 *
 * The service owns hit-testing, hover bookkeeping and pointer capture during
 * the drag - none of it is reimplemented here.
 *
 * ## Post-ten Phase 20
 *
 * The Phase-1 objects above are unchanged. Phase 20 adds a fourth: clicking the
 * warden opens a real dialogue, a choice in it sets a world flag, and the chest
 * reads that flag **when the key is later dropped into it**. That last part is
 * the point - a consequence that only shows up in a world interaction some time
 * after the conversation ended is the thing a dialogue system has to be able to
 * produce, and the thing a fake one cannot.
 */

export const GAME_SPECIFIC_PACK: ScenePackDefinition = {
  id: 'game.pointer-shell',
  version: '0.1.0',
  provides: [],
  dependencies: [],

  install(context: SceneContext): InstalledSystemPack {
    const scene = context.scene;
    const key = context.assets.resolve('pickup');
    const player = context.assets.resolve('player');

    const leverPos = { x: 200, y: 270 };
    const chestPos = { x: 760, y: 270 };
    const keyStart = { x: 480, y: 400 };

    const lever = scene.add.rectangle(leverPos.x, leverPos.y, 48, 96, 0x8899aa).setStrokeStyle(2, 0xffffff);
    const chest = scene.add.rectangle(chestPos.x, chestPos.y, 96, 96, 0x5a4632).setStrokeStyle(2, 0xffe14d);
    const keySprite = scene.add.image(keyStart.x, keyStart.y, key).setDisplaySize(40, 40).setDepth(5);
    scene.add.image(leverPos.x, leverPos.y - 70, player).setDisplaySize(48, 48).setDepth(-1);

    let leverHovered = false;
    let leverPulled = false;
    let keyInChest = false;

    // --- Post-ten Phase 20 ---
    const dialogue = context.capabilities.require<DialogueService>(DIALOGUE_CAPABILITY_ID);
    const world = context.capabilities.require<WorldService>(CAPABILITY_IDS.world);
    const wardenPos = { x: 480, y: 180 };
    const warden = scene.add.rectangle(wardenPos.x, wardenPos.y, 56, 96, 0x44507a).setStrokeStyle(2, 0xbcd0ff);
    const overlay = createDialogueOverlay(scene.game.canvas.parentElement ?? document.body, dialogue, {
      resolvePortrait: (assetRole) => {
        try {
          return scene.textures.getBase64(context.assets.resolve(assetRole as 'player'));
        } catch {
          return null;
        }
      },
      reducedMotion: () => context.accessibility.reducedMotion,
    });
    /** Whether the chest was blessed at the moment the key went in, not later. */
    let blessedOnDrop: boolean | null = null;

    context.interaction.register({
      id: 'lever',
      priority: 1,
      shape: { kind: 'rect', x: leverPos.x - 24, y: leverPos.y - 48, width: 48, height: 96 },
      onHoverEnter: () => {
        leverHovered = true;
        lever.setFillStyle(0xffe14d);
      },
      onHoverLeave: () => {
        leverHovered = false;
        lever.setFillStyle(0x8899aa);
      },
      onClick: () => {
        leverPulled = true;
        lever.setFillStyle(0x66ff88);
        context.audio.playCue('ui.confirm');
      },
    });

    context.interaction.register({
      id: 'key',
      priority: 5,
      shape: phaserBoundsShape(keySprite),
      onDragStart: () => keySprite.setTint(0xffe14d),
      onDrag: (info) => keySprite.setPosition(info.worldX, info.worldY),
      onDragEnd: (info) => {
        keySprite.clearTint();
        if (info.dropTargetId !== 'chest') {
          keySprite.setPosition(keyStart.x, keyStart.y); // snap back on a miss
        }
      },
    });

    context.interaction.register({
      id: 'chest',
      priority: 0,
      dropZone: true,
      shape: { kind: 'rect', x: chestPos.x - 48, y: chestPos.y - 48, width: 96, height: 96 },
      onDrop: (info) => {
        if (info.sourceId !== 'key') return;
        keyInChest = true;
        // The consequence of a conversation that ended some time ago, observed
        // by an ordinary world interaction.
        blessedOnDrop = world.hasFlag('chest-blessed');
        keySprite.setPosition(chestPos.x, chestPos.y);
        chest.setFillStyle(0x66ff88);
        context.audio.playCue('ui.confirm');
      },
    });

    context.interaction.register({
      id: 'warden',
      priority: 2,
      shape: { kind: 'rect', x: wardenPos.x - 28, y: wardenPos.y - 48, width: 56, height: 96 },
      onHoverEnter: () => warden.setFillStyle(0x6d7cb8),
      onHoverLeave: () => warden.setFillStyle(0x44507a),
      onClick: () => {
        // A world click opens the conversation. The shell chooses *when*; the
        // capability owns everything about what happens inside it.
        dialogue.start('warden-greets');
        overlay.refresh();
      },
    });

    const debugHandle = context.debug.contribute('game.pointer-shell', () => ({
      leverHovered,
      leverPulled,
      keyInChest,
      hoveredId: context.interaction.hoveredId,
      draggingId: context.interaction.draggingId,
      keyX: Math.round(keySprite.x),
      keyY: Math.round(keySprite.y),
      pointerWorldX: Math.round(context.spatialPointer.state.worldX),
      pointerWorldY: Math.round(context.spatialPointer.state.worldY),
      // Post-ten Phase 20 surface.
      dialogue: dialogue.view(),
      dialogueChoices: dialogue.availableChoices(),
      dialogueButtons: [...overlay.root.querySelectorAll('[data-sw2d-choice]')].map(
        (node) => (node as HTMLElement).dataset['sw2dChoice'] ?? '',
      ),
      dialogueText: overlay.root.querySelector('[data-sw2d-dialogue="text"]')?.textContent ?? '',
      dialogueRevealing: overlay.isRevealing,
      reducedMotion: context.accessibility.reducedMotion,
      chestBlessed: world.hasFlag('chest-blessed'),
      blessedOnDrop,
    }));

    let disposed = false;

    return {
      id: GAME_SPECIFIC_PACK.id,

      update(deltaMs: number): void {
        /* Interaction behaviour is event-driven; only the reveal needs a frame. */
        overlay.tick(deltaMs);
        // This preset's controller families include `ui-simulation`, so CONFIRM
        // is the ordinary way to advance a line - the same wire the visual-novel
        // proof uses, not a second mechanism for the same job.
        const intent = uiSimulationController.read(context.input);
        if (intent.confirmPressed) overlay.advance();
      },

      dispose(): void {
        if (disposed) return;
        disposed = true;
        debugHandle.dispose();
        overlay.dispose();
        for (const object of [lever, chest, keySprite, warden] as Phaser.GameObjects.GameObject[]) {
          try {
            object.destroy();
          } catch {
            /* scene already tearing down */
          }
        }
      },
    };
  },
};
