import Phaser from 'phaser';
import type { InstalledSystemPack, NormalizedLevel } from '@sw2d/contracts';
import { topDownController, type SceneContext, type ScenePackDefinition } from '@sw2d/runtime';
import { CAPABILITY_IDS, type AiService, type WorldService } from '@sw2d/packs';

/**
 * Stealth Game demo (Phase 8 representative demo 5/12).
 *
 * Smoke contract: patrol/guard state, real detection/awareness condition,
 * objective reachable unseen, alarm/fail when detected. Detection is
 * honestly distance-based (a radius check), not a vision cone or noise
 * propagation - both are explicitly not implemented yet
 * (LIMITATIONS.stealthAi, packages/presets/src/shared.ts) - this demo does
 * not claim otherwise.
 */

const LEVEL_DOCUMENT = 'levels/main';
const GUARD_ID = 'guard-1';
const PATROL_LEFT_X = 460;
const PATROL_RIGHT_X = 560;
const PATROL_Y = 100;
const PATROL_SPEED = 40; // px/s
const DETECTION_RADIUS = 70;

export const GAME_SPECIFIC_PACK: ScenePackDefinition = {
  id: 'game.top-down-shell',
  version: '0.1.0',
  provides: [],
  dependencies: [CAPABILITY_IDS.ai, CAPABILITY_IDS.world],

  install(context: SceneContext): InstalledSystemPack {
    const scene = context.scene;
    const level = context.content.data[LEVEL_DOCUMENT]?.value as NormalizedLevel | undefined;
    const ai = context.capabilities.require<AiService>(CAPABILITY_IDS.ai);
    const world = context.capabilities.require<WorldService>(CAPABILITY_IDS.world);
    const { width, height } = context.definition.viewport;

    const spawn = level?.objects.find((object) => object.class === 'PlayerSpawn');
    const player = scene.physics.add.sprite(spawn?.x ?? width * 0.1, spawn?.y ?? height * 0.5, context.assets.resolve('player'));
    player.setCollideWorldBounds(true);
    player.body.setAllowGravity(false);

    const guard = scene.add.sprite(PATROL_LEFT_X, PATROL_Y, context.assets.resolve('enemy'));
    ai.register(GUARD_ID, 'patrol');
    let patrolDirection = 1;

    const exit = scene.physics.add.sprite(width * 0.94, spawn?.y ?? height * 0.5, context.assets.resolve('exit'));
    exit.body.setAllowGravity(false);
    exit.body.setImmovable(true);

    let alarmed = false;
    let objectiveReached = false;
    let reachedUnseen = false;

    scene.physics.add.overlap(player, exit, () => {
      if (objectiveReached) return;
      objectiveReached = true;
      if (!alarmed) reachedUnseen = true;
      world.setFlag('objective.exit-reached', true);
    });

    const debugHandle = context.debug.contribute('game.top-down-shell', () => ({
      x: Math.round(player.x),
      y: Math.round(player.y),
      guardX: Math.round(guard.x),
      guardState: ai.state(GUARD_ID),
      alarmed,
      objectiveReached,
      reachedUnseen,
    }));

    let disposed = false;

    return {
      id: GAME_SPECIFIC_PACK.id,

      update(deltaMs: number): void {
        if (disposed) return;
        const intent = topDownController.read(context.input);
        player.setVelocity(intent.moveX * 180, intent.moveY * 180);

        // Deterministic back-and-forth patrol - no pathfinding, no randomness.
        if (ai.state(GUARD_ID) === 'patrol') {
          guard.x += patrolDirection * PATROL_SPEED * (deltaMs / 1000);
          if (guard.x >= PATROL_RIGHT_X) patrolDirection = -1;
          else if (guard.x <= PATROL_LEFT_X) patrolDirection = 1;
        }

        const distance = Phaser.Math.Distance.Between(player.x, player.y, guard.x, guard.y);
        if (distance <= DETECTION_RADIUS && ai.state(GUARD_ID) === 'patrol') {
          ai.setState(GUARD_ID, 'chase');
          alarmed = true;
          world.setFlag('alarm.triggered', true);
        }
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
        try {
          guard.destroy();
        } catch {
          /* scene already tearing down */
        }
        try {
          exit.destroy();
        } catch {
          /* scene already tearing down */
        }
      },
    };
  },
};
