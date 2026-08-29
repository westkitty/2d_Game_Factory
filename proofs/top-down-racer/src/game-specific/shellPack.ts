import type { InstalledSystemPack, RaceService, VehicleIntent, VehicleService } from '@sw2d/contracts';
import { RACE_STATE_CAPABILITY_ID, VEHICLE_MOTION_CAPABILITY_ID } from '@sw2d/contracts';
import { type SceneContext, type ScenePackDefinition } from '@sw2d/runtime';

/**
 * Proof - top-down-racer (see ../PROOF_CONTRACT.md).
 *
 * The car is driven by the reusable `sw2d.vehicles` service (VehicleIntent in,
 * motion out) and the race is the reusable `sw2d.racing` service (ordered
 * checkpoints, two laps). A small autopilot points the wheel at the expected
 * next checkpoint so the browser journey is deterministic; SECONDARY_ACTION
 * fires a deliberate out-of-order checkpoint to prove a shortcut never counts.
 */

const IDLE: VehicleIntent = { steering: 0, throttle: 0, brake: 0, boostPressed: false, boostHeld: false, secondaryPressed: false };

export const GAME_SPECIFIC_PACK: ScenePackDefinition = {
  id: 'game.vehicle-shell',
  version: '0.1.0',
  provides: [],
  dependencies: [VEHICLE_MOTION_CAPABILITY_ID, RACE_STATE_CAPABILITY_ID],

  install(context: SceneContext): InstalledSystemPack {
    const scene = context.scene;
    const vehicleSvc = context.capabilities.require<VehicleService>(VEHICLE_MOTION_CAPABILITY_ID);
    const raceSvc = context.capabilities.require<RaceService>(RACE_STATE_CAPABILITY_ID);
    const carKey = context.assets.resolve('player');

    const spawn = { x: 160, y: 440, heading: 0 };
    vehicleSvc.load(vehicleSvc.definitionIds()[0]!, spawn);
    const car = scene.add.sprite(spawn.x, spawn.y, carKey);

    let raceStarted = false;
    let maxSpeed = 0;
    let lastShortcutCounted: boolean | null = null;
    let shortcutAttempts = 0;

    const debugHandle = context.debug.contribute('game.vehicle-shell', () => {
      const v = vehicleSvc.state();
      const r = raceSvc.raceState();
      return {
        vehicleProfile: vehicleSvc.definitionIds()[0],
        speed: Math.round(v.speed),
        maxSpeed: Math.round(maxSpeed),
        heading: Number(v.heading.toFixed(3)),
        phase: r.phase,
        currentLap: r.currentLap,
        expectedCheckpoint: raceSvc.expectedCheckpoint()?.id ?? null,
        finished: raceSvc.finished(),
        lapCount: r.lapTimes.length,
        elapsedMs: Math.round(r.elapsedMs),
        lastShortcutCounted,
        shortcutAttempts,
      };
    });

    let disposed = false;

    return {
      id: GAME_SPECIFIC_PACK.id,

      update(deltaMs: number): void {
        if (disposed) return;

        if (!raceStarted && context.input.consumePress('CONFIRM')) {
          raceSvc.startRace();
          raceStarted = true;
        }
        raceSvc.tick(deltaMs);

        if (context.input.consumePress('SECONDARY_ACTION')) {
          const res = raceSvc.checkpointEntered('cp-4'); // last checkpoint, fired out of order
          lastShortcutCounted = res.counted;
          shortcutAttempts += 1;
        }

        let intent: VehicleIntent = IDLE;
        const target = raceSvc.expectedCheckpoint();
        if (target && raceSvc.raceState().phase === 'racing') {
          const v = vehicleSvc.state();
          const desired = Math.atan2(target.y - v.y, target.x - v.x);
          let diff = desired - v.heading;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          intent = { ...IDLE, throttle: 1, steering: Math.max(-1, Math.min(1, diff * 2)) };
        }
        const v = vehicleSvc.update(deltaMs, intent);
        maxSpeed = Math.max(maxSpeed, v.speed);
        car.setPosition(v.x, v.y);
        car.setRotation(v.heading);

        const cp = raceSvc.expectedCheckpoint();
        if (cp && Math.hypot(v.x - cp.x, v.y - cp.y) <= cp.radius) raceSvc.checkpointEntered(cp.id);
      },

      dispose(): void {
        if (disposed) return;
        disposed = true;
        debugHandle.dispose();
        try {
          car.destroy();
        } catch {
          /* scene already tearing down */
        }
      },
    };
  },
};
