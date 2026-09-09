import { describe, expect, it } from 'vitest';
import { PRESETS } from '../src/index.ts';
// `?raw` (Vite/Vitest, not a Node fs dependency - see packageBoundary.test.ts) reads the
// generated docs as plain text so this suite can check them against the live catalog.
import catalogDoc from '../../../docs/presets/PRESET_CATALOG.md?raw';
import capabilityMatrixDoc from '../../../docs/presets/PRESET_CAPABILITY_MATRIX.md?raw';

/**
 * MASTER_PROJECT.md section 17: "keep documentation ... mechanically checked
 * against the catalog where practical." Both docs were generated from the
 * real catalog dump, not hand-typed - this suite is what keeps them from
 * silently drifting on the next catalog edit.
 */
describe('docs/presets/PRESET_CATALOG.md stays in sync with the catalog', () => {
  it('mentions every preset id', () => {
    for (const preset of PRESETS) {
      expect(catalogDoc, preset.id).toContain(`\`${preset.id}\``);
    }
  });

  it('mentions every preset display name', () => {
    for (const preset of PRESETS) {
      expect(catalogDoc, preset.id).toContain(preset.displayName);
    }
  });

  it('states every preset maturity truthfully in its table row', () => {
    // The Arena finish program found the maturity column had drifted 18
    // presets behind the catalog. Guard the exact cell, not just the word.
    for (const preset of PRESETS) {
      const row = catalogDoc.split('\n').find((line) => line.startsWith(`| \`${preset.id}\` |`));
      expect(row, `no table row for ${preset.id}`).toBeDefined();
      expect(row!, preset.id).toContain(`| ${preset.maturity} |`);
    }
  });

  it('states every preset\'s first known limitation verbatim (or "(none stated)")', () => {
    // Same drift-guard for the "Key limitations by recipe" section, which had
    // fallen a whole capability program behind the live catalog.
    for (const preset of PRESETS) {
      const expected = preset.knownLimitations[0] ?? '(none stated)';
      expect(catalogDoc, preset.id).toContain(`| \`${preset.id}\` | ${expected} |`);
    }
  });
});

describe('docs/presets/PRESET_CAPABILITY_MATRIX.md stays in sync with the catalog', () => {
  it('mentions every preset id', () => {
    for (const preset of PRESETS) {
      expect(capabilityMatrixDoc, preset.id).toContain(`\`${preset.id}\``);
    }
  });

  it('mentions every referenced pack short id (without the sw2d. prefix)', () => {
    const referencedPackIds = new Set(
      PRESETS.flatMap((preset) => [...preset.requiredSystemPacks, ...preset.optionalSystemPacks].map((s) => s.packId)),
    );
    for (const packId of referencedPackIds) {
      const shortId = packId.replace('sw2d.', '');
      expect(capabilityMatrixDoc, packId).toContain(shortId);
    }
  });

  it('mentions every validation profile actually used', () => {
    const profiles = new Set(PRESETS.map((preset) => preset.validationProfile));
    for (const profile of profiles) {
      expect(capabilityMatrixDoc, profile).toContain(profile);
    }
  });
});
