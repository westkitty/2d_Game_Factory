/**
 * Scrolling stage (Category-C capability program, Wave 8).
 *
 * Renderer-neutral shmup stage progress. The ship stays in a screen-space
 * band while the stage streams past; hazards are authored along the stage
 * and enter from the incoming edge. Not a rail-path camera, not parallax
 * authoring, not a second combat/weapons authority.
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

/** The validated `content/stage-scroll.json` document. */
export interface StageScrollCatalog {
  readonly schemaVersion: number;
  readonly mode: StageScrollMode;
  readonly speed: number;
  readonly length: number;
  readonly viewport: StageScrollViewportDef;
  readonly player: StageScrollPlayerDef;
  readonly hazards: readonly StageScrollHazardDef[];
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
