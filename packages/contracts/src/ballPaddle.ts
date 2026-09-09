/**
 * Arcade ball / paddle / rebound (Category-C capability program, Wave 5).
 *
 * Renderer-neutral table physics. One reusable service covers the common
 * breakout / pong loop: serve, paddle rebound, wall bounce, scoring or
 * brick-clear, miss/drain, reset. Not Matter, not pinball, not local
 * multiplayer input routing.
 *
 * Two bounded modes (not two engines):
 *   - `breakout` — one paddle, bricks, lives, clear-or-drain.
 *   - `pong`     — one player paddle, a chasing opponent, first-to-N.
 */

export const BALL_PADDLE_CAPABILITY_ID = 'arcade.ball';

export type BallPaddleMode = 'breakout' | 'pong';
export type BallPaddleOutcome = 'playing' | 'complete' | 'failed';
export type BallPaddleAxis = 'x' | 'y';

export interface BallPaddlePaddleDef {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly speed: number;
  readonly axis: BallPaddleAxis;
  readonly min: number;
  readonly max: number;
  /** Hit half-extent along the paddle's long axis. */
  readonly hitHalf: number;
}

export interface BallPaddleBallDef {
  readonly x: number;
  readonly y: number;
  readonly vx: number;
  readonly vy: number;
  readonly radius: number;
}

export interface BallPaddleBrickDef {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly halfWidth: number;
  readonly halfHeight: number;
}

export interface BallPaddleWallsDef {
  readonly insetX: number;
  readonly top: number;
  readonly bottom: number;
}

export interface BallPaddleBreakoutDef {
  readonly contactDivisor: number;
  readonly contactScale: number;
  readonly moveScale: number;
  readonly minSpeedX: number;
  readonly maxSpeedX: number;
  readonly parkOffset: number;
  readonly serveSpeed: number;
  readonly contactNear: number;
  readonly contactFar: number;
  readonly brickScore: number;
}

export interface BallPaddlePongDef {
  readonly opponentX: number;
  readonly opponentY: number;
  readonly opponentWidth: number;
  readonly opponentHeight: number;
  readonly opponentHitHalf: number;
  readonly lerpMs: number;
  readonly playerMinX: number;
  readonly playerMaxX: number;
  readonly opponentMinX: number;
  readonly opponentMaxX: number;
  readonly speedBump: number;
  readonly serveSpeed: number;
  readonly scorePast: number;
  readonly winScore: number;
}

/** The validated `content/ball-paddle.json` document. */
export interface BallPaddleCatalog {
  readonly schemaVersion: number;
  readonly mode: BallPaddleMode;
  readonly court: { readonly width: number; readonly height: number };
  readonly paddle: BallPaddlePaddleDef;
  readonly ball: BallPaddleBallDef;
  readonly walls: BallPaddleWallsDef;
  readonly bricks: readonly BallPaddleBrickDef[];
  readonly lives: number;
  readonly pong?: BallPaddlePongDef;
  readonly breakout?: BallPaddleBreakoutDef;
}

export interface BallPaddleBrickState {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly halfWidth: number;
  readonly halfHeight: number;
  readonly alive: boolean;
}

export interface BallPaddleService {
  mode(): BallPaddleMode;
  /** False when the catalog has no bricks and no pong table (inert empty document). */
  active(): boolean;
  setPaddleAxis(axis: number): void;
  tick(deltaMs: number): void;
  paddle(): { readonly x: number; readonly y: number; readonly width: number; readonly height: number };
  opponent(): { readonly x: number; readonly y: number; readonly width: number; readonly height: number } | null;
  ball(): { readonly x: number; readonly y: number; readonly vx: number; readonly vy: number; readonly radius: number };
  bricks(): readonly BallPaddleBrickState[];
  bricksRemaining(): number;
  lives(): number;
  score(): number;
  playerScore(): number;
  opponentScore(): number;
  paddleReturns(): number;
  lastResult(): string | null;
  outcome(): BallPaddleOutcome;
  reset(): void;
}

export class DuplicateBallPaddleIdError extends Error {
  constructor(id: string) {
    super(`Duplicate ball-paddle id "${id}" in content/ball-paddle.json.`);
    this.name = 'DuplicateBallPaddleIdError';
  }
}
