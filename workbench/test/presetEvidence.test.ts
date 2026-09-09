import { describe, expect, it } from 'vitest';
import { getPreset } from '../../packages/presets/src/index.ts';
import { presetEvidenceFor, resetPresetEvidenceCache } from '../server/presetEvidence.ts';
import { listPresetSummaries } from '../server/projectStore.ts';
import { starterKitDepthFor } from '../server/starterKits/index.ts';

/**
 * The preset browser's "Evidence on disk" line is repository-derived, never
 * asserted. These tests pin the derivation to the same truths the catalogue
 * honesty tests enforce, so the workbench can never show evidence the test
 * suite does not stand behind (failure condition F15 in the other
 * direction: no *underclaiming* that rots either).
 */

function summaries() {
  resetPresetEvidenceCache();
  return listPresetSummaries(
    (presetId) => starterKitDepthFor(presetId, getPreset(presetId).maturity),
    presetEvidenceFor,
  );
}

describe('preset evidence surface (repository-derived, offline)', () => {
  it('every proof-validated preset shows a committed proof game, and only those', () => {
    for (const summary of summaries()) {
      expect(
        summary.hasProofGame,
        `${summary.id} is ${summary.maturity} but hasProofGame=${summary.hasProofGame} - the browser and proofs/ disagree`,
      ).toBe(summary.maturity === 'proof-validated');
    }
  });

  it('demo evidence matches the demos/ directory exactly', () => {
    // 12 committed demo games as of the Arena finish program. This count
    // moving means a demo was added or removed - update deliberately.
    const withDemo = summaries().filter((summary) => summary.hasDemoGame);
    expect(withDemo.length).toBe(12);
    for (const summary of withDemo) {
      expect(summary.maturity, `${summary.id} has a committed demo but claims maturity 'recipe'`).not.toBe('recipe');
    }
  });

  it('an unknown preset id simply has no evidence (no throw, no fabrication)', () => {
    expect(presetEvidenceFor('not-a-real-preset')).toEqual({ proofGame: false, demoGame: false });
  });
});
