import type { InstalledSystemPack, NormalizedLevel, PerceptionService, NavService } from '@sw2d/contracts';
import { topDownController, createPerceptionRuntime, type SceneContext, type ScenePackDefinition } from '@sw2d/runtime';
import { CAPABILITY_IDS, type AiService, type WorldService } from '@sw2d/packs';

const LEVEL_DOCUMENT = 'levels/main';
const GUARD_ID = 'guard-1';
const SENSOR_ID = 'guard-sensor';
const PATROL_LEFT_X = 380;
const PATROL_RIGHT_X = 580;
const PATROL_Y = 200;
const PATROL_SPEED = 50;

// Wall geometry that blocks line of sight
const WALL = {
  left: 240,
  right: 280,
  top: 120,
  bottom: 280,
};

// Hiding shadow zone
const HIDING_ZONE = {
  left: 80,
  right: 160,
  top: 260,
  bottom: 360,
};

function lineIntersectsWall(x1: number, y1: number, x2: number, y2: number): boolean {
  // Check if line segment intersects the wall rectangle
  const minX = Math.min(x1, x2);
  const maxX = Math.max(x1, x2);
  const minY = Math.min(y1, y2);
  const maxY = Math.max(y1, y2);

  if (maxX < WALL.left || minX > WALL.right || maxY < WALL.top || minY > WALL.bottom) {
    return false;
  }

  // Sample along segment
  const steps = 20;
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const px = x1 + (x2 - x1) * t;
    const py = y1 + (y2 - y1) * t;
    if (px >= WALL.left && px <= WALL.right && py >= WALL.top && py <= WALL.bottom) {
      return true;
    }
  }
  return false;
}

