import Phaser from 'phaser';
import type { InstalledSystemPack, RaceService, VehicleService } from '@sw2d/contracts';
import { RACE_STATE_CAPABILITY_ID, VEHICLE_MOTION_CAPABILITY_ID } from '@sw2d/contracts';
import { bindStarterAsteroids, bindStarterKartItem, bindStarterVehicle, bindStarterWeapon, resolveSceneLevel, vehicleController, type SceneContext, type ScenePackDefinition } from '@sw2d/runtime';
import { ASTEROIDS_STARTER, KART_STARTER, VEHICLE_STARTER } from './packConfig.ts';

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
 *
 * When `sw2d.weapons` is installed (Category-C Wave 11) PRIMARY_ACTION fires
 * along the ship's heading through the reusable projectile runtime. Fire is
 * not vehicle intent - the shell reads the action, the controller does not.
 *
 * When `VEHICLE_STARTER` is road or craft (Category-C Wave 23) the dummy
 * drive-and-maybe-race loop is replaced by arcade distance or a boat-to-
 * flight switch on the existing catalog. When `KART_STARTER` is item
 * (Wave 29) J fires a held shell after driving through the box.
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
    // Asteroids (Final Product Completion Wave 3). Inert unless packConfig
    // names the field starter. The rock field owns the weapon and its
    // projectile runtime; the ship is the sw2d.vehicles `ship` profile.
    const rocks = bindStarterAsteroids(context, { mode: ASTEROIDS_STARTER });
    // Weapons (capability program Phase 3 / Category-C Wave 11). Inert unless
    // sw2d.weapons is installed (and the rock field does not own it).
    const weapon = rocks.active ? null : bindStarterWeapon(context);
    // Endless road vs boat/flight (Category-C Wave 23). Inert unless
    // packConfig names a road/craft starter. Kart racing stays on RaceService.
    const drive = bindStarterVehicle(context, { mode: VEHICLE_STARTER });
    // Kart on-demand item (Category-C Wave 29). Inert unless packConfig
    // names the item starter. Pickup/fire stay game-specific.
    const kartItem = bindStarterKartItem(context, { mode: KART_STARTER });
    const openSpace = (Boolean(weapon?.snapshot()) && !vehicleSvc) || drive.active || rocks.active;

    const spawnX = drive.active ? drive.startX() : kartItem.active ? 160 : openSpace ? width * 0.5 : (spawn?.x ?? width * 0.5);
    if (rocks.active) walls.setVisible(false);
    const spawnY = drive.active ? drive.startY() : kartItem.active ? 440 : openSpace ? height * 0.5 : (spawn?.y ?? height * 0.5);

    if (vehicleSvc && vehicleSvc.definitionIds().length > 0) {
      vehicleSvc.load(vehicleSvc.definitionIds()[0]!, { x: spawnX, y: spawnY, heading: 0 });
    }

    const vehicle = scene.physics.add.sprite(spawnX, spawnY, vehicleKey);
    vehicle.setCollideWorldBounds(!rocks.active);
    vehicle.body.setAllowGravity(false);
    if (rocks.active) {
      vehicle.setRotation(-Math.PI / 2);
      rocks.attach(vehicle);
    }
    if (drive.active || kartItem.active) walls.setVisible(false);
    if (!vehicleSvc) {
      if (openSpace) {
        // The universal proof level's ground strip is not an asteroids arena.
        // Colliding with it pins the ship; hide it and fly in open space.
        walls.setVisible(false);
      } else {
        scene.physics.add.collider(vehicle, walls);
      }
      vehicle.setDamping(true);
      vehicle.setDrag(0.92);
      vehicle.setMaxVelocity(260);
    }

    let raceStarted = false;
    let nowMs = 0;
    const debugHandle = context.debug.contribute('game.vehicle-shell', () => ({
      x: Math.round(vehicle.x),
      y: Math.round(vehicle.y),
      angle: Math.round(vehicle.angle),
      ...(vehicleSvc ? { vehicle: vehicleSvc.state() } : { speed: Math.round(vehicle.body.velocity.length()) }),
      ...(raceSvc ? { race: raceSvc.raceState(), expectedCheckpoint: raceSvc.expectedCheckpoint()?.id ?? null } : {}),
      ...(drive.active ? { drive: drive.snapshot() } : {}),
      ...(kartItem.active ? { kartItem: kartItem.snapshot() } : {}),
      ...(rocks.active ? { asteroids: rocks.snapshot() } : {}),
      ...(generationManifest ? { generation: generationManifest } : {}),
      weapon: weapon?.snapshot() ?? null,
    }));

    const scratch = new Phaser.Math.Vector2();
    let disposed = false;

    return {
      id: GAME_SPECIFIC_PACK.id,

      update(deltaMs: number): void {
        if (disposed) return;
        nowMs += deltaMs;
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
          // The vehicle service integrates its own position, so Arcade's
          // world-bounds collision never sees this movement - without a
          // check the car can drive off the world forever (found by playing
          // the generated starter: y reached -881). Racing convention: going
          // off the world resets you to spawn; the race state (expected
          // checkpoint, lap, clock) is deliberately untouched, so the reset
          // costs time but not progress.
          const margin = 48;
          if (!drive.active && !rocks.active && (st.x < -margin || st.x > width + margin || st.y < -margin || st.y > height + margin)) {
            vehicleSvc.reset();
          }
          const now = vehicleSvc.state();
          vehicle.setPosition(now.x, now.y);
          vehicle.setRotation(now.heading);
          if (drive.active) {
            drive.setVehicle(now);
            drive.tick(deltaMs);
            drive.render();
          }
          if (kartItem.active) kartItem.setVehicle(now.x, now.y, now.heading);
          if (raceSvc) {
            const cp = raceSvc.expectedCheckpoint();
            if (cp && Math.hypot(now.x - cp.x, now.y - cp.y) <= cp.radius) raceSvc.checkpointEntered(cp.id);
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

        weapon?.update(deltaMs, nowMs);
        if (rocks.active) rocks.tick(deltaMs, nowMs);
        if (context.input.justPressed('PRIMARY_ACTION') || (rocks.active && context.input.isDown('PRIMARY_ACTION'))) {
          if (kartItem.active) {
            kartItem.fire();
          } else if (drive.active && drive.snapshot().mode === 'craft') {
            drive.switchCraft();
          } else {
            const heading = vehicleSvc ? vehicleSvc.state().heading : vehicle.rotation;
            (weapon ?? rocks).fire(nowMs, Math.cos(heading), Math.sin(heading), { x: vehicle.x, y: vehicle.y });
          }
        }
      },

      dispose(): void {
        if (disposed) return;
        disposed = true;
        debugHandle.dispose();
        weapon?.dispose();
        rocks.dispose();
        drive.dispose();
        kartItem.dispose();
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
