import { describe, expect, it } from 'vitest';
import {
  PerceptionServiceImpl,
  PursuitServiceImpl,
} from '@sw2d/packs';
import { createPerceptionRuntime } from '../src/game-support/perceptionRuntime.ts';

describe('perceptionRuntime', () => {
  it('translates transforms and facing from rotation / flipX and ticks perception', () => {
    const perception = new PerceptionServiceImpl();
    perception.registerSensor({
      id: 'guard',
      visionRange: 100,
      fieldOfViewDegrees: 90,
      awarenessGainPerSecond: 2,
      awarenessDecayPerSecond: 0.5,
      memoryMs: 1000,
      hearingRange: 150,
      hearingMultiplier: 1,
      updateIntervalMs: 10,
    });
    perception.registerTarget({ id: 'player' });

    let guardRotation = 0; // facing +x
    let playerX = 50;
    let playerY = 0;

    const runtime = createPerceptionRuntime({
      perception,
      getSensorTransform: () => ({ x: 0, y: 0, rotation: guardRotation }),
      getTargetTransform: () => ({ x: playerX, y: playerY }),
    });

    runtime.update(100);
    expect(runtime.sensorStatus('guard')).toBe('suspicious');
    expect(perception.targetState('guard', 'player')?.currentlyVisible).toBe(true);

    // Rotate guard 180 degrees (facing -x)
    guardRotation = Math.PI;
    runtime.update(100);
    expect(perception.targetState('guard', 'player')?.currentlyVisible).toBe(false);

    runtime.dispose();
  });

  it('coordinates pursuit with distance resolver', () => {
    const perception = new PerceptionServiceImpl();
    const pursuit = new PursuitServiceImpl();

    pursuit.registerPursuit({
      pursuerId: 'chaser',
      targetId: 'runner',
      safeDistance: 200,
      dangerDistance: 100,
      captureDistance: 20,
      graceMs: 0,
    });

    let dist = 150;
    const runtime = createPerceptionRuntime({
      perception,
      pursuit,
      getSensorTransform: () => ({ x: 0, y: 0 }),
      getTargetTransform: () => ({ x: 100, y: 0 }),
      distanceResolver: () => dist,
    });

    runtime.update(50);
    const state = runtime.pursuitState('chaser');
    expect(state).toBeDefined();
    expect(state!.pressure).toBeCloseTo(0.5);
    expect(state!.isCaptured).toBe(false);

    dist = 10;
    runtime.update(50);
    expect(runtime.pursuitState('chaser')?.isCaptured).toBe(true);

    runtime.dispose();
  });
});
