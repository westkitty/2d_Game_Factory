import type Phaser from 'phaser';
import type { InstalledSystemPack } from '@sw2d/contracts';
import { phaserBoundsShape, type SceneContext, type ScenePackDefinition } from '@sw2d/runtime';

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
        keySprite.setPosition(chestPos.x, chestPos.y);
        chest.setFillStyle(0x66ff88);
        context.audio.playCue('ui.confirm');
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
    }));

    let disposed = false;

    return {
      id: GAME_SPECIFIC_PACK.id,

      update(): void {
        /* All behaviour is event-driven through the interaction service. */
      },

      dispose(): void {
        if (disposed) return;
        disposed = true;
        debugHandle.dispose();
        for (const object of [lever, chest, keySprite] as Phaser.GameObjects.GameObject[]) {
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
