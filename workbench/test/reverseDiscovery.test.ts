/**
 * Phase G: reverse discovery.
 *
 * The same matching machinery run backwards. Deterministic, offline.
 */

import { describe, expect, it } from 'vitest';
import { whatCanIMakeWith } from '../server/sources/reverse.ts';
import { deriveProfile } from '../server/sources/requirements.ts';
import { getPreset } from '../../packages/presets/src/index.ts';
import { CATALOG_VERIFIED_AT } from '../server/sources/catalog.ts';

const AT = Date.parse(`${CATALOG_VERIFIED_AT}T12:00:00Z`);

describe('whatCanIMakeWith', () => {
  it('suggests genres for a top-down dungeon pack, best-first and family-diverse', () => {
    const { candidate, suggestions } = whatCanIMakeWith('kenney', 'tiny-dungeon', { now: AT });
    expect(candidate.title).toBe('Tiny Dungeon');
    expect(suggestions.length).toBeGreaterThan(0);

    // Ordered by match level then score.
    const rank = (l: string) => (l === 'excellent' ? 0 : l === 'strong' ? 1 : 2);
    for (let i = 1; i < suggestions.length; i++) {
      const a = suggestions[i - 1]!;
      const b = suggestions[i]!;
      expect(rank(a.matchLevel) <= rank(b.matchLevel) || (rank(a.matchLevel) === rank(b.matchLevel) && a.score >= b.score)).toBe(true);
    }

    // The leading suggestions favour a top-down genre for a top-down pack.
    const topFamilies = suggestions.slice(0, 4).map((s) => s.family);
    expect(topFamilies.some((f) => /top-down|puzzle|dungeon|adventure|action/i.test(f))).toBe(true);
  });

  it('covered and missing roles partition each suggested profile', () => {
    for (const suggestion of whatCanIMakeWith('kenney', 'tiny-dungeon', { now: AT }).suggestions) {
      const profileRoles = deriveProfile(getPreset(suggestion.presetId)).roles.map((r) => r.role).sort();
      const combined = [...suggestion.coveredRoles, ...suggestion.missingRoles].sort();
      expect(combined).toEqual(profileRoles);
      // No role is both covered and missing.
      expect(suggestion.coveredRoles.some((r) => suggestion.missingRoles.includes(r))).toBe(false);
    }
  });

  it('puts a platforming genre near the top for a side-view platformer pack', () => {
    const { suggestions } = whatCanIMakeWith('kenney', 'pixel-platformer', { now: AT });
    expect(suggestions.slice(0, 3).some((s) => /platform/i.test(s.family))).toBe(true);
  });

  it('is deterministic', () => {
    const a = whatCanIMakeWith('kenney', 'tiny-town', { now: AT }).suggestions.map((s) => `${s.presetId}:${s.score}`);
    const b = whatCanIMakeWith('kenney', 'tiny-town', { now: AT }).suggestions.map((s) => `${s.presetId}:${s.score}`);
    expect(a).toEqual(b);
  });

  it('throws for an unknown pack', () => {
    expect(() => whatCanIMakeWith('kenney', 'no-such-pack', { now: AT })).toThrow();
  });
});
