import { describe, expect, it } from 'vitest';
import {
  evaluateTowerPlacement,
  selectTarget,
  tickCaptureZone,
  validateDefenseDocument,
  type CaptureZoneState,
} from '../src/defense.ts';

describe('defense contracts', () => {
  it('selects deterministic targets using the named policy', () => {
    const targets = [
      { id: 'late', x: 4, y: 0, health: 20, maxHealth: 20, routeProgress: 1 },
      { id: 'first-b', x: 3, y: 0, health: 4, maxHealth: 20, routeProgress: 9 },
      { id: 'first-a', x: 3, y: 0, health: 4, maxHealth: 20, routeProgress: 9 },
    ];
    expect(selectTarget('first-on-route', { x: 0, y: 0 }, 10, targets)?.id).toBe('first-a');
    expect(selectTarget('lowest-health', { x: 0, y: 0 }, 10, targets)?.id).toBe('first-a');
    expect(selectTarget('nearest', { x: 0, y: 0 }, 2, targets)).toBeNull();
  });

  it('does not run route validation until the cheap placement checks pass', () => {
    let routesChecked = 0;
    const definition = { id: 'wall', cost: 10, range: 4, weaponId: 'dart', targetPolicy: 'nearest' as const, blocking: true };
    expect(evaluateTowerPlacement(definition, { x: 10, y: 10 }, [{ id: 'build', kind: 'buildable', x: 0, y: 0, width: 4, height: 4 }], [], 100, () => { routesChecked++; return false; })).toBe('outside-zone');
    expect(routesChecked).toBe(0);
    expect(evaluateTowerPlacement(definition, { x: 2, y: 2 }, [{ id: 'build', kind: 'buildable', x: 0, y: 0, width: 8, height: 8 }], [], 100, () => { routesChecked++; return false; })).toBe('blocks-route');
    expect(routesChecked).toBe(1);
  });

  it('freezes a contested zone, captures it when clear, then decays partial progress', () => {
    const definition = { id: 'relay', shape: { kind: 'circle' as const, x: 0, y: 0, radius: 10 }, captureMs: 1000, decayPerSecond: 0.25 };
    const state: CaptureZoneState = { id: 'relay', owner: null, capturingTeam: null, progress: 0, contested: false, occupants: {} };
    const contested = tickCaptureZone(definition, state, [{ id: 'a', teamId: 'red', x: 0, y: 0 }, { id: 'b', teamId: 'blue', x: 0, y: 0 }], 500);
    expect(contested).toMatchObject({ contested: true, progress: 0 });
    const half = tickCaptureZone(definition, contested, [{ id: 'a', teamId: 'red', x: 0, y: 0 }], 500);
    expect(half).toMatchObject({ owner: null, capturingTeam: 'red', progress: 0.5, contested: false });
    const decayed = tickCaptureZone(definition, half, [], 1000);
    expect(decayed).toMatchObject({ capturingTeam: 'red', progress: 0.25 });
    const captured = tickCaptureZone(definition, decayed, [{ id: 'a', teamId: 'red', x: 0, y: 0 }], 1000);
    expect(captured).toMatchObject({ owner: 'red', capturingTeam: null, progress: 0 });
  });

  it('rejects a blocking tower when no route is protected', () => {
    expect(() => validateDefenseDocument({ schemaVersion: 1, towers: [{ id: 'wall', cost: 1, range: 1, weaponId: 'dart', targetPolicy: 'nearest', blocking: true }] })).toThrow('no route requirement');
  });
});
