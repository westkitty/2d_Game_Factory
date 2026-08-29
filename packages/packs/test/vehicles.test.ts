import { describe, expect, it } from 'vitest';
import type { GameContext, VehicleCatalog, VehicleIntent, VehicleService } from '@sw2d/contracts';
import { VEHICLE_MOTION_CAPABILITY_ID, VEHICLE_PROFILE_DEFAULTS } from '@sw2d/contracts';
import { CAPABILITY_IDS } from '../src/ids.ts';
import { vehiclesPack } from '../src/vehicles/vehiclesPack.ts';
import { FakeCapabilityRegistry, FakeEventBus } from './testSupport.ts';

const IDLE: VehicleIntent = { steering: 0, throttle: 0, brake: 0, boostPressed: false, boostHeld: false, secondaryPressed: false };
const intent = (o: Partial<VehicleIntent>): VehicleIntent => ({ ...IDLE, ...o });

function makeService(cat: VehicleCatalog): VehicleService {
  const capabilities = new FakeCapabilityRegistry();
  const ctx = { events: new FakeEventBus(), capabilities, content: { data: { vehicles: { schemaId: 'x', valid: true, value: cat } } } } as unknown as GameContext;
  vehiclesPack.install(ctx, undefined);
  return capabilities.require<VehicleService>(VEHICLE_MOTION_CAPABILITY_ID);
}

const carDef = { id: 'car', profile: 'car' as const, ...VEHICLE_PROFILE_DEFAULTS.car };
const kartDef = { id: 'kart', profile: 'kart' as const, ...VEHICLE_PROFILE_DEFAULTS.kart };
const boatDef = { id: 'boat', profile: 'boat' as const, ...VEHICLE_PROFILE_DEFAULTS.boat };
const CAT: VehicleCatalog = { schemaVersion: 1, vehicles: [carDef, kartDef, boatDef] };

/** Run `frames` 16.67 ms updates and return the final state. */
function run(svc: VehicleService, frames: number, i: VehicleIntent, surface?: string) {
  let s = svc.state();
  for (let f = 0; f < frames; f++) s = svc.update(16.667, i, surface);
  return s;
}

