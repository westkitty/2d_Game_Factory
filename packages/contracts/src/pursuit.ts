/**
 * Pursuit pressure (Final Product Completion, Wave 1 - matrix L01/L02).
 *
 * Renderer-neutral "something is closing on the player" pressure for the
 * platforming family. One reusable service, two bounded modes:
 *
 *   - `wall`   - an absolute-position pursuer (a closing wall) that advances
 *                at a constant speed from `startX`; the player escapes by
 *                reaching `escapeX` on the ground and is caught when the
 *                pursuer comes within `catchDistance`.
 *   - `chaser` - a relative pursuer that trails the player by a gap. The gap
 *                recovers toward `maxGap` while the player runs and closes at
 *                `closeSpeed` while the player is stumbling (hit a hazard,
 *                landed short, stood still). Caught at `catchDistance`;
 *                `escapeX` is optional (a course has one, endless play does
 *                not - its completion comes from the arcade ledger).
 *
 * Consumers: chase-platformer (`wall`), endless-runner and auto-runner
 * (`chaser`). Not an enemy AI: there is no navigation, no vision, no combat -
 * pressure along the run axis only.
 */

export const PURSUIT_CAPABILITY_ID = 'movement.pursuit';

export type PursuitMode = 'wall' | 'chaser';
export type PursuitOutcome = 'playing' | 'complete' | 'failed';

export interface PursuitCatalog {
  readonly schemaVersion: number;
  readonly mode: PursuitMode;
  /** Where the pursuer (wall) or the player (chaser gap origin) starts. */
  readonly startX: number;
  /** Wall: advance speed in px/s. Chaser: unused (gap-based). */
  readonly speed: number;
  /** Distance at which the pursuer catches the player. */
  readonly catchDistance: number;
  /** Reaching this x on the ground escapes. Null = no escape line (endless). */
  readonly escapeX: number | null;
  /** Chaser: gap the pursuer settles at while the player runs cleanly. */
  readonly maxGap: number;
  /** Chaser: how fast the gap shrinks (px/s) while the player stumbles. */
  readonly closeSpeed: number;
  /** Chaser: how fast the gap recovers (px/s) while the player runs. */
  readonly recoverSpeed: number;
  /** Default stumble duration in ms when `stumble()` is called without one. */
  readonly stumbleMs: number;
  /** Player y beyond which the run has fallen (failed). */
  readonly failY: number;
}

export interface PursuitService {
  mode(): PursuitMode;
  /** False for the inert empty catalog. */
  active(): boolean;
  setPlayer(x: number, y: number, onGround: boolean): void;
  /** Chaser: the player tripped; the gap closes for `durationMs` (default catalog stumbleMs). */
  stumble(durationMs?: number): void;
  stumbling(): boolean;
  stumbleMsLeft(): number;
  stumbles(): number;
  tick(deltaMs: number): void;
  pursuerX(): number;
  /** Distance between pursuer and player along x (positive = pursuer behind). */
  gap(): number;
  escapeX(): number | null;
  outcome(): PursuitOutcome;
  lastResult(): string | null;
  reset(): void;
}
