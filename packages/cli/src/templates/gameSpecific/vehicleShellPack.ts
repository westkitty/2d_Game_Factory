import Phaser from 'phaser';
import type { InstalledSystemPack, RaceService, VehicleService } from '@sw2d/contracts';
import { RACE_STATE_CAPABILITY_ID, VEHICLE_MOTION_CAPABILITY_ID } from '@sw2d/contracts';
import { resolveSceneLevel, vehicleController, type SceneContext, type ScenePackDefinition } from '@sw2d/runtime';

/**
 * Generated starter shell: vehicle controller family.
 *
 * `vehicleController` supplies INPUT INTENT ONLY (ADR-0009). When
 * `sw2d.vehicles` (capability program Phase 10) is installed the reusable
 * VehicleService turns that intent into motion (car / kart / boat / flight
 * profiles); otherwise a small arcade fallback keeps the shell runnable. When
 * `sw2d.racing` is installed the RaceService owns the countdown, ordered
 * checkpoints and laps - CONFIRM starts the race, and reaching a checkpoint
 * circle reports it (only the expected next one counts).
 */

const LEVEL_DOCUMENT = 'levels/main';

export const GAME_SPECIFIC_PACK: ScenePackDefinition = {
  id: 'game.vehicle-shell',
  version: '0.1.0',
  provides: [],
  dependencies: [],

  install(context: SceneContext): InstalledSystemPack {
    const scene = context.scene;
    const { level, manifest: generationManifest } = resolveSceneLevel(context, LEVEL_DOCUMENT);
    const vehicleKey = context.assets.resolve('player');
    const platformKey = context.assets.resolve('platform');
    const { width, height } = context.definition.viewport;

    const walls = scene.physics.add.staticGroup();
    for (const solid of level?.solids ?? []) {
      const body = walls.create(solid.x + solid.width / 2, solid.y + solid.height / 2, platformKey) as Phaser.Physics.Arcade.Sprite;
      body.setDisplaySize(solid.width, solid.height);
      body.refreshBody();
    }

    const spawn = level?.objects.find((object) => object.class === 'PlayerSpawn');
    const vehicleSvc = context.capabilities.get<VehicleService>(VEHICLE_MOTION_CAPABILITY_ID);
    const raceSvc = context.capabilities.get<RaceService>(RACE_STATE_CAPABILITY_ID);

    const spawnX = spawn?.x ?? width * 0.5;
    const spawnY = spawn?.y ?? height * 0.5;

    if (vehicleSvc && vehicleSvc.definitionIds().length > 0) {
      vehicleSvc.load(vehicleSvc.definitionIds()[0]!, { x: spawnX, y: spawnY, heading: 0 });
    }

    const vehicle = scene.physics.add.sprite(spawnX, spawnY, vehicleKey);
    vehicle.setCollideWorldBounds(true);
    vehicle.body.setAllowGravity(false);
    if (!vehicleSvc) {
      scene.physics.add.collider(vehicle, walls);
      vehicle.setDamping(true);
      vehicle.setDrag(0.92);
      vehicle.setMaxVelocity(260);
    }

    let raceStarted = false;
    const debugHandle = context.debug.contribute('game.vehicle-shell', () => ({
      x: Math.round(vehicle.x),
      y: Math.round(vehicle.y),
      angle: Math.round(vehicle.angle),
      ...(vehicleSvc ? { vehicle: vehicleSvc.state() } : { speed: Math.round(vehicle.body.velocity.length()) }),
      ...(raceSvc ? { race: raceSvc.raceState(), expectedCheckpoint: raceSvc.expectedCheckpoint()?.id ?? null } : {}),
      ...(generationManifest ? { generation: generationManifest } : {}),
    }));

    const scratch = new Phaser.Math.Vector2();
    let disposed = false;

    return {
      id: GAME_SPECIFIC_PACK.id,

      update(deltaMs: number): void {
        if (disposed) return;
        const intent = vehicleController.read(context.input);

        if (raceSvc) {
          if (!raceStarted && context.input.consumePress('CONFIRM')) {
            raceSvc.startRace();
            raceStarted = true;
          }
          raceSvc.tick(deltaMs);
        }

        if (vehicleSvc) {
          const st = vehicleSvc.update(deltaMs, intent);
          vehicle.setPosition(st.x, st.y);
          vehicle.setRotation(st.heading);
          if (raceSvc) {
            const cp = raceSvc.expectedCheckpoint();
            if (cp && Math.hypot(st.x - cp.x, st.y - cp.y) <= cp.radius) raceSvc.checkpointEntered(cp.id);
          }
        } else {
          vehicle.angle += intent.steering * 3;
          if (intent.throttle > 0) {
            scene.physics.velocityFromRotation(vehicle.rotation, intent.throttle * 600, scratch);
            vehicle.setAcceleration(scratch.x, scratch.y);
          } else {
            vehicle.setAcceleration(0, 0);
          }
          if (intent.brake > 0) vehicle.body.velocity.scale(1 - intent.brake * 0.1);
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
        try {
          walls.clear(true, true);
          walls.destroy(true);
        } catch {
          /* scene already tearing down */
        }
      },
    };
  },
};
