import { describe, expect, it } from 'vitest';
import { validateDocument, validatePresetComposition } from '@sw2d/schemas';
import { PRESETS } from '../src/index.ts';
import { ALL_VALIDATION_PROFILES } from '../src/shared.ts';

/**
 * Schema and cross-field composition validation for all 27 recipes.
 *
 * @sw2d/schemas is a devDependency here, not a production one - this file
 * proves the catalog against the real Ajv-backed validator without making
 * `@sw2d/presets` itself depend on Ajv (see ADR-0015 / this package's own
 * package.json).
 */
describe('every preset schema-validates against preset-definition:v1', () => {
  for (const preset of PRESETS) {
    it(`${preset.id} is schema-valid`, () => {
      const result = validateDocument('preset-definition', preset.id, preset);
      expect(result.valid, JSON.stringify(result.errors)).toBe(true);
    });
  }
});

describe('every preset passes cross-field composition validation', () => {
  for (const preset of PRESETS) {
    it(`${preset.id} has no duplicate/empty pack references`, () => {
      expect(validatePresetComposition(preset)).toEqual([]);
    });
  }
});

describe('validationProfile is one of the three bounded Phase 7A profiles', () => {
  for (const preset of PRESETS) {
    it(`${preset.id} references a known validation profile`, () => {
      expect(ALL_VALIDATION_PROFILES).toContain(preset.validationProfile);
    });
  }

  it('exactly three validation profiles exist', () => {
    expect(ALL_VALIDATION_PROFILES).toHaveLength(3);
  });
});
