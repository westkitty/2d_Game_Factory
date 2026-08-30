import { describe, expect, it } from 'vitest';
import {
  CONTENT_DOCUMENTS,
  UnknownContentDocumentError,
  validateContentBundleData,
  type TuningDocument,
} from '../src/contentDocuments.ts';
import { SchemaValidationError } from '../src/validator.ts';

import jumpVelocityWrongType from './fixtures/invalid/tuning/jump-velocity-wrong-type.json';

const VALID_TUNING: TuningDocument = {
  schemaVersion: 1,
  player: { moveSpeed: 220, jumpVelocity: 430, gravity: 1100 },
};

describe('validateContentBundleData', () => {
  it('returns a validated, typed envelope for a known document', () => {
    const result = validateContentBundleData({ tuning: VALID_TUNING });
    expect(result.tuning).toEqual({
      schemaId: 'urn:sw2d:schema:content-tuning:v1',
      valid: true,
      value: VALID_TUNING,
    });
  });

  it('knows which schema is expected before validating anything', () => {
    expect(Object.keys(CONTENT_DOCUMENTS)).toEqual([
      'tuning',
      'items',
      'weapons',
      'encounters',
      'puzzles',
      'generation',
      'world-graph',
      'vehicles',
      'races',
      'perception',
      'climbing',
      'runs',
      'strategy-actions',
      'players',
      'ball-paddle',
      'rhythm',
      'agents',
    ]);
  });

  it('validates a valid players roster document', () => {
    const doc = {
      schemaVersion: 1,
      minPlayers: 2,
      maxPlayers: 4,
      requireReady: true,
      playerIds: ['red', 'blue', 'green', 'gold'],
      deadzone: { stick: 0.25, trigger: 0.1 },
    };
    const result = validateContentBundleData({ players: doc });
    expect(result['players']?.valid).toBe(true);
    expect(result['players']?.schemaId).toBe('urn:sw2d:schema:content-players:v1');
  });

  it('rejects a malformed players roster document', () => {
    // Non-integer count, out-of-range deadzone, and an unknown field are all
    // schema failures - the semantic min<=max rule is a separate contract gate.
    expect(() => validateContentBundleData({ players: { schemaVersion: 1, minPlayers: 1.5, maxPlayers: 2 } })).toThrow();
    expect(() =>
      validateContentBundleData({
        players: { schemaVersion: 1, minPlayers: 1, maxPlayers: 2, deadzone: { stick: 1, trigger: 0.1 } },
      }),
    ).toThrow();
    expect(() =>
      validateContentBundleData({ players: { schemaVersion: 1, minPlayers: 1, maxPlayers: 2, whoops: true } }),
    ).toThrow();
  });

  it('validates a valid strategy-actions document', () => {
    const doc = {
      schemaVersion: 1,
      actionPointsPerTurn: 2,
      actions: [
        {
          id: 'strike',
          displayName: 'Strike',
          orderKind: 'attack',
          targeting: 'entity',
          range: 64,
          cost: 1,
          cooldownTicks: 2,
          usesPerTurn: 1,
          targetFilter: 'enemy',
        },
        { id: 'reposition', orderKind: 'move', targeting: 'position', range: 240, cost: 1 },
      ],
    };
    const result = validateContentBundleData({ 'strategy-actions': doc });
    expect(result['strategy-actions']?.valid).toBe(true);
    expect(result['strategy-actions']?.schemaId).toBe('urn:sw2d:schema:content-strategy-actions:v1');
  });

  it('rejects a malformed strategy-actions document with a located error', () => {
    expect(() =>
      validateContentBundleData({
        'strategy-actions': {
          schemaVersion: 1,
          actions: [{ id: 'bad', targeting: 'nowhere', range: 10 }],
        },
      }),
    ).toThrow();
    expect(() =>
      validateContentBundleData({
        'strategy-actions': { schemaVersion: 1, actions: [{ id: 'bad', targeting: 'entity', range: -5 }] },
      }),
    ).toThrow();
    expect(() =>
      validateContentBundleData({
        'strategy-actions': { schemaVersion: 1, actions: [{ id: 'bad', targeting: 'entity', range: 5, whoops: true }] },
      }),
    ).toThrow();
  });

  it('validates a valid runs document', () => {
    const runsDoc = {
      schemaVersion: 1,
      runs: [
        {
          id: 'test-run',
          seedPolicy: { kind: 'increment-attempt', baseSeed: 42, step: 1 },
          startingTransientCurrency: 10,
          resumable: false,
          resetScopes: ['transient-currency', 'transient-upgrades'],
        },
      ],
    };
    const result = validateContentBundleData({ runs: runsDoc });
    expect(result.runs?.valid).toBe(true);
  });

  it('rejects an unregistered document name - the "invalid content document" case', () => {
    expect(() => validateContentBundleData({ 'not-a-real-document': { anything: true } })).toThrow(
      UnknownContentDocumentError,
    );
  });

  it('rejects a malformed known document with a located error', () => {
    expect(() => validateContentBundleData({ tuning: jumpVelocityWrongType })).toThrow(SchemaValidationError);
  });
});
