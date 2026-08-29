import { describe, expect, it } from 'vitest';
import { expandFirePattern } from '../src/encounters.ts';

const AIM_RIGHT = [1, 0] as const;

function deg(dir: readonly [number, number]): number {
  return Math.round((Math.atan2(dir[1], dir[0]) * 180) / Math.PI);
}

describe('expandFirePattern', () => {
  it('aimed returns the aim direction unchanged', () => {
    expect(expandFirePattern({ kind: 'aimed' }, AIM_RIGHT, 0)).toEqual([AIM_RIGHT]);
  });

  it('fixed ignores aim', () => {
    expect(deg(expandFirePattern({ kind: 'fixed', angleDeg: 90 }, AIM_RIGHT, 0)[0]!)).toBe(90);
  });

  it('fan is a symmetric spread of `count` directions', () => {
    const dirs = expandFirePattern({ kind: 'fan', count: 3, spreadDeg: 60 }, AIM_RIGHT, 0);
    expect(dirs).toHaveLength(3);
    expect(dirs.map(deg)).toEqual([-30, 0, 30]);
  });

  it('fan aimed centres on the aim angle', () => {
    const dirs = expandFirePattern({ kind: 'fan', count: 3, spreadDeg: 60, aimed: true }, [0, 1], 0);
    expect(dirs.map(deg)).toEqual([60, 90, 120]);
  });

  it('ring spaces `count` directions evenly around 360', () => {
    const dirs = expandFirePattern({ kind: 'ring', count: 4 }, AIM_RIGHT, 0);
    expect(dirs.map(deg).sort((a, b) => a - b)).toEqual([-90, 0, 90, 180]);
  });

  it('spiral rotates by rotationStepDeg per emission', () => {
    const a = expandFirePattern({ kind: 'spiral', count: 2, rotationStepDeg: 15 }, AIM_RIGHT, 0).map(deg);
    const b = expandFirePattern({ kind: 'spiral', count: 2, rotationStepDeg: 15 }, AIM_RIGHT, 1).map(deg);
    expect(a).toEqual([0, 180]);
    expect(b).toEqual([15, -165]);
  });

  it('sweep interpolates a single direction across the range by emission index', () => {
    const p = { kind: 'sweep', count: 3, fromDeg: 0, toDeg: 90 } as const;
    expect(deg(expandFirePattern(p, AIM_RIGHT, 0)[0]!)).toBe(0);
    expect(deg(expandFirePattern(p, AIM_RIGHT, 1)[0]!)).toBe(45);
    expect(deg(expandFirePattern(p, AIM_RIGHT, 2)[0]!)).toBe(90);
    expect(deg(expandFirePattern(p, AIM_RIGHT, 3)[0]!)).toBe(0); // wraps
  });

  it('is deterministic', () => {
    const p = { kind: 'spiral', count: 5, rotationStepDeg: 7 } as const;
    expect(expandFirePattern(p, AIM_RIGHT, 12)).toEqual(expandFirePattern(p, AIM_RIGHT, 12));
  });
});
