/**
 * Spatial pointer and world-space interaction.
 *
 * This is the layer `ActionInput` deliberately does not have (ADR-0003,
 * ADR-0016): a cursor position, a world-space point, hover targets, drag
 * vectors. Keeping it a separate service - never fields bolted onto
 * `ActionInput` - is what preserves the semantic layer's one-frame-owner,
 * presses-are-claimed guarantee for the digital actions that still need it.
 *
 * Everything here is renderer-neutral. A Phaser scene bridge (in
 * `@sw2d/runtime`) maps real game objects and camera transforms onto these
 * shapes; `@sw2d/contracts` stays free of Phaser so the CLI, schema tooling
 * and QA harness can still consume it without a renderer.
 */

import type { Disposable } from './disposable.ts';

/** Which physical pointer kind last drove the spatial pointer. */
export type PointerSourceKind = 'mouse' | 'pen' | 'touch';

/**
 * Renderer-neutral pointer state, advanced exactly once per runtime frame by
 * the runtime's spatial pointer host - the same single-owner discipline
 * `ActionInputHost` applies to digital actions, for the same reason: two
 * readers in one frame must agree.
 */
export interface SpatialPointerState {
  /** Canvas-space pixel position (origin top-left), independent of camera. */
  readonly screenX: number;
  readonly screenY: number;
  /**
   * World-space position, resolved through the active camera's scroll, zoom
   * and rotation. Equal to `screenX`/`screenY` when no camera is active
   * (e.g. the title screen).
   */
  readonly worldX: number;
  readonly worldY: number;
  /** Primary button / touch contact held this frame. */
  readonly down: boolean;
  /** Transitioned to down during this frame. Latched for one frame. */
  readonly justPressed: boolean;
  /** Transitioned to up during this frame. Latched for one frame. */
  readonly justReleased: boolean;
  /** Device kind that last moved or pressed the pointer, or null if never. */
  readonly source: PointerSourceKind | null;
  /** Pointer is currently over the game canvas. */
  readonly inside: boolean;
  /** The pointer has produced at least one real event since the host started. */
  readonly active: boolean;
  /** A drag is in progress (pressed and moved past the drag threshold). */
  readonly dragging: boolean;
  /** World-space point where the current (or most recent) drag began. */
  readonly dragStartWorldX: number;
  readonly dragStartWorldY: number;
  /** World-space displacement from the drag start to the current position. */
  readonly dragDeltaWorldX: number;
  readonly dragDeltaWorldY: number;
}

/**
 * Read-only spatial pointer, as seen by scene and game-specific code.
 *
 * Frame advancement is deliberately absent from this interface: only the
 * runtime host advances it, so a pack cannot corrupt another pack's
 * `justPressed` read - identical to `ActionInput`.
 */
export interface SpatialPointerInput {
  readonly state: SpatialPointerState;
  /** Current world-space point as a tuple, for terse call sites. */
  worldPoint(): readonly [number, number];
}

/** What the runtime's DOM translator writes into. It never computes edges. */
export interface SpatialPointerSink {
  setPointerPosition(screenX: number, screenY: number, source: PointerSourceKind): void;
  setPointerButton(down: boolean, source: PointerSourceKind): void;
  setPointerInside(inside: boolean): void;
}

// --- Hit shapes -------------------------------------------------------------

export interface RectHitShape {
  readonly kind: 'rect';
  /** Top-left corner in world space. */
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface CircleHitShape {
  readonly kind: 'circle';
  /** Centre in world space. */
  readonly x: number;
  readonly y: number;
  readonly radius: number;
}

export interface PolygonHitShape {
  readonly kind: 'polygon';
  /** World-space vertices, in order. At least three. */
  readonly points: readonly (readonly [number, number])[];
}

export type HitShape = RectHitShape | CircleHitShape | PolygonHitShape;

/**
 * Whether a world-space point lies inside a hit shape.
 *
 * Pure and deterministic. Rectangles and circles are inclusive of their
 * boundary; polygons use an even-odd ray cast with a boundary point counted
 * as inside.
 */
export function hitTestPoint(shape: HitShape, worldX: number, worldY: number): boolean {
  switch (shape.kind) {
    case 'rect':
      return (
        worldX >= shape.x &&
        worldX <= shape.x + shape.width &&
        worldY >= shape.y &&
        worldY <= shape.y + shape.height
      );
    case 'circle': {
      const dx = worldX - shape.x;
      const dy = worldY - shape.y;
      return dx * dx + dy * dy <= shape.radius * shape.radius;
    }
    case 'polygon': {
      const pts = shape.points;
      let inside = false;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const [xi, yi] = pts[i]!;
        const [xj, yj] = pts[j]!;
        // Exact boundary hit.
        if (pointOnSegment(worldX, worldY, xi, yi, xj, yj)) return true;
        const intersects = yi > worldY !== yj > worldY && worldX < ((xj - xi) * (worldY - yi)) / (yj - yi) + xi;
        if (intersects) inside = !inside;
      }
      return inside;
    }
  }
}

function pointOnSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): boolean {
  const cross = (px - ax) * (by - ay) - (py - ay) * (bx - ax);
  if (Math.abs(cross) > 1e-6) return false;
  const dot = (px - ax) * (bx - ax) + (py - ay) * (by - ay);
  if (dot < 0) return false;
  const lenSq = (bx - ax) * (bx - ax) + (by - ay) * (by - ay);
  return dot <= lenSq;
}

// --- Aim bridge -----------------------------------------------------------

export interface AimVector {
  /** Unit-length x component, or 0 when origin and pointer coincide. */
  readonly aimX: number;
  readonly aimY: number;
  /** 1 when a direction exists, 0 when origin and pointer coincide. */
  readonly aimMagnitude: number;
}

/**
 * A unit aim vector from a world origin toward a world pointer position.
 *
 * Complements - never replaces - the digital `AIM_*` axis (ADR-0016). A game
 * that wants mouse aim reads this when the digital aim magnitude is zero;
 * twin-stick keyboard/numpad aim stays authoritative when it is pressed.
 */
export function aimFromPointer(
  originWorldX: number,
  originWorldY: number,
  pointerWorldX: number,
  pointerWorldY: number,
): AimVector {
  const dx = pointerWorldX - originWorldX;
  const dy = pointerWorldY - originWorldY;
  const length = Math.hypot(dx, dy);
  if (length === 0) return { aimX: 0, aimY: 0, aimMagnitude: 0 };
  return { aimX: dx / length, aimY: dy / length, aimMagnitude: 1 };
}

// --- Interaction targeting ------------------------------------------------

export interface InteractionPointerInfo {
  readonly worldX: number;
  readonly worldY: number;
  readonly source: PointerSourceKind | null;
}

export interface InteractionDragInfo extends InteractionPointerInfo {
  readonly startWorldX: number;
  readonly startWorldY: number;
  readonly deltaWorldX: number;
  readonly deltaWorldY: number;
}

/**
 * A registered interaction target.
 *
 * `shape` may be a fixed value or a provider called each frame - the Phaser
 * bridge passes a provider that reads a live game object's bounds, so a
 * target that moves stays hittable without re-registration. A provider
 * returning `null` makes the target un-hittable that frame (e.g. its object
 * was destroyed) without an error.
 */
export interface InteractionTargetOptions {
  readonly id: string;
  readonly shape: HitShape | (() => HitShape | null);
  /** Higher wins when shapes overlap. Ties break toward the most recently registered. Default 0. */
  readonly priority?: number;
  /** Default true. A disabled target is skipped by hit-testing entirely. */
  readonly enabled?: boolean;
  /** Marks this target as a valid drop destination for a drag begun on another target. */
  readonly dropZone?: boolean;
  readonly onHoverEnter?: (info: InteractionPointerInfo) => void;
  readonly onHoverLeave?: (info: InteractionPointerInfo) => void;
  readonly onPress?: (info: InteractionPointerInfo) => void;
  readonly onRelease?: (info: InteractionPointerInfo) => void;
  /** Press then release without an intervening drag, both over this target. */
  readonly onClick?: (info: InteractionPointerInfo) => void;
  readonly onDragStart?: (info: InteractionDragInfo) => void;
  readonly onDrag?: (info: InteractionDragInfo) => void;
  readonly onDragEnd?: (info: InteractionDragInfo & { readonly dropTargetId: string | null }) => void;
  /** Fired on a drop-zone target when a drag from `sourceId` releases over it. */
  readonly onDrop?: (info: InteractionDragInfo & { readonly sourceId: string }) => void;
}

export interface InteractionTargetHandle extends Disposable {
  readonly id: string;
  readonly enabled: boolean;
  setEnabled(enabled: boolean): void;
}

/**
 * Scene-scoped world-space interaction.
 *
 * Renderer-neutral by contract; the runtime supplies a Phaser-backed
 * implementation on `SceneContext`. Targets are owned by the scene and
 * disposed with it - a rising `targetCount` across restarts is a leak.
 */
export interface InteractionService {
  register(options: InteractionTargetOptions): InteractionTargetHandle;
  unregister(id: string): void;
  /** The id currently under the pointer, or null. */
  readonly hoveredId: string | null;
  /** The id the pointer pressed on and has not released, or null. */
  readonly pressedId: string | null;
  /** The id of an in-progress drag (pointer-captured), or null. */
  readonly draggingId: string | null;
  /** Live registered-target count. Diagnostics only. */
  readonly targetCount: number;
}
