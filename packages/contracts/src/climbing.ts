/**
 * Platformer climbing, wall-slide, wall-jump & ledge-hang (capability program Phase 12).
 *
 * Renderer-neutral, simulation-time contracts for advanced platformer traversal.
 */

export const CLIMBING_CAPABILITY_ID = 'movement.climbing';

export interface ClimbingConfig {
  readonly wallSlideMaxSpeed: number;
  readonly wallFriction: number;
  readonly wallJumpVelocityX: number;
  readonly wallJumpVelocityY: number;
  readonly wallStickMs: number;
  readonly ledgeGrabToleranceX: number;
  readonly ledgeGrabToleranceY: number;
  readonly ladderClimbSpeed: number;
  readonly enableLedgeClimb?: boolean;
}

export type ClimbingMode = 'ground' | 'air' | 'wall-slide' | 'wall-stick' | 'ledge-hang' | 'ladder-climb';

export interface ClimbingState {
  readonly mode: ClimbingMode;
  readonly wallSide: -1 | 1 | 0;
  readonly wallStickRemainingMs: number;
  readonly ledgeX?: number | undefined;
  readonly ledgeY?: number | undefined;
  readonly canWallJump: boolean;
}

export interface ClimbingIntent {
  readonly moveAxis: number;
  readonly climbAxis: number;
  readonly jumpPressed: boolean;
}

export interface ClimbingEnvironmentQuery {
  readonly onGround: boolean;
  readonly touchingWallLeft: boolean;
  readonly touchingWallRight: boolean;
  readonly onLadder?: boolean;
  readonly nearbyLedge?: { readonly x: number; readonly y: number } | null | undefined;
}

export interface ClimbingMovementResolution {
  readonly velocityX?: number | undefined;
  readonly velocityY?: number | undefined;
  readonly state: ClimbingState;
}

export interface ClimbingService {
  config(): ClimbingConfig;
  state(): ClimbingState;
  reset(): void;
  update(
    deltaMs: number,
    currentVelocityY: number,
    intent: ClimbingIntent,
    environment: ClimbingEnvironmentQuery,
  ): ClimbingMovementResolution;
}

export class InvalidClimbingConfigError extends Error {
  constructor(message: string) {
    super(`Invalid climbing config: ${message}`);
    this.name = 'InvalidClimbingConfigError';
  }
}

export function validateClimbingConfig(config: ClimbingConfig): void {
  if (typeof config.wallSlideMaxSpeed !== 'number' || config.wallSlideMaxSpeed <= 0) {
    throw new InvalidClimbingConfigError(`wallSlideMaxSpeed must be > 0 (got ${config.wallSlideMaxSpeed})`);
  }
  if (typeof config.ladderClimbSpeed !== 'number' || config.ladderClimbSpeed <= 0) {
    throw new InvalidClimbingConfigError(`ladderClimbSpeed must be > 0 (got ${config.ladderClimbSpeed})`);
  }
  if (typeof config.wallJumpVelocityX !== 'number' || config.wallJumpVelocityX <= 0) {
    throw new InvalidClimbingConfigError(`wallJumpVelocityX must be > 0 (got ${config.wallJumpVelocityX})`);
  }
  if (typeof config.wallJumpVelocityY !== 'number' || config.wallJumpVelocityY <= 0) {
    throw new InvalidClimbingConfigError(`wallJumpVelocityY must be > 0 (got ${config.wallJumpVelocityY})`);
  }
  if (typeof config.wallFriction !== 'number' || config.wallFriction < 0) {
    throw new InvalidClimbingConfigError(`wallFriction must be >= 0 (got ${config.wallFriction})`);
  }
  if (typeof config.wallStickMs !== 'number' || config.wallStickMs < 0) {
    throw new InvalidClimbingConfigError(`wallStickMs must be >= 0 (got ${config.wallStickMs})`);
  }
  if (typeof config.ledgeGrabToleranceX !== 'number' || config.ledgeGrabToleranceX < 0) {
    throw new InvalidClimbingConfigError(`ledgeGrabToleranceX must be >= 0 (got ${config.ledgeGrabToleranceX})`);
  }
  if (typeof config.ledgeGrabToleranceY !== 'number' || config.ledgeGrabToleranceY < 0) {
    throw new InvalidClimbingConfigError(`ledgeGrabToleranceY must be >= 0 (got ${config.ledgeGrabToleranceY})`);
  }
}
