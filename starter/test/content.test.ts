import { describe, expect, it } from 'vitest';
import { SchemaValidationError, validateContentBundleData, validateDocumentOrThrow } from '@sw2d/schemas';
import type { GameDefinition } from '@sw2d/contracts';
import { starterContent } from '../src/content.ts';
import gameData from '../content/game.json';
import tuningData from '../content/tuning.json';

/**
 * Regression coverage for the content boundary.
 *
 * This is the acceptance test the master plan names directly: the starter now
 * runs from validated JSON, and a malformed document must fail here - before
 * a ContentBundle exists - rather than at whatever runtime line first touches
 * a bad field.
 *
 * Deliberately does not import `../src/game.ts`: it re-exports
 * `PLACEHOLDER_MOVER_PACK`, which imports Phaser, and this suite runs in
 * plain Node (Phase 1's unit layer is engine-free by design - see
 * vitest.config.ts). `game.ts` is one line of glue around the same
 * `validateDocumentOrThrow` call exercised directly below; it is covered by
 * `npm run build` and the browser journey, not this file.
 */
describe('starter runs from validated JSON content', () => {
  it('content/game.json validates against the GameDefinition schema and selects the starter pack', () => {
    const definition = validateDocumentOrThrow<GameDefinition>('game-definition', 'content/game.json', gameData);
    expect(definition.id).toBe('sw2d-foundation-slice');
    expect(definition.systemPacks).toEqual([{ packId: 'starter.placeholder-mover', config: {} }]);
  });

  it('loads a ContentBundle whose data documents are validated envelopes', async () => {
    const bundle = await starterContent.load();
    expect(bundle.assets.length).toBeGreaterThan(0);
    expect(bundle.data.tuning).toEqual({
      schemaId: 'urn:sw2d:schema:content-tuning:v1',
      valid: true,
      value: tuningData,
    });
  });
});

describe('malformed starter content fails before runtime use', () => {
  it('rejects a game.json missing a required field with a located error', () => {
    const malformed: Record<string, unknown> = { ...gameData };
    delete malformed.viewport;
    expect(() => validateDocumentOrThrow('game-definition', 'content/game.json', malformed)).toThrow(
      SchemaValidationError,
    );
  });

  it('rejects a tuning.json with a wrong-typed field with a located error', () => {
    const malformedTuning = { ...tuningData, player: { ...tuningData.player, jumpVelocity: 'fast' } };
    expect(() => validateContentBundleData({ tuning: malformedTuning })).toThrow(SchemaValidationError);
  });
});
