/**
 * Enhanced platformer movement helpers.
 *
 * Provides coyote time, jump buffering, and variable jump height - the three
 * mechanics that separate a frustrating platformer from a good one.
 *
 * Pure functions that operate on plain state objects, so they can be tested
 * without a physics engine and integrated into any platformer game.
 */

export interface PlatformerAssistState {
  /** Time since the player last stood on ground (ms). */
  coyoteTimeRemaining: number;
  /** Time remaining for a buffered jump input (ms). */
  jumpBufferRemaining: number;
  /** Whether the player is currently holding the jump button. */
  jumpHeld: boolean;
  /** Whether the player released the jump button while ascending. */
  jumpCut: boolean;
}

export interface PlatformerAssistConfig {
  /** How long after leaving ground the player can still jump (ms). */
  readonly coyoteTimeMs: number;
  /** How long before landing a jump input is remembered (ms). */
  readonly jumpBufferMs: number;
  /** Multiplier applied to gravity when jump is cut short (>= 1.0). */
  readonly jumpCutGravityMultiplier: number;
  /** Minimum jump velocity when jump is cut (0 = no minimum). */
  readonly minJumpVelocity: number;
}

const DEFAULT_CONFIG: PlatformerAssistConfig = {
  coyoteTimeMs: 100,
  jumpBufferMs: 120,
  jumpCutGravityMultiplier: 2.5,
  minJumpVelocity: 0,
};

/**
 * Creates a fresh platformer assist state.
 */
export function createPlatformerAssistState(): PlatformerAssistState {
  return {
    coyoteTimeRemaining: 0,
    jumpBufferRemaining: 0,
    jumpHeld: false,
    jumpCut: false,
  };
}

/**
 * Updates the platformer assist state for one frame.
 *
 * Pure function - returns a new state object, never mutates the input.
 */
export function updatePlatformerAssist(
  state: PlatformerAssistState,
  deltaMs: number,
  isGrounded: boolean,
  jumpPressed: boolean,
  jumpHeld: boolean,
  config: PlatformerAssistConfig = DEFAULT_CONFIG,
): PlatformerAssistState {
  const next: PlatformerAssistState = { ...state };

  // Update coyote time
  if (isGrounded) {
    next.coyoteTimeRemaining = config.coyoteTimeMs;
  } else {
    next.coyoteTimeRemaining = Math.max(0, state.coyoteTimeRemaining - deltaMs);
  }

  // Update jump buffer
  if (jumpPressed) {
    next.jumpBufferRemaining = config.jumpBufferMs;
  } else {
    next.jumpBufferRemaining = Math.max(0, state.jumpBufferRemaining - deltaMs);
  }

  // Track jump held state
  next.jumpHeld = jumpHeld;

  // Detect jump cut (released while ascending)
  if (state.jumpHeld && !jumpHeld) {
    next.jumpCut = true;
  }

  return next;
}

/**
 * Checks if a jump should be initiated based on current state.
 *
 * Returns true if:
 * - The player is grounded OR within coyote time, AND
 * - A jump was pressed OR a buffered jump is available
 */
export function shouldJump(
  state: PlatformerAssistState,
  isGrounded: boolean,
): boolean {
  const canJump = isGrounded || state.coyoteTimeRemaining > 0;
  const wantsJump = state.jumpBufferRemaining > 0;
  return canJump && wantsJump;
}

/**
 * Gets the effective gravity multiplier based on jump state.
 *
 * Returns higher gravity when the player cuts a jump short, creating
 * the "variable jump height" feel where tapping jump gives a small hop
 * and holding jump gives a full jump.
 */
export function getGravityMultiplier(
  state: PlatformerAssistState,
  verticalVelocity: number,
  config: PlatformerAssistConfig = DEFAULT_CONFIG,
): number {
  // Apply jump cut gravity when:
  // 1. Jump was cut (button released)
  // 2. Player is still ascending (negative Y velocity)
  if (state.jumpCut && verticalVelocity < 0) {
    return config.jumpCutGravityMultiplier;
  }
  return 1.0;
}

/**
 * Applies jump cut to vertical velocity.
 *
 * Call this when initiating a jump to clear the jump cut flag and
 * optionally apply a minimum jump velocity.
 */
export function applyJump(
  state: PlatformerAssistState,
  _verticalVelocity: number,
  jumpVelocity: number,
  config: PlatformerAssistConfig = DEFAULT_CONFIG,
): { state: PlatformerAssistState; velocity: number } {
  const next: PlatformerAssistState = {
    ...state,
    jumpCut: false,
    jumpBufferRemaining: 0,
    coyoteTimeRemaining: 0,
  };

  // Apply jump velocity, respecting minimum if configured
  let velocity = jumpVelocity;
  if (config.minJumpVelocity > 0 && Math.abs(velocity) < config.minJumpVelocity) {
    velocity = -config.minJumpVelocity;
  }

  return { state: next, velocity };
}

/**
 * Formats the assist state for debugging.
 */
export function debugPlatformerAssist(state: PlatformerAssistState): string {
  return [
    `coyote: ${Math.round(state.coyoteTimeRemaining)}ms`,
    `buffer: ${Math.round(state.jumpBufferRemaining)}ms`,
    `held: ${state.jumpHeld}`,
    `cut: ${state.jumpCut}`,
  ].join(', ');
}
