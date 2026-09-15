/**
 * Camera follow system for generated games.
 *
 * Provides smooth camera following with deadzone, look-ahead, and screen shake
 * integration. Pure math - no Phaser dependency - so it can be tested in isolation
 * and integrated into any rendering layer.
 */

export interface Vec2 {
  readonly x: number;
  readonly y: number;
}

export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface CameraFollowConfig {
  /** Smooth follow speed (0 = instant, 1 = no movement). */
  readonly smoothing: number;
  /** Deadzone: camera only moves when target exits this rectangle. */
  readonly deadzone: Rect | null;
  /** Look-ahead distance in the direction of movement. */
  readonly lookAhead: Vec2;
  /** Minimum movement threshold to trigger camera update. */
  readonly threshold: number;
  /** World bounds: camera clamps to this rectangle. */
  readonly bounds: Rect | null;
}

export interface CameraState {
  readonly position: Vec2;
  readonly targetPosition: Vec2;
  readonly viewport: { width: number; height: number };
}

const DEFAULT_CONFIG: CameraFollowConfig = {
  smoothing: 0.15,
  deadzone: null,
  lookAhead: { x: 0, y: 0 },
  threshold: 0.5,
  bounds: null,
};

/**
 * Creates a camera follow state.
 */
export function createCameraState(viewportWidth: number, viewportHeight: number): CameraState {
  return {
    position: { x: 0, y: 0 },
    targetPosition: { x: 0, y: 0 },
    viewport: { width: viewportWidth, height: viewportHeight },
  };
}

/**
 * Updates the camera to follow a target position.
 *
 * Pure function - returns a new state, never mutates the input.
 */
export function updateCameraFollow(
  state: CameraState,
  targetX: number,
  targetY: number,
  velocityX: number,
  velocityY: number,
  config: CameraFollowConfig = DEFAULT_CONFIG,
): CameraState {
  // Calculate desired position with look-ahead
  const desiredX = targetX - state.viewport.width / 2 + velocityX * config.lookAhead.x;
  const desiredY = targetY - state.viewport.height / 2 + velocityY * config.lookAhead.y;

  // Apply deadzone
  let finalX = state.position.x;
  let finalY = state.position.y;

  if (config.deadzone) {
    const dz = config.deadzone;
    const camCenterX = state.position.x + state.viewport.width / 2;
    const camCenterY = state.position.y + state.viewport.height / 2;
    const dx = targetX - camCenterX;
    const dy = targetY - camCenterY;

    if (dx > dz.width / 2) finalX = state.position.x + (dx - dz.width / 2);
    else if (dx < -dz.width / 2) finalX = state.position.x + (dx + dz.width / 2);
    else finalX = state.position.x;

    if (dy > dz.height / 2) finalY = state.position.y + (dy - dz.height / 2);
    else if (dy < -dz.height / 2) finalY = state.position.y + (dy + dz.height / 2);
    else finalY = state.position.y;
  } else {
    finalX = desiredX;
    finalY = desiredY;
  }

  // Apply smoothing
  const smoothX = state.position.x + (finalX - state.position.x) * (1 - config.smoothing);
  const smoothY = state.position.y + (finalY - state.position.y) * (1 - config.smoothing);

  // Apply threshold
  const dx = Math.abs(smoothX - state.position.x);
  const dy = Math.abs(smoothY - state.position.y);
  const posX = dx < config.threshold ? state.position.x : smoothX;
  const posY = dy < config.threshold ? state.position.y : smoothY;

  // Apply bounds
  let clampedX = posX;
  let clampedY = posY;
  if (config.bounds) {
    const b = config.bounds;
    clampedX = Math.max(b.x, Math.min(b.x + b.width - state.viewport.width, posX));
    clampedY = Math.max(b.y, Math.min(b.y + b.height - state.viewport.height, posY));
  }

  return {
    ...state,
    position: { x: clampedX, y: clampedY },
    targetPosition: { x: desiredX, y: desiredY },
  };
}

/**
 * Checks if a world-space point is visible in the camera viewport.
 */
export function isPointVisible(state: CameraState, x: number, y: number, margin = 0): boolean {
  return (
    x >= state.position.x - margin &&
    x <= state.position.x + state.viewport.width + margin &&
    y >= state.position.y - margin &&
    y <= state.position.y + state.viewport.height + margin
  );
}

/**
 * Converts world coordinates to screen coordinates.
 */
export function worldToScreen(state: CameraState, worldX: number, worldY: number): Vec2 {
  return {
    x: worldX - state.position.x,
    y: worldY - state.position.y,
  };
}

/**
 * Converts screen coordinates to world coordinates.
 */
export function screenToWorld(state: CameraState, screenX: number, screenY: number): Vec2 {
  return {
    x: screenX + state.position.x,
    y: screenY + state.position.y,
  };
}
