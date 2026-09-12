import type { Harness } from './harness.ts';
import { pointerAt } from './journey.ts';

/**
 * Shared verbs for the pointer-aimed shooters (Final Product Completion Wave
 * 3): lead a shot at a moving target and hold fire until a predicate holds.
 */

export interface AimTarget {
  readonly x: number;
  readonly y: number;
  readonly vx: number;
  readonly vy: number;
}

/** Where to point so a projectile of `speed` px/s from (fromX, fromY) meets the target. */
export function leadPoint(from: { x: number; y: number }, target: AimTarget, speed: number): { x: number; y: number } {
  const dist = Math.hypot(target.x - from.x, target.y - from.y);
  const t = dist / Math.max(1, speed);
  return { x: target.x + target.vx * t, y: target.y + target.vy * t };
}

/** Move the pointer to `point` (clamped to the canvas), dispatching a pointermove. */
export async function aimAt(harness: Harness, point: { x: number; y: number }, scroll: { x: number; y: number } = { x: 0, y: 0 }): Promise<void> {
  const sx = Math.max(1, Math.min(959, point.x - scroll.x));
  const sy = Math.max(1, Math.min(539, point.y - scroll.y));
  await pointerAt(harness, 'pointermove', sx, sy);
}
