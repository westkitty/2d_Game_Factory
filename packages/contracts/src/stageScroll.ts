/**
 * Scrolling stage (Category-C capability program, Wave 8; parallax layers
 * and the rail path added by the Final Product Completion program, Wave 3 -
 * matrix L11).
 *
 * Renderer-neutral shmup stage progress. The ship stays in a screen-space
 * band while the stage streams past; hazards are authored along the stage
 * and enter from the incoming edge. Parallax `layers` are authored depth
 * planes the shell draws at `offset * speedFactor`; the `rail` is a list of
 * segments along the stage that change the scroll speed and drift the camera
 * across the other axis (a 2D rail path made of straight legs), which every
 * hazard, layer and enemy formation follows through `crossOffset()`. Not a
 * second combat/weapons authority (enemy formations are `sw2d.encounters`).
 *
 * Two bounded modes (not two engines):
 *   - `horizontal` — stage streams left; default fire is +X (horizontal-shmup).
 *   - `vertical`   — stage streams down (fly up); default fire is -Y (vertical-shmup).
 */

export const STAGE_SCROLL_CAPABILITY_ID = 'world.scroll';

export type StageScrollMode = 'horizontal' | 'vertical';
export type StageScrollOutcome = 'playing' | 'complete';

export interface StageScrollPlayerDef {
  readonly x: number;
  readonly y: number;
  readonly radius: number;
  readonly speed: number;
  readonly minX: number;
  readonly maxX: number;
  readonly minY: number;
  readonly maxY: number;
}

export interface StageScrollHazardDef {
  readonly id: string;
  /** Stage distance at which this hazard sits on the incoming edge. */
  readonly along: number;
  /** The other axis, in screen space. */
  readonly cross: number;
  readonly radius: number;
}

export interface StageScrollViewportDef {
  readonly width: number;
  readonly height: number;
}

export interface StageScrollLayerDef {
  readonly id: string;
  /** Fraction of the stage speed this plane moves at (0.2 far, 1 foreground). */
  readonly speedFactor: number;
  /** Repeat distance of the plane's tiles. */
  readonly spacing: number;
  /** Tile size drawn by the shell. */
  readonly size: number;
  /** 0..1 opacity hint. */
  readonly alpha: number;
  /** Cross-axis position of the plane's row / column (screen space). */
  readonly cross: number;
}

export interface StageScrollRailSegmentDef {
  /** Stage distance at which this leg starts. */
  readonly from: number;
  /** Scroll speed on this leg (px/s along the stage). */
  readonly speed: number;
  /** Camera drift across the other axis on this leg (px/s). */
  readonly crossDrift: number;
}

/** The validated `content/stage-scroll.json` document. */
export interface StageScrollCatalog {
  readonly schemaVersion: number;
  readonly mode: StageScrollMode;
  readonly speed: number;
  readonly length: number;
  readonly viewport: StageScrollViewportDef;
  readonly player: StageScrollPlayerDef;
  readonly hazards: readonly StageScrollHazardDef[];
  readonly layers?: readonly StageScrollLayerDef[];
  readonly rail?: readonly StageScrollRailSegmentDef[];
}

export interface StageScrollLayerState {
  readonly id: string;
  /** Scrolled distance of this plane (offset * speedFactor). */
  readonly offset: number;
  readonly speedFactor: number;
  readonly spacing: number;
  readonly size: number;
  readonly alpha: number;
  readonly cross: number;
}

export interface StageScrollHazardState {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly radius: number;
  readonly visible: boolean;
}

export interface StageScrollService {
  mode(): StageScrollMode;
  /** False when length or speed is not positive (inert empty document). */
  active(): boolean;
  setMove(x: number, y: number): void;
  tick(deltaMs: number): void;
  offset(): number;
  progress(): number;
  player(): { readonly x: number; readonly y: number; readonly radius: number };
  fireDir(): { readonly x: number; readonly y: number };
  hazards(): readonly StageScrollHazardState[];
  /** Parallax planes with their current offsets (empty when none authored). */
  layers(): readonly StageScrollLayerState[];
  /** Current scroll speed (the active rail leg's, or the catalog speed). */
  currentSpeed(): number;
  /** Accumulated camera drift across the other axis (the rail path). */
  crossOffset(): number;
  /** Index of the active rail leg, or -1 without a rail. */
  railLeg(): number;
  lastHit(): string | null;
  outcome(): StageScrollOutcome;
  reset(): void;
}

export class DuplicateStageScrollIdError extends Error {
  constructor(id: string) {
    super(`Duplicate stage-scroll id \"${id}\" in content/stage-scroll.json.`);
    this.name = 'DuplicateStageScrollIdError';
  }
}