describe('sw2d.vehicles', () => {
  it('publishes vehicle.motion and lists definitions', () => {
    expect(VEHICLE_MOTION_CAPABILITY_ID).toBe(CAPABILITY_IDS.vehicles);
    const svc = makeService(CAT);
    expect(svc.definitionIds()).toEqual(['boat', 'car', 'kart']);
  });

  it('throttle accelerates forward; brake then reverse; speeds clamp', () => {
    const svc = makeService(CAT);
    svc.load('car', { x: 0, y: 0, heading: 0 });
    const accel = run(svc, 30, intent({ throttle: 1 }));
    expect(accel.forwardSpeed).toBeGreaterThan(60);
    expect(accel.x).toBeGreaterThan(0); // moved along heading 0 (+x)

    const braked = run(svc, 20, intent({ brake: 1 }));
    expect(braked.forwardSpeed).toBeLessThan(accel.forwardSpeed);

    const topSpeed = run(svc, 600, intent({ throttle: 1 }));
    expect(topSpeed.forwardSpeed).toBeLessThanOrEqual(carDef.maxForwardSpeed + 0.001);

    const reverse = run(svc, 200, intent({ brake: 1 }));
    expect(reverse.forwardSpeed).toBeLessThan(0);
    expect(reverse.forwardSpeed).toBeGreaterThanOrEqual(-carDef.maxReverseSpeed - 0.001);
  });

  it('steering changes heading, and less at high speed (speed-sensitive)', () => {
    const svc = makeService(CAT);
    svc.load('car', { x: 0, y: 0, heading: 0 });
    const slow = run(svc, 10, intent({ steering: 1, throttle: 0.15 }));
    svc.reset();
    const fast = run(svc, 400, intent({ throttle: 1 })); // get to near top speed
    void fast;
    const headingBefore = svc.state().heading;
    const afterTurn = run(svc, 10, intent({ steering: 1, throttle: 1 }));
    const fastTurnDelta = Math.abs(afterTurn.heading - headingBefore);
    expect(Math.abs(slow.heading)).toBeGreaterThan(0);
    expect(fastTurnDelta).toBeLessThan(Math.abs(slow.heading));
  });

  it('a drift (secondary held) produces more lateral slide than a plain turn', () => {
    const svc = makeService(CAT);
    svc.load('kart', { x: 0, y: 0, heading: 0 });
    run(svc, 120, intent({ throttle: 1 }));
    const plain = run(svc, 20, intent({ steering: 1, throttle: 1 }));
    svc.reset();
    run(svc, 120, intent({ throttle: 1 }));
    const drift = run(svc, 20, intent({ steering: 1, throttle: 1, secondaryPressed: true }));
    expect(Math.abs(drift.lateralSpeed)).toBeGreaterThan(Math.abs(plain.lateralSpeed));
  });

  it('boost activates once, then is on cooldown', () => {
    const svc = makeService(CAT);
    svc.load('car', { x: 0, y: 0, heading: 0 });
    const boosted = svc.update(16.667, intent({ throttle: 1, boostPressed: true }));
    expect(boosted.boosting).toBe(true);
    expect(boosted.boostCooldownRemainingMs).toBeGreaterThan(0);
    // press again immediately - still the same boost window, no re-trigger of cooldown length
    const cd0 = boosted.boostCooldownRemainingMs;
    const again = svc.update(16.667, intent({ throttle: 1, boostPressed: true }));
    expect(again.boostCooldownRemainingMs).toBeLessThanOrEqual(cd0);
    // run past the boost + cooldown; boosting stops
    const later = run(svc, 400, intent({ throttle: 1 }));
    expect(later.boosting).toBe(false);
    expect(later.boostCooldownRemainingMs).toBe(0);
  });

  it('a surface modifier lowers the effective max speed', () => {
    const withMod: VehicleCatalog = {
      schemaVersion: 1,
      vehicles: [{ ...carDef, surfaceModifiers: { mud: { maxSpeed: 0.4 } } }],
    };
    const svc = makeService(withMod);
    svc.load('car', { x: 0, y: 0, heading: 0 });
    const onMud = run(svc, 600, intent({ throttle: 1 }), 'mud');
    expect(onMud.forwardSpeed).toBeLessThan(carDef.maxForwardSpeed * 0.5);
  });

  it('profiles differ measurably: the kart out-turns the car', () => {
    const svc = makeService(CAT);
    svc.load('car', { x: 0, y: 0, heading: 0 });
    const carTurn = run(svc, 20, intent({ steering: 1, throttle: 0.3 }));
    svc.load('kart', { x: 0, y: 0, heading: 0 });
    const kartTurn = run(svc, 20, intent({ steering: 1, throttle: 0.3 }));
    expect(Math.abs(kartTurn.heading)).toBeGreaterThan(Math.abs(carTurn.heading));
  });

  it('is deterministic and reset returns to spawn', () => {
    const a = makeService(CAT);
    a.load('car', { x: 10, y: 20, heading: 0.5 });
    const s1 = run(a, 40, intent({ steering: 0.4, throttle: 1 }));
    const b = makeService(CAT);
    b.load('car', { x: 10, y: 20, heading: 0.5 });
    const s2 = run(b, 40, intent({ steering: 0.4, throttle: 1 }));
    expect(s1).toEqual(s2);
    a.reset();
    expect(a.state()).toMatchObject({ x: 10, y: 20, heading: 0.5, forwardSpeed: 0 });
  });

  it('throws for an unknown vehicle id', () => {
    const svc = makeService(CAT);
    expect(() => svc.load('spaceship', { x: 0, y: 0, heading: 0 })).toThrow();
  });
});
