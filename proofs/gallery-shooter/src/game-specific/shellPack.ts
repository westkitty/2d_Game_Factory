import type Phaser from 'phaser';
import type { InstalledSystemPack } from '@sw2d/contracts';
import type { SceneContext, ScenePackDefinition } from '@sw2d/runtime';
import { CAPABILITY_IDS, type CombatService } from '@sw2d/packs';

/**
 * Phase 1 proof - gallery-shooter (see ../PROOF_CONTRACT.md).
 *
 * Exercises the reusable spatial interaction capability (ADR-0018):
 *
 * - `context.spatialPointer` gives the world-space cursor position, advanced
 *   once per frame by the runtime host.
 * - `context.interaction` registers three circular targets. A click is
 *   resolved against the world point, so the target the cursor is actually
 *   over is the one that takes the hit - not "the nearest", not "the last
 *   spawned".
 * - A full-viewport background target at the lowest priority catches clicks
 *   on empty space, proving an empty click does not select a real target.
 *
 * No spatial mechanic is reimplemented here: hit-testing, hover tracking and
 * pointer capture all belong to the shared service.
 */

interface TargetRecord {
  readonly id: string;
  alive: boolean;
}

const TARGETS: ReadonlyArray<{ id: string; x: number; y: number; radius: number }> = [
  { id: 'target-a', x: 240, y: 180, radius: 40 },
  { id: 'target-b', x: 480, y: 360, radius: 40 },
  { id: 'target-c', x: 720, y: 180, radius: 40 },
];

export const GAME_SPECIFIC_PACK: ScenePackDefinition = {
  id: 'game.pointer-shell',
  version: '0.1.0',
  provides: [],
  dependencies: [CAPABILITY_IDS.combat],

  install(context: SceneContext): InstalledSystemPack {
    const scene = context.scene;
    const key = context.assets.resolve('pickup');
    const combat = context.capabilities.require<CombatService>(CAPABILITY_IDS.combat);

    const records = new Map<string, TargetRecord>();
    const sprites = new Map<string, Phaser.GameObjects.Arc>();
    let hits = 0;
    let misses = 0;
    let lastHitId: string | null = null;
    let lastClickWorldX = 0;
    let lastClickWorldY = 0;

    for (const target of TARGETS) {
      const sprite = scene.add.circle(target.x, target.y, target.radius, 0x66ccff).setStrokeStyle(2, 0xffffff);
      // A themed sprite behind the hit disc, so this looks like the preset's art.
      scene.add.image(target.x, target.y, key).setDisplaySize(target.radius, target.radius).setDepth(-1);
      sprites.set(target.id, sprite);
      const record: TargetRecord = { id: target.id, alive: true };
      records.set(target.id, record);
      combat.register(target.id, 1);

      context.interaction.register({
        id: target.id,
        priority: 1,
        shape: { kind: 'circle', x: target.x, y: target.y, radius: target.radius },
        onHoverEnter: () => sprite.setFillStyle(0xffe14d),
        onHoverLeave: () => sprite.setFillStyle(0x66ccff),
        onClick: (info) => {
          if (!record.alive) return;
          record.alive = false;
          hits += 1;
          lastHitId = record.id;
          lastClickWorldX = Math.round(info.worldX);
          lastClickWorldY = Math.round(info.worldY);
          combat.damage(record.id, 1, 0);
          sprite.destroy();
          context.audio.playCue('ui.confirm');
        },
      });
    }

    // Lowest priority, whole viewport: an empty-space click lands here, never
    // on a real target.
    const { width, height } = context.definition.viewport;
    context.interaction.register({
      id: 'background',
      priority: -1,
      shape: { kind: 'rect', x: 0, y: 0, width, height },
      onClick: (info) => {
        misses += 1;
        lastHitId = null;
        lastClickWorldX = Math.round(info.worldX);
        lastClickWorldY = Math.round(info.worldY);
      },
    });

    const debugHandle = context.debug.contribute('game.pointer-shell', () => ({
      hits,
      misses,
      lastHitId,
      lastClickWorldX,
      lastClickWorldY,
      hoveredId: context.interaction.hoveredId,
      pointerWorldX: Math.round(context.spatialPointer.state.worldX),
      pointerWorldY: Math.round(context.spatialPointer.state.worldY),
      pointerActive: context.spatialPointer.state.active,
      targets: Object.fromEntries([...records.values()].map((r) => [r.id, { alive: r.alive }])),
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
        for (const id of records.keys()) {
          if (combat.has(id)) combat.remove(id);
        }
        for (const sprite of sprites.values()) {
          try {
            sprite.destroy();
          } catch {
            /* scene already tearing down */
          }
        }
      },
    };
  },
};
