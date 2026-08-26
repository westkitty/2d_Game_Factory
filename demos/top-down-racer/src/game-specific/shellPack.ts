import Phaser from 'phaser';
import type { InstalledSystemPack, NormalizedLevel, NormalizedLevelObject } from '@sw2d/contracts';
import { vehicleController, type SceneContext, type ScenePackDefinition } from '@sw2d/runtime';
import { CAPABILITY_IDS, type EntityRegistry, type WorldService } from '@sw2d/packs';

/**
 * Top-Down Racer demo (Phase 8 representative demo 7/12).
 *
 * Smoke contract: throttle/steering, ordered checkpoints, lap/time-trial
 * completion, restart. Arcade handling only (LIMITATIONS.vehicleIntentOnly)
 * - no drift/handling model, just steering-as-rotation and throttle-as-
 * forward-acceleration, the same physics the generic vehicle shell uses.
 */

const LEVEL_DOCUMENT = 'levels/main';

export const GAME_SPECIFIC_PACK: ScenePackDefinition = {
  id: 'game.vehicle-shell',
  version: '0.1.0',
  provides: [],
  dependencies: [CAPABILITY_IDS.world, CAPABILITY_IDS.entities],

  install(context: SceneContext): InstalledSystemPack {
    const scene = context.scene;
    const level = context.content.data[LEVEL_DOCUMENT]?.value as NormalizedLevel;
    const world = context.capabilities.require<WorldService>(CAPABILITY_IDS.world);
    const registry = context.capabilities.require<EntityRegistry<SceneContext>>(CAPABILITY_IDS.entities);

    registry.register('PlayerSpawn', (object: NormalizedLevelObject) => ({ x: object.x, y: object.y }));
    const spawnObject = level.objects.find((object) => object.class === 'PlayerSpawn')!;
    const spawn = registry.dispatch(spawnObject, context) as { x: number; y: number };

    const vehicle = scene.physics.add.sprite(spawn.x, spawn.y, context.assets.resolve('player'));
    vehicle.setCollideWorldBounds(true);
    vehicle.body.setAllowGravity(false);
    vehicle.setDamping(true);
    vehicle.setDrag(0.92);
    vehicle.setMaxVelocity(260);

    // Ordered checkpoints: the level authors them in course order, so the
    // route is exactly the order they appear in level.objects - no
    // hard-coded id list here duplicating the content.
    const checkpointIds = level.objects.filter((object) => object.class === 'Checkpoint').map((object) => String(object.properties.checkpointId));
    let nextIndex = 0;
    let lapComplete = false;
    const markerSprites: Phaser.GameObjects.Sprite[] = [];

    registry.register('Checkpoint', (object: NormalizedLevelObject) => {
      const checkpointId = String(object.properties.checkpointId);
      const sprite = scene.add.sprite(object.x + object.width / 2, object.y + object.height / 2, context.assets.resolve('checkpoint'));
      sprite.setDisplaySize(object.width, object.height);
      scene.physics.add.existing(sprite, true);
      markerSprites.push(sprite);
      scene.physics.add.overlap(vehicle, sprite, () => {
        if (checkpointIds[nextIndex] !== checkpointId) return; // out of order - ignored, not an error
        nextIndex += 1;
        world.setFlag(`checkpoint.${checkpointId}`, true);
        if (nextIndex >= checkpointIds.length) {
          lapComplete = true;
          world.setFlag('lap.complete', true);
        }
      });
    });

    for (const object of level.objects) {
      if (object.class === 'PlayerSpawn') continue;
      registry.dispatch(object, context);
    }

    const debugHandle = context.debug.contribute('game.vehicle-shell', () => ({
      x: Math.round(vehicle.x),
      y: Math.round(vehicle.y),
      angle: Math.round(vehicle.angle),
      speed: Math.round(vehicle.body.velocity.length()),
      nextCheckpointIndex: nextIndex,
      checkpointsTotal: checkpointIds.length,
      lapComplete,
    }));

    const scratchAcceleration = new Phaser.Math.Vector2();
    let disposed = false;

    return {
      id: GAME_SPECIFIC_PACK.id,

      update(): void {
        if (disposed) return;
        const intent = vehicleController.read(context.input);
        vehicle.angle += intent.steering * 3;
        if (intent.throttle > 0) {
          scene.physics.velocityFromRotation(vehicle.rotation, intent.throttle * 600, scratchAcceleration);
          vehicle.setAcceleration(scratchAcceleration.x, scratchAcceleration.y);
        } else {
          vehicle.setAcceleration(0, 0);
        }
        if (intent.brake > 0) {
          vehicle.body.velocity.scale(1 - intent.brake * 0.1);
        }
      },

      dispose(): void {
        if (disposed) return;
        disposed = true;
        debugHandle.dispose();
        try {
          vehicle.destroy();
        } catch {
          /* scene already tearing down */
        }
        for (const sprite of markerSprites) {
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
