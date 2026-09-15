/**
 * Tests for the screen effects service.
 */

import { describe, it, expect } from 'vitest';
import { createScreenEffectsService } from '../src/game-support/screenEffects.ts';

describe('screenEffects', () => {
  it('starts with no active effects', () => {
    const effects = createScreenEffectsService();
    expect(effects.hasActiveEffects).toBe(false);
    expect(effects.activeEffects).toHaveLength(0);
  });

  it('adds a shake effect', () => {
    const effects = createScreenEffectsService();
    effects.shake(5, 200);
    expect(effects.hasActiveEffects).toBe(true);
    expect(effects.activeEffects).toHaveLength(1);
    expect(effects.activeEffects[0]!.type).toBe('shake');
  });

  it('shake effect decays over time', () => {
    const effects = createScreenEffectsService();
    effects.shake(5, 200);
    effects.update(100);
    expect(effects.activeEffects).toHaveLength(1);

    effects.update(150);
    expect(effects.activeEffects).toHaveLength(0);
  });

  it('shake offset is zero when no effects active', () => {
    const effects = createScreenEffectsService();
    const offset = effects.getShakeOffset();
    expect(offset.x).toBe(0);
    expect(offset.y).toBe(0);
  });

  it('shake offset is non-zero when shaking', () => {
    const effects = createScreenEffectsService();
    effects.shake(10, 200);
    effects.update(50);
    const offset = effects.getShakeOffset();
    // The offset should be non-zero (unless we hit a zero crossing)
    expect(offset.x !== 0 || offset.y !== 0).toBe(true);
  });

  it('adds a flash effect', () => {
    const effects = createScreenEffectsService();
    effects.flash('#ff0000', 150);
    expect(effects.activeEffects).toHaveLength(1);
    expect(effects.activeEffects[0]!.type).toBe('flash');
    expect(effects.activeEffects[0]!.color).toBe('#ff0000');
  });

  it('adds slow motion effect', () => {
    const effects = createScreenEffectsService();
    effects.slowMotion(0.5, 1000);
    expect(effects.timeScale).toBeLessThan(1.0);
  });

  it('time scale returns to 1.0 when slowmo expires', () => {
    const effects = createScreenEffectsService();
    effects.slowMotion(0.5, 100);
    effects.update(150);
    expect(effects.timeScale).toBe(1.0);
  });

  it('clears all effects', () => {
    const effects = createScreenEffectsService();
    effects.shake(5, 200);
    effects.flash('#ff0000', 150);
    effects.slowMotion(0.5, 1000);
    expect(effects.activeEffects).toHaveLength(3);

    effects.clear();
    expect(effects.activeEffects).toHaveLength(0);
    expect(effects.hasActiveEffects).toBe(false);
  });

  it('handles multiple simultaneous effects', () => {
    const effects = createScreenEffectsService();
    effects.shake(5, 200);
    effects.flash('#ff0000', 150);
    effects.slowMotion(0.5, 1000);
    effects.zoomPulse(0.1, 300);

    expect(effects.activeEffects).toHaveLength(4);
    effects.update(160);
    expect(effects.activeEffects).toHaveLength(3); // only flash expired (150 < 160)
    effects.update(150); // total 310ms
    expect(effects.activeEffects).toHaveLength(1); // shake and zoom expired, only slowmo remains
  });
});
