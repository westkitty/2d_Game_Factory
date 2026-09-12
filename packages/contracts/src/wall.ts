/**
 * Wall-slide / wall-jump (Category-C Wave 30).
 *
 * Renderer-neutral contact with authored vertical surfaces. Two bounded
 * modes (not two engines):
 *   - `slide` — hold into a wall while airborne to cap fall speed; jump
 *     climbs the wall.
 *   - `leap`  — the same contact, but jump kicks away to a distant goal.
 *
 * Not a full parkour grammar (ledge-grab stays out).
 */

export const WALL_CAPABILITY_ID = 'movement.wall';

export type WallMode = 'slide' | 'leap';
export type WallOutcome = 'playing' | 'complete' | 'failed';

export interface WallDef {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly halfWidth: number;
  readonly halfHeight: number;
}

export interface WallCatalog {
  readonly schemaVersion: number;
  readonly mode: WallMode;
  readonly player: { readonly x: number; readonly y: number; readonly radius: number };
  readonly walls: readonly WallDef[];
  readonly slideSpeed: number;
  readonly jumpVx: number;
  readonly jumpVy: number;
  readonly goal: { readonly x: number; readonly y: number; readonly radius: number };
  readonly failY: number;
}

export interface WallService {
  mode(): WallMode;
  active(): boolean;
  setPlayer(x: number, y: number, vx: number, vy: number, onGround: boolean): void;
  setHoldX(axis: number): void;
  tick(deltaMs: number): void;
  jump(): { readonly vx: number; readonly vy: number } | null;
  sliding(): boolean;
  wallId(): string | null;
  x(): number;
  y(): number;
  vx(): number;
  vy(): number;
  lastResult(): string | null;
  outcome(): WallOutcome;
  reset(): void;
}
