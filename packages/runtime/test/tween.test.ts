/**
 * Tests for the tween system.
 */

import { describe, it, expect, vi } from 'vitest';
import { createTweenManager, Easing } from '../src/game-support/tween.ts';

describe('Easing functions', () => {
  it('linear returns input unchanged', () => {
    expect(Easing.linear(0)).toBe(0);
    expect(Easing.linear(0.5)).toBe(0.5);
    expect(Easing.linear(1)).toBe(1);
  });

  it('easeIn starts slow', () => {
    expect(Easing.easeIn(0.5)).toBeLessThan(0.5);
  });

  it('easeOut ends slow', () => {
    expect(Easing.easeOut(0.5)).toBeGreaterThan(0.5);
  });

  it('all easings return 0 at t=0 and 1 at t=1', () => {
    for (const [, fn] of Object.entries(Easing)) {
      expect(fn(0)).toBeCloseTo(0, 5);
      expect(fn(1)).toBeCloseTo(1, 5);
    }
  });
});

describe('createTweenManager', () => {
  it('starts with no tweens', () => {
    const manager = createTweenManager();
    expect(manager.count).toBe(0);
  });

  it('animates properties over time', () => {
    const manager = createTweenManager();
    const target = { x: 0, y: 0 };

    manager.add(target, { x: 100, y: 200 }, { duration: 1000 });
    expect(manager.count).toBe(1);

    manager.update(500);
    expect(target.x).toBeCloseTo(50, 0);
    expect(target.y).toBeCloseTo(100, 0);

    manager.update(500);
    expect(target.x).toBeCloseTo(100, 0);
    expect(target.y).toBeCloseTo(200, 0);
    expect(manager.count).toBe(0); // Completed and removed
  });

  it('respects delay', () => {
    const manager = createTweenManager();
    const target = { x: 0 };

    manager.add(target, { x: 100 }, { duration: 1000, delay: 500 });

    manager.update(400);
    expect(target.x).toBe(0); // Still in delay

    manager.update(200);
    expect(target.x).toBeCloseTo(10, 0); // 100ms into animation
  });

  it('calls onComplete when finished', () => {
    const manager = createTweenManager();
    const onComplete = vi.fn();
    const target = { x: 0 };

    manager.add(target, { x: 100 }, { duration: 100, onComplete });

    manager.update(100);
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('calls onUpdate with progress', () => {
    const manager = createTweenManager();
    const onUpdate = vi.fn();
    const target = { x: 0 };

    manager.add(target, { x: 100 }, { duration: 1000, onUpdate });

    manager.update(500);
    expect(onUpdate).toHaveBeenCalledWith(0.5);
  });

  it('supports yoyo (reverse)', () => {
    const manager = createTweenManager();
    const target = { x: 0 };

    manager.add(target, { x: 100 }, { duration: 1000, yoyo: true });

    manager.update(1000);
    expect(target.x).toBeCloseTo(100, 0); // Reached end

    manager.update(500);
    expect(target.x).toBeCloseTo(50, 0); // Halfway back
  });

  it('stopAll clears all tweens', () => {
    const manager = createTweenManager();
    const target1 = { x: 0 };
    const target2 = { y: 0 };

    manager.add(target1, { x: 100 }, { duration: 1000 });
    manager.add(target2, { y: 200 }, { duration: 1000 });
    expect(manager.count).toBe(2);

    manager.stopAll();
    expect(manager.count).toBe(0);
  });

  it('individual tween can be stopped', () => {
    const manager = createTweenManager();
    const target = { x: 0 };

    const tween = manager.add(target, { x: 100 }, { duration: 1000 });
    manager.update(500);
    tween.stop();
    expect(tween.isComplete).toBe(true);

    manager.update(100);
    expect(target.x).toBeCloseTo(50, 0); // Frozen at stop point
  });

  it('applies easing functions', () => {
    const manager = createTweenManager();
    const target = { x: 0 };

    manager.add(target, { x: 100 }, { duration: 1000, easing: 'easeIn' });

    manager.update(500);
    // easeIn at 0.5 = 0.25, so x should be ~25
    expect(target.x).toBeCloseTo(25, 0);
  });
});
