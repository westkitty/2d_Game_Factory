import { describe, expect, it } from 'vitest';
import {
  PerceptionServiceImpl,
  PursuitServiceImpl,
} from '../src/aiPerception/aiPerceptionPack.ts';
import type { PerceptionSensorDefinition, PerceptionWorldQueries } from '@sw2d/contracts';

describe('aiPerceptionPack - PerceptionServiceImpl', () => {
  const defaultSensor: PerceptionSensorDefinition = {
    id: 'guard-sensor',
    visionRange: 100,
    fieldOfViewDegrees: 90,
    awarenessGainPerSecond: 2.0,
    awarenessDecayPerSecond: 0.5,
    memoryMs: 2000,
    hearingRange: 150,
    hearingMultiplier: 1.0,
    updateIntervalMs: 10,
  };

  it('detects target within FOV and range, increases awareness and updates last known position', () => {
    const service = new PerceptionServiceImpl();
    service.registerSensor(defaultSensor);
    service.registerTarget({ id: 'player' });

    // Guard at (0, 0) facing +x (1, 0). Player at (50, 0).
    const queries: PerceptionWorldQueries = {
      getSensorTransform: () => ({ x: 0, y: 0, facingX: 1, facingY: 0 }),
      getTargetTransform: () => ({ x: 50, y: 0 }),
    };

    service.update(100, queries);

    const state = service.targetState('guard-sensor', 'player');
    expect(state).toBeDefined();
    expect(state!.currentlyVisible).toBe(true);
    expect(state!.awareness).toBeCloseTo(0.2); // 2.0/s * 0.1s = 0.2
    expect(state!.lastKnownX).toBe(50);
    expect(state!.lastKnownY).toBe(0);
    expect(service.sensorStatus('guard-sensor')).toBe('suspicious');
  });

  it('rejects target outside range boundary', () => {
    const service = new PerceptionServiceImpl();
    service.registerSensor(defaultSensor);
    service.registerTarget({ id: 'player' });

    // Guard at (0, 0) facing +x. Player at (150, 0) (range is 100).
    const queries: PerceptionWorldQueries = {
      getSensorTransform: () => ({ x: 0, y: 0, facingX: 1, facingY: 0 }),
      getTargetTransform: () => ({ x: 150, y: 0 }),
    };

    service.update(100, queries);

    const state = service.targetState('guard-sensor', 'player');
    expect(state!.currentlyVisible).toBe(false);
    expect(state!.awareness).toBe(0);
  });

  it('rejects target outside FOV boundary', () => {
    const service = new PerceptionServiceImpl();
    service.registerSensor(defaultSensor); // 90 degree FOV (+-45 deg from facing)
    service.registerTarget({ id: 'player' });

    // Guard facing +x (1, 0). Player at (0, 50) is 90 degrees away (outside +-45 deg).
    const queries: PerceptionWorldQueries = {
      getSensorTransform: () => ({ x: 0, y: 0, facingX: 1, facingY: 0 }),
      getTargetTransform: () => ({ x: 0, y: 50 }),
    };

    service.update(100, queries);

    const state = service.targetState('guard-sensor', 'player');
    expect(state!.currentlyVisible).toBe(false);
    expect(state!.awareness).toBe(0);
  });

  it('respects occlusion blocking line of sight', () => {
    const service = new PerceptionServiceImpl();
    service.registerSensor(defaultSensor);
    service.registerTarget({ id: 'player' });

    const queries: PerceptionWorldQueries = {
      getSensorTransform: () => ({ x: 0, y: 0, facingX: 1, facingY: 0 }),
      getTargetTransform: () => ({ x: 50, y: 0 }),
      isOccluded: () => true, // wall blocks
    };

    service.update(100, queries);

    const state = service.targetState('guard-sensor', 'player');
    expect(state!.currentlyVisible).toBe(false);
    expect(state!.awareness).toBe(0);
  });

  it('applies visibility multiplier (hidden / obscured)', () => {
    const service = new PerceptionServiceImpl();
    service.registerSensor(defaultSensor);
    service.registerTarget({ id: 'player' });
    service.setTargetVisibility('player', 'hidden');

    const queries: PerceptionWorldQueries = {
      getSensorTransform: () => ({ x: 0, y: 0, facingX: 1, facingY: 0 }),
      getTargetTransform: () => ({ x: 50, y: 0 }),
    };

    service.update(100, queries);
    expect(service.targetState('guard-sensor', 'player')!.currentlyVisible).toBe(false);
    expect(service.targetState('guard-sensor', 'player')!.awareness).toBe(0);

    // Now obscured (0.5x gain)
    service.setTargetVisibility('player', 'obscured');
    service.update(100, queries);
    expect(service.targetState('guard-sensor', 'player')!.currentlyVisible).toBe(true);
    // 2.0 * 0.5 * 0.1s = 0.1
    expect(service.targetState('guard-sensor', 'player')!.awareness).toBeCloseTo(0.1);
  });

  it('handles awareness decay and memory expiration', () => {
    const service = new PerceptionServiceImpl();
    service.registerSensor(defaultSensor);
    service.registerTarget({ id: 'player' });

    let isVisible = true;
    const queries: PerceptionWorldQueries = {
      getSensorTransform: () => ({ x: 0, y: 0, facingX: 1, facingY: 0 }),
      getTargetTransform: () => ({ x: 50, y: 0 }),
      isOccluded: () => !isVisible,
    };

    // Gain awareness for 500ms -> 2.0 * 0.5 = 1.0 (pursuit)
    service.update(500, queries);
    expect(service.targetState('guard-sensor', 'player')!.awareness).toBe(1);
    expect(service.sensorStatus('guard-sensor')).toBe('pursuit');
    expect(service.targetState('guard-sensor', 'player')!.lastKnownX).toBe(50);

    // Player breaks LOS
    isVisible = false;
    service.update(1000, queries);
    // Decay: 1.0 - 0.5 * 1s = 0.5 (alert)
    expect(service.targetState('guard-sensor', 'player')!.awareness).toBeCloseTo(0.5);
    expect(service.sensorStatus('guard-sensor')).toBe('alert');
    // Memory is 2000ms: still retains last known position after 1000ms
    expect(service.targetState('guard-sensor', 'player')!.lastKnownX).toBe(50);

    // Advance past memoryMs (2000ms)
    service.update(1500, queries);
    // Total elapsed unseen = 2500ms > 2000ms -> memory cleared
    expect(service.targetState('guard-sensor', 'player')!.lastKnownX).toBeUndefined();
    expect(service.targetState('guard-sensor', 'player')!.lastKnownY).toBeUndefined();
  });

  it('processes noise events and triggers investigation status', () => {
    const service = new PerceptionServiceImpl();
    service.registerSensor(defaultSensor);
    service.registerTarget({ id: 'player' });

    // Guard at (0, 0). Noise created at (40, 30) (dist 50 <= hearingRange 150)
    service.addNoise({
      id: 'footstep',
      x: 40,
      y: 30,
      radius: 100,
      intensity: 1,
      category: 'footstep',
      lifetimeMs: 1000,
    });

    const queries: PerceptionWorldQueries = {
      getSensorTransform: () => ({ x: 0, y: 0, facingX: 1, facingY: 0 }),
      getTargetTransform: () => ({ x: -200, y: 0 }), // player out of vision
    };

    service.update(100, queries);

    expect(service.sensorStatus('guard-sensor')).toBe('investigating');
    const state = service.targetState('guard-sensor', 'player');
    expect(state!.investigationX).toBe(40);
    expect(state!.investigationY).toBe(30);

    // Noise expires after lifetimeMs
    service.update(1200, queries);
    expect(service.activeNoises()).toHaveLength(0);
  });

  it('cleans up target state when target is unregistered', () => {
    const service = new PerceptionServiceImpl();
    service.registerSensor(defaultSensor);
    service.registerTarget({ id: 'player' });

    const queries: PerceptionWorldQueries = {
      getSensorTransform: () => ({ x: 0, y: 0, facingX: 1, facingY: 0 }),
      getTargetTransform: () => ({ x: 50, y: 0 }),
    };

    service.update(100, queries);
    expect(service.targetState('guard-sensor', 'player')).toBeDefined();

    service.unregisterTarget('player');
    expect(service.targetState('guard-sensor', 'player')).toBeUndefined();
  });

  it('cleans up sensor and state on sensor unregister and dispose', () => {
    const service = new PerceptionServiceImpl();
    service.registerSensor(defaultSensor);
    service.unregisterSensor('guard-sensor');
    expect(service.sensor('guard-sensor')).toBeUndefined();
    expect(service.sensorIds()).toHaveLength(0);

    service.registerSensor(defaultSensor);
    service.dispose();
    expect(service.sensorIds()).toHaveLength(0);
  });
});

