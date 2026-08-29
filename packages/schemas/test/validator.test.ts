import { describe, expect, it } from 'vitest';
import { validateDocument, validateDocumentOrThrow, SchemaValidationError } from '../src/validator.ts';

import missingViewport from './fixtures/invalid/game-definition/missing-viewport.json';
import invalidMaturity from './fixtures/invalid/preset-definition/invalid-maturity.json';
import keyboardNotArray from './fixtures/invalid/action-bindings/keyboard-not-array.json';
import masterVolumeWrongType from './fixtures/invalid/game-settings/master-volume-wrong-type.json';
import jumpVelocityWrongType from './fixtures/invalid/tuning/jump-velocity-wrong-type.json';

describe('validateDocument - valid documents pass', () => {
  it('accepts a well-formed GameDefinition', () => {
    const result = validateDocument('game-definition', 'game.json', {
      id: 'demo',
      displayName: 'Demo',
      version: '0.1.0',
      schemaVersion: 1,
      bindings: {},
      systemPacks: [{ packId: 'demo.pack' }],
      viewport: { width: 960, height: 540 },
    });
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('accepts a well-formed GameSettings', () => {
    const result = validateDocument('game-settings', 'settings.json', {
      schemaVersion: 1,
      masterVolume: 0.7,
      musicVolume: 0.5,
      sfxVolume: 0.5,
      muted: false,
      reducedMotion: false,
      screenShake: 1,
      highContrast: false,
      touchControls: 'auto',
    });
    expect(result.valid).toBe(true);
  });

  it('accepts a well-formed PerceptionCatalog', () => {
    const result = validateDocument('perception-catalog', 'perception.json', {
      schemaVersion: 1,
      sensors: [
        {
          id: 'guard-vision',
          visionRange: 150,
          fieldOfViewDegrees: 90,
          awarenessGainPerSecond: 2.0,
          awarenessDecayPerSecond: 0.5,
          memoryMs: 3000,
          hearingRange: 200,
          hearingMultiplier: 1.0,
          updateIntervalMs: 50,
        },
      ],
      pursuits: [
        {
          pursuerId: 'guard-1',
          targetId: 'player',
          safeDistance: 300,
          dangerDistance: 150,
          captureDistance: 30,
          graceMs: 1000,
        },
      ],
    });
    expect(result.valid).toBe(true);
  });
});

describe('validateDocument - located, readable failures', () => {
  it('reports a missing required field with the document identity and root path', () => {
    const result = validateDocument('game-definition', 'game.json', missingViewport);
    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatchObject({
      documentId: 'game.json',
      instancePath: '/',
    });
    expect(result.errors[0]?.message).toMatch(/viewport/);
  });

  it('reports an invalid enum value at its field path', () => {
    const result = validateDocument('preset-definition', 'preset.json', invalidMaturity);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.instancePath === '/maturity')).toBe(true);
  });

  it('reports a malformed action binding at its field path', () => {
    const result = validateDocument('action-bindings', 'controls.json', keyboardNotArray);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toMatchObject({ instancePath: '/JUMP/keyboard' });
    expect(result.errors[0]?.message).toMatch(/array/);
  });

  it('reports a malformed GameSettings field with its exact location', () => {
    const result = validateDocument('game-settings', 'settings.json', masterVolumeWrongType);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toMatchObject({ instancePath: '/masterVolume' });
  });

  it('validates a correct climbing-config document', () => {
    const validClimbing = {
      schemaVersion: 1,
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
    const result = validateDocument('climbing-config', 'climbing.json', validClimbing);
    expect(result.valid).toBe(true);
  });

  it('meets the quality bar: /player/jumpVelocity must be number, not "invalid configuration"', () => {
    const result = validateDocument('tuning', 'tuning.json', jumpVelocityWrongType);
    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toEqual({
      documentId: 'tuning.json',
      instancePath: '/player/jumpVelocity',
      message: 'must be number',
    });
  });

  it('validation is deterministic: the same invalid input produces the same errors twice', () => {
    const first = validateDocument('tuning', 'tuning.json', jumpVelocityWrongType);
    const second = validateDocument('tuning', 'tuning.json', jumpVelocityWrongType);
    expect(second).toEqual(first);
  });
});

describe('validateDocumentOrThrow', () => {
  it('returns the value unchanged when valid', () => {
    const value = validateDocumentOrThrow('system-pack-selection', 'selection.json', { packId: 'demo' });
    expect(value).toEqual({ packId: 'demo' });
  });

  it('throws a SchemaValidationError naming the document and schema on failure', () => {
    expect(() => validateDocumentOrThrow('tuning', 'tuning.json', jumpVelocityWrongType)).toThrow(
      SchemaValidationError,
    );

    let caught: unknown;
    try {
      validateDocumentOrThrow('tuning', 'tuning.json', jumpVelocityWrongType);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(SchemaValidationError);
    const schemaError = caught as SchemaValidationError;
    expect(schemaError.documentId).toBe('tuning.json');
    expect(schemaError.schemaId).toBe('urn:sw2d:schema:content-tuning:v1');
    expect(schemaError.issues).toHaveLength(1);
  });
});
