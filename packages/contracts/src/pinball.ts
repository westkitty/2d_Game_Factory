/**
 * Arcade pinball table (Category-C Wave 33).
 *
 * Renderer-neutral ball, bumpers, optional flippers, drain and score.
 * Two bounded modes:
 *   - `table` — flippers + bumpers, complete at score.
 *   - `toy`   — launch into a goal pocket (bumpers optional).
 *
 * Not Matter and not ball-paddle breakout/pong.
 */

export const PINBALL_CAPABILITY_ID = 'arcade.table';

export type PinballMode = 'table' | 'toy';
export type PinballOutcome = 'playing' | 'complete' | 'failed';

export interface PinballBumperDef {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly radius: number;
  readonly score: number;
}

export interface PinballCatalog {
  readonly schemaVersion: number;
  readonly mode: PinballMode;
  readonly ball: { readonly x: number; readonly y: number; readonly radius: number; readonly vx: number; readonly vy: number };
  readonly gravity: number;
  readonly bounce: number;
  readonly bounds: { readonly minX: number; readonly maxX: number; readonly minY: number; readonly maxY: number };
  readonly bumpers: readonly PinballBumperDef[];
  readonly flippers?: readonly { readonly id: string; readonly x: number; readonly y: number; readonly halfWidth: number; readonly kick: number }[];
  readonly goal?: { readonly x: number; readonly y: number; readonly radius: number };
  readonly drainY: number;
  readonly winScore: number;
  /** Table balls / lives. Drain consumes one; 0 ends the game. Default 3 for table. */
  readonly balls?: number;
}

export interface PinballService {
  mode(): PinballMode;
  active(): boolean;
  tick(deltaMs: number): void;
  flip(side: 'left' | 'right'): void;
  launch(vx: number, vy: number): void;
  ballX(): number;
  ballY(): number;
  score(): number;
  ballsRemaining(): number;
  lastResult(): string | null;
  outcome(): PinballOutcome;
  reset(): void;
}
