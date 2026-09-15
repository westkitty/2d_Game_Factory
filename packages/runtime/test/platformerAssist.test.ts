/**
 * Tests for the platformer assist helpers.
 */

import { describe, it, expect } from 'vitest';
import {
  createPlatformerAssistState,
  updatePlatformerAssist,
  shouldJump,
  getGravityMultiplier,
  applyJump,
} from '../src/game-support/platformerAssist.ts';

describe('platformerAssist', () => {
  it('starts with zero timers', () => {
    const state = createPlatformerAssistState();
    expect(state.coyoteTimeRemaining).toBe(0);
    expect(state.jumpBufferRemaining).toBe(0);
    expect(state.jumpHeld).toBe(false);
    expect(state.jumpCut).toBe(false);
  });

  it('sets coyote time when grounded', () => {
    const state = createPlatformerAssistState();
    const next = updatePlatformerAssist(state, 16, true, false, false);
    expect(next.coyoteTimeRemaining).toBe(100);
  });

  it('decays coyote time when airborne', () => {
    const state = createPlatformerAssistState();
    const grounded = updatePlatformerAssist(state, 16, true, false, false);
    expect(grounded.coyoteTimeRemaining).toBe(100);

    const airborne = updatePlatformerAssist(grounded, 50, false, false, false);
    expect(airborne.coyoteTimeRemaining).toBe(50);

    const expired = updatePlatformerAssist(airborne, 60, false, false, false);
    expect(expired.coyoteTimeRemaining).toBe(0);
  });

  it('buffers jump input', () => {
    const state = createPlatformerAssistState();
    const next = updatePlatformerAssist(state, 16, false, true, true);
    expect(next.jumpBufferRemaining).toBe(120);

    const decayed = updatePlatformerAssist(next, 50, false, false, true);
    expect(decayed.jumpBufferRemaining).toBe(70);
  });

  it('allows jump within coyote time', () => {
    const state = createPlatformerAssistState();
    const grounded = updatePlatformerAssist(state, 16, true, false, false);
    const airborne = updatePlatformerAssist(grounded, 50, false, true, true);

    expect(shouldJump(airborne, false)).toBe(true);
  });

  it('allows jump with buffered input', () => {
    const state = createPlatformerAssistState();
    const pressed = updatePlatformerAssist(state, 16, false, true, true);
    const landed = updatePlatformerAssist(pressed, 50, true, false, true);

    expect(shouldJump(landed, true)).toBe(true);
  });

  it('denies jump when both timers expired', () => {
    const state = createPlatformerAssistState();
    const pressed = updatePlatformerAssist(state, 16, false, true, true);
    const expired = updatePlatformerAssist(pressed, 200, false, false, false);

    expect(shouldJump(expired, false)).toBe(false);
  });

  it('applies jump cut gravity when ascending', () => {
    const state = createPlatformerAssistState();
    const jumping = updatePlatformerAssist(state, 16, true, true, true);
    const released = updatePlatformerAssist(jumping, 16, false, false, false);

    expect(released.jumpCut).toBe(true);
    expect(getGravityMultiplier(released, -100)).toBe(2.5);
  });

  it('does not apply jump cut when descending', () => {
    const state = { ...createPlatformerAssistState(), jumpCut: true };
    expect(getGravityMultiplier(state, 100)).toBe(1.0);
  });

  it('applyJump clears cut flag and consumes buffer', () => {
    const state = createPlatformerAssistState();
    const buffered = updatePlatformerAssist(state, 16, false, true, true);
    const result = applyJump(buffered, 0, -400);

    expect(result.state.jumpCut).toBe(false);
    expect(result.state.jumpBufferRemaining).toBe(0);
    expect(result.velocity).toBe(-400);
  });
});
