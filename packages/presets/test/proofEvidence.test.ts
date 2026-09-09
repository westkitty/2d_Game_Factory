import { describe, expect, it } from 'vitest';
import { PRESETS } from '../src/index.ts';

/**
 * Mechanical proof-evidence reconciliation (Arena finish program, Wave 1).
 *
 * `honesty.test.ts` pins the exact `proof-validated` id list by hand. This
 * file removes the remaining trust gap: it derives the set of committed proof
 * games from the `proofs/` directory itself (via `import.meta.glob`, the same
 * no-Node-fs mechanism `docsSync.test.ts` uses with `?raw`), and asserts the
 * catalog's maturity claims match that evidence *in both directions*:
 *
 *  - a preset may not claim `proof-validated` without a committed proof game;
 *  - a committed proof game's preset may not silently stay unpromoted, which
 *    is exactly the 18-preset catalog drift this program repaired.
 *
 * `qa:proof`'s runner (packages/qa/src/runProofs.ts) is what proves the games
 * actually pass in a real browser; this suite only guards that the catalog
 * never drifts from the on-disk evidence again.
 */

const proofPackageJsons = import.meta.glob('../../../proofs/*/package.json', {
  eager: true,
}) as Record<string, { sw2d?: { presetId?: string } }>;

// The capability-program proofs carry an explicit `sw2d.presetId`; the five
// original Phase 10 proofs predate that key, so their directory name (which
// has always equalled the preset id - PROOF_MATRIX.md's `proofs/<preset-id>/`
// convention) is the fallback. When both exist they must agree.
const proofPresetIds = new Set(
  Object.entries(proofPackageJsons).map(([globPath, pkg]) => {
    const dirName = globPath.split('/').at(-2)!;
    const declared = pkg.sw2d?.presetId;
    if (declared !== undefined) {
      expect(declared, `${globPath} declares sw2d.presetId '${declared}' but lives in proofs/${dirName}/`).toBe(dirName);
    }
    return declared ?? dirName;
  }),
);

describe('proof evidence reconciliation (proofs/ directory vs catalog maturity)', () => {
  it('found the committed proof games on disk', () => {
    // 23 as of the Arena finish program's Wave 1. Grows when a new proof
    // game is committed - and then the promotion test below forces the
    // catalog to acknowledge it in the same change.
    expect(proofPresetIds.size).toBeGreaterThanOrEqual(23);
  });

  it('every proof-validated preset has a committed proof game under proofs/<id>/', () => {
    for (const preset of PRESETS) {
      if (preset.maturity === 'proof-validated') {
        expect(proofPresetIds.has(preset.id), `${preset.id} claims proof-validated but proofs/${preset.id}/ is missing`).toBe(true);
      }
    }
  });

  it('every committed proof game\'s preset claims proof-validated (no silent catalog drift)', () => {
    for (const presetId of proofPresetIds) {
      const preset = PRESETS.find((p) => p.id === presetId);
      expect(preset, `proofs/${presetId}/ names a preset that is not in the catalog`).toBeDefined();
      expect(preset!.maturity, `proofs/${presetId}/ exists but the catalog still says '${preset!.maturity}'`).toBe('proof-validated');
    }
  });
});
