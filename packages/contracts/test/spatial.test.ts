import { describe, expect, it } from 'vitest';
import { aimFromPointer, hitTestPoint, type HitShape } from '../src/spatial.ts';

describe('hitTestPoint', () => {
  it('rectangles include their boundary', () => {
    const rect: HitShape = { kind: 'rect', x: 10, y: 20, width: 100, height: 40 };
    expect(hitTestPoint(rect, 10, 20)).toBe(true); // corner
    expect(hitTestPoint(rect, 110, 60)).toBe(true); // opposite corner
    expect(hitTestPoint(rect, 60, 40)).toBe(true); // centre
    expect(hitTestPoint(rect, 9.9, 40)).toBe(false);
    expect(hitTestPoint(rect, 60, 60.1)).toBe(false);
  });

  it('circles use squared distance and include the boundary', () => {
    const circle: HitShape = { kind: 'circle', x: 0, y: 0, radius: 5 };
    expect(hitTestPoint(circle, 0, 0)).toBe(true);
    expect(hitTestPoint(circle, 5, 0)).toBe(true); // exactly on the edge
    expect(hitTestPoint(circle, 3, 4)).toBe(true); // 3-4-5
    expect(hitTestPoint(circle, 3.01, 4)).toBe(false);
  });

  it('polygons use an even-odd test and count a boundary point as inside', () => {
    const triangle: HitShape = {
      kind: 'polygon',
      points: [
        [0, 0],
        [10, 0],
        [5, 10],
      ],
    };
    expect(hitTestPoint(triangle, 5, 3)).toBe(true);
    expect(hitTestPoint(triangle, 5, 0)).toBe(true); // on the bottom edge
    expect(hitTestPoint(triangle, 0, 0)).toBe(true); // on a vertex
    expect(hitTestPoint(triangle, 9, 8)).toBe(false); // outside the apex
    expect(hitTestPoint(triangle, -1, 5)).toBe(false);
  });

  it('a concave polygon rejects points in its notch but accepts points in its body', () => {
    // Right-pointing arrowhead with a notch cut into its left side.
    const arrow: HitShape = {
      kind: 'polygon',
      points: [
        [0, 0],
        [10, 5],
        [0, 10],
        [3, 5],
      ],
    };
    expect(hitTestPoint(arrow, 6, 4)).toBe(true); // solid body
    expect(hitTestPoint(arrow, 1, 4)).toBe(false); // inside the notch
  });
});

describe('aimFromPointer', () => {
  it('returns a unit vector from origin toward the pointer', () => {
    const aim = aimFromPointer(0, 0, 10, 0);
    expect(aim).toEqual({ aimX: 1, aimY: 0, aimMagnitude: 1 });
  });

  it('normalises a diagonal', () => {
    const aim = aimFromPointer(0, 0, 3, 4);
    expect(aim.aimX).toBeCloseTo(0.6, 10);
    expect(aim.aimY).toBeCloseTo(0.8, 10);
    expect(aim.aimMagnitude).toBe(1);
  });

  it('is a zero vector when origin and pointer coincide (no NaN)', () => {
    const aim = aimFromPointer(42, 42, 42, 42);
    expect(aim).toEqual({ aimX: 0, aimY: 0, aimMagnitude: 0 });
  });

  it('respects a non-origin actor position', () => {
    const aim = aimFromPointer(100, 100, 100, 90);
    expect(aim).toEqual({ aimX: 0, aimY: -1, aimMagnitude: 1 });
  });
});