export const GAME_SPECIFIC_PACK: ScenePackDefinition = {
  id: 'game.top-down-shell',
  version: '0.1.0',
  provides: [],
  dependencies: [
    CAPABILITY_IDS.ai,
    CAPABILITY_IDS.world,
    CAPABILITY_IDS.navigation,
    CAPABILITY_IDS.aiPerception,
  ],

  install(context: SceneContext): InstalledSystemPack {
    const scene = context.scene;
    const level = context.content.data[LEVEL_DOCUMENT]?.value as NormalizedLevel | undefined;
    const ai = context.capabilities.require<AiService>(CAPABILITY_IDS.ai);
    const world = context.capabilities.require<WorldService>(CAPABILITY_IDS.world);
    const nav = context.capabilities.require<NavService>(CAPABILITY_IDS.navigation);
    const perception = context.capabilities.require<PerceptionService>(CAPABILITY_IDS.aiPerception);
    const { width } = context.definition.viewport;

    // Set up basic navigation grid
    nav.defineGrid('stealth-nav', {
      cols: 30,
      rows: 17,
      cellSize: 32,
    });

    const spawn = level?.objects.find((object) => object.class === 'PlayerSpawn');
    const player = scene.physics.add.sprite(
      spawn?.x ?? 100,
      spawn?.y ?? 440,
      context.assets.resolve('player'),
    );
    player.setCollideWorldBounds(true);
    player.body.setAllowGravity(false);

    // Wall visual
    const wallRect = scene.add.rectangle(
      (WALL.left + WALL.right) / 2,
      (WALL.top + WALL.bottom) / 2,
      WALL.right - WALL.left,
      WALL.bottom - WALL.top,
      0x444455,
    );

    // Hiding spot visual
    const hidingRect = scene.add.rectangle(
      (HIDING_ZONE.left + HIDING_ZONE.right) / 2,
      (HIDING_ZONE.top + HIDING_ZONE.bottom) / 2,
      HIDING_ZONE.right - HIDING_ZONE.left,
      HIDING_ZONE.bottom - HIDING_ZONE.top,
      0x223322,
      0.6,
    );

    const guard = scene.add.sprite(PATROL_LEFT_X, PATROL_Y, context.assets.resolve('enemy'));
    ai.register(GUARD_ID, 'patrol');
    let patrolDir = 1;

    // Register target with perception
    perception.registerTarget({ id: 'player' });

    // Runtime bridge for perception
    const perceptionRuntime = createPerceptionRuntime({
      perception,
      getSensorTransform: (sensorId) => {
        if (sensorId === SENSOR_ID) {
          return {
            x: guard.x,
            y: guard.y,
            facingX: patrolDir,
            facingY: 0,
          };
        }
        return undefined;
      },
      getTargetTransform: (targetId) => {
        if (targetId === 'player') {
          return { x: player.x, y: player.y };
        }
        return undefined;
      },
      isOccluded: (fromX, fromY, toX, toY) => {
        return lineIntersectsWall(fromX, fromY, toX, toY);
      },
    });

    const exit = scene.physics.add.sprite(width * 0.94, 440, context.assets.resolve('exit'));
    exit.body.setAllowGravity(false);
    exit.body.setImmovable(true);
    exit.setSize(80, 160);

    let isHiding = false;
    let noiseGenerated = false;
    let pursuitTriggered = false;
    let objectiveReached = false;
    let reachedUnseen = false;

    scene.physics.add.overlap(player, exit, () => {
      if (objectiveReached) return;
      objectiveReached = true;
      if (!pursuitTriggered) reachedUnseen = true;
      world.setFlag('objective.exit-reached', true);
    });

    const debugHandle = context.debug.contribute('game.top-down-shell', () => {
      const state = perception.targetState(SENSOR_ID, 'player');
      return {
        x: Math.round(player.x),
        y: Math.round(player.y),
        guardX: Math.round(guard.x),
        guardY: Math.round(guard.y),
        guardStatus: perception.sensorStatus(SENSOR_ID),
        playerAwareness: Number((state?.awareness ?? 0).toFixed(2)),
        currentlyVisible: state?.currentlyVisible ?? false,
        lastKnownX: state?.lastKnownX ? Math.round(state.lastKnownX) : null,
        lastKnownY: state?.lastKnownY ? Math.round(state.lastKnownY) : null,
        investigationX: state?.investigationX ? Math.round(state.investigationX) : null,
        investigationY: state?.investigationY ? Math.round(state.investigationY) : null,
        isHiding,
        noiseGenerated,
        pursuitTriggered,
        objectiveReached,
        reachedUnseen,
      };
    });

    let disposed = false;

    return {
      id: GAME_SPECIFIC_PACK.id,

      update(deltaMs: number): void {
        if (disposed) return;
        const dtSec = deltaMs / 1000;
        const intent = topDownController.read(context.input);
        player.setVelocity(intent.moveX * 180, intent.moveY * 180);

        // Check hiding zone
        const inHiding =
          player.x >= HIDING_ZONE.left &&
          player.x <= HIDING_ZONE.right &&
          player.y >= HIDING_ZONE.top &&
          player.y <= HIDING_ZONE.bottom;

        isHiding = inHiding;
        perceptionRuntime.setTargetVisibility('player', inHiding ? 'hidden' : 'normal');

        // Secondary action triggers a noise distraction at (700, 200)
        if (intent.secondaryPressed && !noiseGenerated) {
          noiseGenerated = true;
          perceptionRuntime.addNoise({
            id: 'pebble',
            x: 650,
            y: 200,
            radius: 350,
            intensity: 1,
            category: 'pebble',
            lifetimeMs: 2500,
          });
        }

        // Advance perception
        perceptionRuntime.update(deltaMs);

        const status = perceptionRuntime.sensorStatus(SENSOR_ID);
        const targetState = perception.targetState(SENSOR_ID, 'player');

        if (status === 'pursuit') {
          pursuitTriggered = true;
          ai.setState(GUARD_ID, 'chase');
          // Guard moves toward player's position
          const dx = player.x - guard.x;
          const dy = player.y - guard.y;
          const dist = Math.hypot(dx, dy);
          if (dist > 10) {
            patrolDir = dx > 0 ? 1 : -1;
            guard.x += (dx / dist) * PATROL_SPEED * 1.5 * dtSec;
            guard.y += (dy / dist) * PATROL_SPEED * 1.5 * dtSec;
          }
        } else if (status === 'investigating' && targetState?.investigationX !== undefined) {
          ai.setState(GUARD_ID, 'patrol');
          const targetX = targetState.investigationX;
          const targetY = targetState.investigationY ?? PATROL_Y;
          const dx = targetX - guard.x;
          const dy = targetY - guard.y;
          const dist = Math.hypot(dx, dy);
          if (dist > 10) {
            patrolDir = dx > 0 ? 1 : -1;
            guard.x += (dx / dist) * PATROL_SPEED * dtSec;
            guard.y += (dy / dist) * PATROL_SPEED * dtSec;
          }
        } else {
          ai.setState(GUARD_ID, 'patrol');
          // Return towards patrol line Y and patrol back and forth
          if (Math.abs(guard.y - PATROL_Y) > 5) {
            guard.y += Math.sign(PATROL_Y - guard.y) * PATROL_SPEED * dtSec;
          }
          guard.x += patrolDir * PATROL_SPEED * dtSec;
          if (guard.x >= PATROL_RIGHT_X) patrolDir = -1;
          else if (guard.x <= PATROL_LEFT_X) patrolDir = 1;
        }
      },

      dispose(): void {
        if (disposed) return;
        disposed = true;
        debugHandle.dispose();
        perceptionRuntime.dispose();
        try {
          player.destroy();
          guard.destroy();
          wallRect.destroy();
          hidingRect.destroy();
          exit.destroy();
        } catch {
          /* tearing down */
        }
      },
    };
  },
};