describe('aiPerceptionPack - PursuitServiceImpl', () => {
  it('tracks pursuit pressure, danger threshold, and capture with grace period', () => {
    const pursuit = new PursuitServiceImpl();
    pursuit.registerPursuit({
      pursuerId: 'guard',
      targetId: 'player',
      safeDistance: 200,
      dangerDistance: 100,
      captureDistance: 20,
      graceMs: 500,
    });

    let currentDistance = 250;
    const resolver = () => currentDistance;

    // At 250 (> 200 safe): pressure 0
    pursuit.update(100, resolver);
    let state = pursuit.pursuitState('guard')!;
    expect(state.pressure).toBe(0);
    expect(state.isDanger).toBe(false);
    expect(state.isCaptured).toBe(false);
    expect(state.graceRemainingMs).toBe(400);

    // At 150: pressure 0.5
    currentDistance = 150;
    pursuit.update(100, resolver);
    state = pursuit.pursuitState('guard')!;
    expect(state.pressure).toBeCloseTo(0.5);
    expect(state.isDanger).toBe(false);

    // At 80: danger state
    currentDistance = 80;
    pursuit.update(100, resolver);
    state = pursuit.pursuitState('guard')!;
    expect(state.pressure).toBe(1);
    expect(state.isDanger).toBe(true);
    expect(state.isCaptured).toBe(false); // still in grace (200ms remaining)

    // At 10: capture distance, but grace remaining 100ms
    currentDistance = 10;
    pursuit.update(100, resolver);
    state = pursuit.pursuitState('guard')!;
    expect(state.isDanger).toBe(true);
    expect(state.isCaptured).toBe(false);
    expect(state.graceRemainingMs).toBe(100);

    // Grace expires -> capture triggers!
    pursuit.update(150, resolver);
    state = pursuit.pursuitState('guard')!;
    expect(state.isCaptured).toBe(true);
    expect(state.graceRemainingMs).toBe(0);
  });
});
