import { describe, expect, it } from 'vitest';
import {
  CLIMBING_CAPABILITY_ID,
  validateClimbingConfig,
  InvalidClimbingConfigError,
  type ClimbingConfig,
} from '../src/climbing.ts';

describe('climbing contracts', () => {
  const validConfig: ClimbingConfig = {
    wallSlideMaxSpeed: 80,
    wallFriction: 0.2,
    wallJumpVelocityX: 200,
    wallJumpVelocityY: 260,
    wallStickMs: 150,
    ledgeGrabToleranceX: 16,
    ledgeGrabToleranceY: 16,
    ladderClimbSpeed: 100,
    enableLedgeClimb: true,
  };

  it('validates a correct climbing config', () => {
    expect(() => validateClimbingConfig(validConfig)).not.toThrow();
  });

  it('rejects wallSlideMaxSpeed <= 0', () => {
    expect(() => validateClimbingConfig({ ...validConfig, wallSlideMaxSpeed: 0 })).toThrow(
      InvalidClimbingConfigError,
    );
  });

  it('rejects ladderClimbSpeed <= 0', () => {
    expect(() => validateClimbingConfig({ ...validConfig, ladderClimbSpeed: -10 })).toThrow(
      InvalidClimbingConfigError,
    );
  });

  it('rejects wallJumpVelocityX <= 0', () => {
    expect(() => validateClimbingConfig({ ...validConfig, wallJumpVelocityX: 0 })).toThrow(
      InvalidClimbingConfigError,
    );
  });

  it('rejects wallJumpVelocityY <= 0', () => {
    expect(() => validateClimbingConfig({ ...validConfig, wallJumpVelocityY: -50 })).toThrow(
      InvalidClimbingConfigError,
    );
  });

  it('rejects negative tolerances and friction', () => {
    expect(() => validateClimbingConfig({ ...validConfig, wallFriction: -1 })).toThrow(
      InvalidClimbingConfigError,
    );
    expect(() => validateClimbingConfig({ ...validConfig, wallStickMs: -5 })).toThrow(
      InvalidClimbingConfigError,
    );
    expect(() => validateClimbingConfig({ ...validConfig, ledgeGrabToleranceX: -1 })).toThrow(
      InvalidClimbingConfigError,
    );
    expect(() => validateClimbingConfig({ ...validConfig, ledgeGrabToleranceY: -1 })).toThrow(
      InvalidClimbingConfigError,
    );
  });

  it('exposes correct capability id', () => {
    expect(CLIMBING_CAPABILITY_ID).toBe('movement.climbing');
  });
});
