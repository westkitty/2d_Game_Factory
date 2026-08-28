/**
 * Architectural law 1: a game can be made with zero imported art.
 *
 * The recommendation layer is where "game-first" is most easily broken - a
 * seed that only appears when some role is already covered, or that invents an
 * asset id it does not have, would make art a precondition. These lock the
 * zero-asset path at that layer.
 */

import { describe, expect, it } from 'vitest';
import { buildSeeds, seedForPreset } from '../server/seeds.ts';
import type { AssetsDocument } from '../shared/types.ts';

const NO_ASSETS: AssetsDocument = { version: 1, assets: [] };

describe('game-first seeds (zero imported art)', () => {
  it('still offers playable directions when the project has no assets', () => {
    const seeds = buildSeeds({ assets: NO_ASSETS, limit: 3 });
    expect(seeds.length).toBeGreaterThan(0);
  });

  it('never claims an asset it does not have', () => {
    for (const seed of buildSeeds({ assets: NO_ASSETS, limit: 6 })) {
      expect(seed.usesAssetIds).toEqual([]);
      expect(seed.rolePlan.every((entry) => entry.assetId === null)).toBe(true);
      // Every role the game needs falls back to generated art, explicitly.
      expect(seed.rolePlan.every((entry) => entry.coverage === 'auto')).toBe(true);
      expect(seed.generatedFallbackRoles.length).toBe(seed.rolePlan.length);
    }
  });

  it('reports honest zero coverage for an explicitly chosen preset with no art', () => {
    const seed = seedForPreset('chase-platformer', NO_ASSETS);
    expect(seed.assetCoverageScore).toBe(0);
    expect(seed.usesAssetIds).toEqual([]);
    expect(seed.generatedFallbackRoles.length).toBeGreaterThan(0);
    // The preset's own evidence maturity is passed through verbatim, not upgraded.
    expect(seed.maturity).toBe('proof-validated');
  });

  it('does not gate a registered starter kit behind asset coverage', () => {
    // chase-platformer ships a rich proof kit; it must be seedable with nothing imported.
    const ids = buildSeeds({ assets: NO_ASSETS, limit: 6 }).map((seed) => seed.presetId);
    expect(ids).toContain('chase-platformer');
  });
});
