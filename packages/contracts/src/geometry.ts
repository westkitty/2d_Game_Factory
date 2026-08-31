/**
 * Axis-aligned geometry shared by every placement rule in the factory.
 *
 * Extracted when Phase 21's tower placement needed exactly what Phase 19's
 * station placement already had. One implementation of "does this fit inside
 * that" is the whole point; two would drift on the edge cases (touching edges,
 * inclusive containment) that placement bugs actually live in.
 */

export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface Footprint {
  readonly width: number;
  readonly height: number;
}

export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export const DEFAULT_FOOTPRINT: Footprint = { width: 1, height: 1 };

/** The axis-aligned rect a footprint occupies, centred on its position. */
export function footprintRect(position: Point, footprint: Footprint = DEFAULT_FOOTPRINT): Rect {
  return {
    x: position.x - footprint.width / 2,
    y: position.y - footprint.height / 2,
    width: footprint.width,
    height: footprint.height,
  };
}

/** Inclusive: a rect exactly filling another is contained by it. */
export function rectContains(outer: Rect, inner: Rect): boolean {
  return (
    inner.x >= outer.x &&
    inner.y >= outer.y &&
    inner.x + inner.width <= outer.x + outer.width &&
    inner.y + inner.height <= outer.y + outer.height
  );
}

/** Touching edges do not overlap: two placements may sit flush against each other. */
export function rectsOverlap(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

/** Inclusive of the boundary. */
export function pointInRect(point: Point, rect: Rect): boolean {
  return (
    point.x >= rect.x && point.x <= rect.x + rect.width && point.y >= rect.y && point.y <= rect.y + rect.height
  );
}
