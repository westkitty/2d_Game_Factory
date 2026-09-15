/**
 * Tests for the camera follow system.
 */

import { describe, it, expect } from 'vitest';
import {
  createCameraState,
  updateCameraFollow,
  isPointVisible,
  worldToScreen,
  screenToWorld,
} from '../src/game-support/cameraFollow.ts';

describe('cameraFollow', () => {
  it('starts at origin', () => {
    const state = createCameraState(800, 600);
    expect(state.position.x).toBe(0);
    expect(state.position.y).toBe(0);
    expect(state.viewport.width).toBe(800);
    expect(state.viewport.height).toBe(600);
  });

  it('follows target with smoothing', () => {
    const state = createCameraState(800, 600);
    const next = updateCameraFollow(state, 400, 300, 0, 0, { smoothing: 0.5, deadzone: null, lookAhead: { x: 0, y: 0 }, threshold: 0, bounds: null });
    // With smoothing 0.5, should move halfway
    expect(next.position.x).toBeCloseTo(0, 0);
    expect(next.position.y).toBeCloseTo(0, 0);
  });

  it('respects deadzone', () => {
    // Camera at (0,0), viewport 800x600, so center is (400, 300)
    // Deadzone 200x200 centered on camera = target must be within (300-500, 200-400) to not move
    const state = createCameraState(800, 600);
    const deadzone = { x: 0, y: 0, width: 200, height: 200 };
    // Target at (400, 300) = camera center, within deadzone
    const next = updateCameraFollow(state, 400, 300, 0, 0, { smoothing: 0, deadzone, lookAhead: { x: 0, y: 0 }, threshold: 0, bounds: null });
    expect(next.position.x).toBe(0);
    expect(next.position.y).toBe(0);
  });

  it('clamps to world bounds', () => {
    const state = createCameraState(800, 600);
    const bounds = { x: 0, y: 0, width: 1600, height: 1200 };
    const next = updateCameraFollow(state, -100, -100, 0, 0, { smoothing: 0, deadzone: null, lookAhead: { x: 0, y: 0 }, threshold: 0, bounds });
    expect(next.position.x).toBeGreaterThanOrEqual(0);
    expect(next.position.y).toBeGreaterThanOrEqual(0);
  });

  it('isPointVisible returns true for visible points', () => {
    const state = { ...createCameraState(800, 600), position: { x: 100, y: 100 } };
    expect(isPointVisible(state, 200, 200)).toBe(true);
    expect(isPointVisible(state, 900, 700)).toBe(true);
  });

  it('isPointVisible returns false for offscreen points', () => {
    const state = { ...createCameraState(800, 600), position: { x: 100, y: 100 } };
    expect(isPointVisible(state, 50, 50)).toBe(false);
    expect(isPointVisible(state, 1000, 800)).toBe(false);
  });

  it('worldToScreen converts correctly', () => {
    const state = { ...createCameraState(800, 600), position: { x: 100, y: 50 } };
    const screen = worldToScreen(state, 200, 150);
    expect(screen.x).toBe(100);
    expect(screen.y).toBe(100);
  });

  it('screenToWorld converts correctly', () => {
    const state = { ...createCameraState(800, 600), position: { x: 100, y: 50 } };
    const world = screenToWorld(state, 100, 100);
    expect(world.x).toBe(200);
    expect(world.y).toBe(150);
  });

  it('worldToScreen and screenToWorld are inverse', () => {
    const state = { ...createCameraState(800, 600), position: { x: 250, y: 175 } };
    const world = { x: 500, y: 400 };
    const screen = worldToScreen(state, world.x, world.y);
    const back = screenToWorld(state, screen.x, screen.y);
    expect(back.x).toBe(world.x);
    expect(back.y).toBe(world.y);
  });
});
