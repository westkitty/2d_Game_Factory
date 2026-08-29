import type { InstalledSystemPack, RaceService, VehicleIntent, VehicleService } from '@sw2d/contracts';
import { RACE_STATE_CAPABILITY_ID, VEHICLE_MOTION_CAPABILITY_ID } from '@sw2d/contracts';
import { type SceneContext, type ScenePackDefinition } from '@sw2d/runtime';

/**
 * Proof - time-trial-racer (see ../PROOF_CONTRACT.md).
 *
 * Same reusable `sw2d.vehicles` + `sw2d.racing` services as the top-down-racer
 * proof, in `time-trial` mode: a countdown, one timed lap, an invalid-shortcut
 * rejection, a finish, a restart that resets the attempt, and a second faster
 * attempt that updates the persisted best time. An `autopilotThrottle` knob
 * (default 1) lets the browser journey run a deliberately slow first lap.
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
    let autopilotThrottle = 1;
    let lastShortcutCounted: boolean | null = null;

    const debugHandle = context.debug.contribute('game.vehicle-shell', () => {
      const r = raceSvc.raceState();
      return {
        mode: 'time-trial',
        phase: r.phase,
        countdownRemainingMs: Math.round(r.countdownRemainingMs),
        elapsedMs: Math.round(r.elapsedMs),
        expectedCheckpoint: raceSvc.expectedCheckpoint()?.id ?? null,
        finished: raceSvc.finished(),
        lapCount: r.lapTimes.length,
        bestTotalMs: r.bestTotalMs === null ? null : Math.round(r.bestTotalMs),
        bestLapMs: r.bestLapMs === null ? null : Math.round(r.bestLapMs),
        lastShortcutCounted,
        autopilotThrottle,
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
        // PRIMARY_ACTION restarts the attempt; SECONDARY_ACTION fires a shortcut;
        // INTERACT held = slow autopilot lap.
        if (context.input.consumePress('PRIMARY_ACTION')) {
          raceSvc.restartRace();
          raceStarted = false;
          vehicleSvc.reset();
        }
        if (context.input.consumePress('SECONDARY_ACTION')) {
          lastShortcutCounted = raceSvc.checkpointEntered('cp-4').counted;
        }
        autopilotThrottle = context.input.value('INTERACT') > 0 ? 0.35 : 1;

        raceSvc.tick(deltaMs);

        let intent: VehicleIntent = IDLE;
        const target = raceSvc.expectedCheckpoint();
        if (target && raceSvc.raceState().phase === 'racing') {
          const v = vehicleSvc.state();
          const desired = Math.atan2(target.y - v.y, target.x - v.x);
          let diff = desired - v.heading;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          intent = { ...IDLE, throttle: autopilotThrottle, steering: Math.max(-1, Math.min(1, diff * 2)) };
        }
        const v = vehicleSvc.update(deltaMs, intent);
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
