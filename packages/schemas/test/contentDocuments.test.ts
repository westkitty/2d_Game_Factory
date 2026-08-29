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
    expect(Object.keys(CONTENT_DOCUMENTS)).toEqual(['tuning', 'items', 'weapons']);
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
