/**
 * Wall-slide / wall-jump / ledge grammar (Category-C Wave 30; ledges and the
 * movement state machine added by the Final Product Completion program,
 * Wave 1 - matrix L03).
 *
 * Renderer-neutral contact with authored vertical surfaces and ledge corners.
 * Two bounded modes (not two engines):
 *   - `slide` - hold into a wall while airborne to cap fall speed; jump
 *     climbs the wall.
 *   - `leap`  - the same contact, but jump kicks away to a distant goal.
 *
 * Ledges are authored corners: when the player is airborne, moving toward
 * the ledge's open side and inside its grab box, the service enters
 * `ledge-hang` and pins the player at the hang position. From a hang: UP
 * climbs onto the ledge top (`climbing` for `climbMs`, then `grounded`), DOWN
 * drops (`airborne`, with a short regrab lockout), JUMP launches upward with
 * `hangJumpVy`. Wall-slide and ledge-hang are mutually exclusive by
 * construction (a hang wins), and a grapple/other force releases the hang
 * through `release()`.
 */

export const WALL_CAPABILITY_ID = 'movement.wall';

export type WallMode = 'slide' | 'leap';
export type WallOutcome = 'playing' | 'complete' | 'failed';
export type WallMoveState = 'grounded' | 'airborne' | 'sliding' | 'ledge-hang' | 'climbing';

export interface WallDef {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly halfWidth: number;
  readonly halfHeight: number;
}

export interface LedgeDef {
  readonly id: string;
  /** The ledge corner (top edge of the surface the player hangs on). */
  readonly x: number;
  readonly y: number;
  /** Which side of the corner is open air: the player hangs on that side and climbs the other way. */
  readonly side: 'left' | 'right';
  /** Half-size of the grab box centred on the hang position. */
  readonly grabHalfWidth: number;
  readonly grabHalfHeight: number;
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
  /** Ledge grammar (optional for older content; an empty list disables ledges). */
  readonly ledges?: readonly LedgeDef[];
  /** Vertical hang offset below the ledge corner (player centre). Default 22. */
  readonly hangOffsetY?: number;
  /** Horizontal hang offset from the corner toward the open side. Default 14. */
  readonly hangOffsetX?: number;
  /** Jump velocity when jumping straight up from a hang. Default jumpVy. */
  readonly hangJumpVy?: number;
  /** How long the climb-up takes. Default 180. */
  readonly climbMs?: number;
  /** Regrab lockout after a drop. Default 220. */
  readonly regrabLockoutMs?: number;
}

export interface WallService {
  mode(): WallMode;
  active(): boolean;
  setPlayer(x: number, y: number, vx: number, vy: number, onGround: boolean): void;
  setHoldX(axis: number): void;
  tick(deltaMs: number): void;
  /** Wall-jump from a slide, or a straight jump from a hang. Null when neither applies. */
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
  // --- ledge grammar ---
  state(): WallMoveState;
  ledgeId(): string | null;
  /** Position the shell should pin the player to while hanging/climbing, else null. */
  pinned(): { readonly x: number; readonly y: number } | null;
  /** UP from a hang: begin the climb. Returns false when not hanging. */
  climb(): boolean;
  /** DOWN from a hang: let go. Returns false when not hanging. */
  drop(): boolean;
  /** External release (grapple fired, damage). No-op unless hanging/climbing. */
  release(): void;
  /** Counts of transitions, for HUD/proof: grabs, climbs, drops. */
  ledgeStats(): { readonly grabs: number; readonly climbs: number; readonly drops: number };
}
