import { describe, expect, it } from 'vitest';
import {
  calculatePursuitPressure,
  resolveVisibilityMultiplier,
  validatePursuitDefinition,
  validateSensorDefinition,
  InvalidPerceptionDefinitionError,
  InvalidPursuitDefinitionError,
  type PerceptionSensorDefinition,
  type PursuitDefinition,
} from '../src/perception.ts';

describe('perception contracts', () => {
  const validSensor: PerceptionSensorDefinition = {
    id: 'sensor-1',
    visionRange: 150,
    fieldOfViewDegrees: 90,
    awarenessGainPerSecond: 2.0,
    awarenessDecayPerSecond: 0.5,
    memoryMs: 3000,
    hearingRange: 200,
    hearingMultiplier: 1.0,
    updateIntervalMs: 50,
  };

  it('validates a correct sensor definition', () => {
    expect(() => validateSensorDefinition(validSensor)).not.toThrow();
  });

  it('rejects sensor with invalid visionRange', () => {
    expect(() => validateSensorDefinition({ ...validSensor, visionRange: 0 })).toThrow(InvalidPerceptionDefinitionError);
    expect(() => validateSensorDefinition({ ...validSensor, visionRange: -10 })).toThrow(InvalidPerceptionDefinitionError);
  });

  it('rejects sensor with invalid fieldOfViewDegrees', () => {
    expect(() => validateSensorDefinition({ ...validSensor, fieldOfViewDegrees: 0 })).toThrow(InvalidPerceptionDefinitionError);
    expect(() => validateSensorDefinition({ ...validSensor, fieldOfViewDegrees: 361 })).toThrow(InvalidPerceptionDefinitionError);
  });

  it('rejects sensor with negative awareness parameters or updateInterval', () => {
    expect(() => validateSensorDefinition({ ...validSensor, awarenessGainPerSecond: -1 })).toThrow(InvalidPerceptionDefinitionError);
    expect(() => validateSensorDefinition({ ...validSensor, awarenessDecayPerSecond: -1 })).toThrow(InvalidPerceptionDefinitionError);
    expect(() => validateSensorDefinition({ ...validSensor, updateIntervalMs: 0 })).toThrow(InvalidPerceptionDefinitionError);
  });

  const validPursuit: PursuitDefinition = {
    pursuerId: 'guard-1',
    targetId: 'player',
    safeDistance: 300,
    dangerDistance: 150,
    captureDistance: 30,
    graceMs: 1000,
  };

  it('validates a correct pursuit definition', () => {
    expect(() => validatePursuitDefinition(validPursuit)).not.toThrow();
  });

  it('rejects pursuit with invalid distance thresholds', () => {
    expect(() => validatePursuitDefinition({ ...validPursuit, safeDistance: 100, dangerDistance: 150 })).toThrow(
      InvalidPursuitDefinitionError,
    );
    expect(() => validatePursuitDefinition({ ...validPursuit, dangerDistance: 20, captureDistance: 30 })).toThrow(
      InvalidPursuitDefinitionError,
    );
    expect(() => validatePursuitDefinition({ ...validPursuit, captureDistance: -5 })).toThrow(InvalidPursuitDefinitionError);
  });

  it('calculates pursuit pressure correctly across boundaries', () => {
    // distance >= safeDistance -> 0
    expect(calculatePursuitPressure(300, 300, 100)).toBe(0);
    expect(calculatePursuitPressure(350, 300, 100)).toBe(0);

    // distance <= dangerDistance -> 1
    expect(calculatePursuitPressure(100, 300, 100)).toBe(1);
    expect(calculatePursuitPressure(50, 300, 100)).toBe(1);

    // midway: (300 - 200) / (300 - 100) = 100 / 200 = 0.5
    expect(calculatePursuitPressure(200, 300, 100)).toBeCloseTo(0.5);

    // 25% closer to danger: distance = 150 -> (300 - 150) / 200 = 0.75
    expect(calculatePursuitPressure(150, 300, 100)).toBeCloseTo(0.75);
  });

  it('resolves visibility multipliers accurately', () => {
    expect(resolveVisibilityMultiplier('normal')).toBe(1);
    expect(resolveVisibilityMultiplier('obscured')).toBe(0.5);
    expect(resolveVisibilityMultiplier('hidden')).toBe(0);
    expect(resolveVisibilityMultiplier(0.75)).toBe(0.75);
    expect(resolveVisibilityMultiplier(1.5)).toBe(1);
    expect(resolveVisibilityMultiplier(-0.2)).toBe(0);
    expect(resolveVisibilityMultiplier(undefined)).toBe(1);
  });
});
