import Phaser from 'phaser';
import type { InstalledSystemPack, NormalizedLevel } from '@sw2d/contracts';
import { vehicleController, type SceneContext, type ScenePackDefinition } from '@sw2d/runtime';

/**
 * Generated starter shell: vehicle controller family.
 *
 * Arcade-only, per MASTER_PROJECT.md section 6.5 ("no vehicle physics/drift
 * exists yet"): steering rotates a heading, throttle accelerates along it,
 * with simple linear drag. See platformShellPack.ts's file comment for the
 * template pattern.
 */

const LEVEL_DOCUMENT = 'levels/main';

export const GAME_SPECIFIC_PACK: ScenePackDefinition = {
  id: 'game.vehicle-shell',
  version: '0.1.0',
  provides: [],
  dependencies: [],

  install(context: SceneContext): InstalledSystemPack {
    const scene = context.scene;
    const level = context.content.data[LEVEL_DOCUMENT]?.value as NormalizedLevel | undefined;
    const vehicleKey = context.assets.resolve('player');
    const { width, height } = context.definition.viewport;

    const spawn = level?.objects.find((object) => object.class === 'PlayerSpawn');
    const spawnX = spawn?.x ?? width * 0.5;
    const spawnY = spawn?.y ?? height * 0.5;

    const vehicle = scene.physics.add.sprite(spawnX, spawnY, vehicleKey);
    vehicle.setCollideWorldBounds(true);
    vehicle.body.setAllowGravity(false);
    vehicle.setDamping(true);
    vehicle.setDrag(0.92);
    vehicle.setMaxVelocity(260);

    const debugHandle = context.debug.contribute('game.vehicle-shell', () => ({
      x: Math.round(vehicle.x),
      y: Math.round(vehicle.y),
      angle: Math.round(vehicle.angle),
      speed: Math.round(vehicle.body.velocity.length()),
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
      },
    };
  },
};
