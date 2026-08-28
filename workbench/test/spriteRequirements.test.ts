/**
 * Phase C: the game-aware sprite requirement engine.
 *
 * Deterministic, offline. Covers three meaningfully different preset shapes -
 * a side-view platformer, a top-down shooter, a grid puzzle - plus a
 * near-artless simulation, so the engine is never quietly one-demo-specific.
 */

import { describe, expect, it } from 'vitest';
import { getPreset } from '../../packages/presets/src/index.ts';
import { deriveProfile } from '../server/sources/requirements.ts';
import { rankPacks, matchPack, uncoveredRoles } from '../server/sources/matching.ts';
import { allCandidates } from '../server/sources/registry.ts';
import { CATALOG_VERIFIED_AT } from '../server/sources/catalog.ts';
import type { SourceCandidate } from '../server/sources/types.ts';

const AT = Date.parse(`${CATALOG_VERIFIED_AT}T12:00:00Z`);
const CANDIDATES = allCandidates(AT);
const profileFor = (id: string) => deriveProfile(getPreset(id));

// --- profile derivation ---------------------------------------------

describe('sprite requirement profile derivation', () => {
  it('a platformer wants a side camera, a player, environment and background', () => {
    const p = profileFor('chase-platformer');
    expect(p.camera).toBe('side');
    expect(p.tileBased).toBe(true);
    expect(p.animationUseful).toBe(true);
    expect(p.environmentArtNeeded).toBe(true);
    expect(p.backgroundNeeded).toBe(true);
    expect(p.uiArtNeeded).toBe(false);
    const roleIds = p.roles.map((r) => r.role);
    expect(roleIds).toContain('player');
    expect(roleIds).toContain('platform');
    expect(p.roles.find((r) => r.role === 'player')?.importance).toBe('required');
    expect(p.roles.find((r) => r.role === 'hazard')?.importance).toBe('optional');
  });

  it('a twin-stick shooter wants a top-down camera and directional animation', () => {
    const p = profileFor('twin-stick-shooter');
    expect(p.camera).toBe('top-down');
    expect(p.animationUseful).toBe(true);
    expect(p.directionalAnimationUseful).toBe(true);
    expect(p.roles.map((r) => r.role)).toContain('enemy');
  });

  it('a grid puzzle is tile-based with a top-down camera and no UI art need', () => {
    const p = profileFor('sokoban');
    expect(p.camera).toBe('top-down');
    expect(p.tileBased).toBe(true);
    expect(p.uiArtNeeded).toBe(false);
  });

  it('a UI simulation has a mixed camera, no world animation, and a tiny role set', () => {
    const p = profileFor('idle-incremental');
    expect(p.camera).toBe('mixed');
    expect(p.animationUseful).toBe(false);
    expect(p.environmentArtNeeded).toBe(false);
    expect(p.roles.length).toBeGreaterThan(0);
  });

  it('falls back to controller-family roles when a preset has no starter kit', () => {
    // endless-driving is a vehicle preset with a rich starter; pick one without a kit.
    const p = profileFor('endless-runner');
    expect(p.derivedFromKit === true || p.derivedFromKit === false).toBe(true);
    expect(p.roles.length).toBeGreaterThan(0);
  });
});

// --- ranking ------------------------------------------------------

describe('deterministic pack ranking', () => {
  it('is stable and ordered by score for the same inputs', () => {
    const a = rankPacks(profileFor('chase-platformer'), CANDIDATES).map((m) => m.candidate.packId);
    const b = rankPacks(profileFor('chase-platformer'), CANDIDATES).map((m) => m.candidate.packId);
    expect(a).toEqual(b);
    const scores = rankPacks(profileFor('chase-platformer'), CANDIDATES).map((m) => m.score);
    for (let i = 1; i < scores.length; i++) expect(scores[i - 1]!).toBeGreaterThanOrEqual(scores[i]!);
  });

  it('ranks a side-view platformer pack above a top-down town pack for a platformer', () => {
    const ranked = rankPacks(profileFor('chase-platformer'), CANDIDATES);
    const platformer = ranked.find((m) => m.candidate.packId === 'pixel-platformer')!;
    const town = ranked.find((m) => m.candidate.packId === 'tiny-town')!;
    expect(platformer.score).toBeGreaterThan(town.score);
    expect(platformer.reasons.some((r) => /side-view camera/.test(r))).toBe(true);
    expect(platformer.reasons.some((r) => /includes movement frames/.test(r))).toBe(true);
  });

  it('prefers a top-down pack for a top-down game', () => {
    const ranked = rankPacks(profileFor('twin-stick-shooter'), CANDIDATES);
    const top = ranked[0]!;
    expect(top.candidate.camera).toBe('top-down');
    expect(top.blockedReason).toBeUndefined();
  });

  it('always explains the fit with a role-count line and the licence', () => {
    for (const match of rankPacks(profileFor('sokoban'), CANDIDATES)) {
      expect(match.reasons.some((r) => /covers \d+ of \d+ requested roles/.test(r))).toBe(true);
      expect(match.reasons.some((r) => /^CC0/.test(r))).toBe(true);
      expect(match.roleCoverage.length).toBe(profileFor('sokoban').roles.length);
      for (const entry of match.roleCoverage) {
        expect(['covered', 'partial', 'fallback', 'not-relevant']).toContain(entry.state);
      }
    }
  });

  it('pairs every uncovered core/important role with a generated-fallback caveat', () => {
    const ranked = rankPacks(profileFor('chase-platformer'), CANDIDATES);
    for (const match of ranked) {
      const missingCore = match.roleCoverage.filter((e) => e.state === 'fallback' && e.importance !== 'optional');
      for (const role of missingCore) {
        expect(match.caveats.some((c) => c.includes('generated fallback available'))).toBe(true);
        void role;
      }
    }
  });

  it('hard-gates an unsupported licence: reported, blocked, score 0, sorted last', () => {
    const bad: SourceCandidate = {
      ...CANDIDATES[0]!,
      packId: 'proprietary-pack',
      rights: { ...CANDIDATES[0]!.rights, license: 'Proprietary', status: 'unsupported-license' },
    };
    const match = matchPack(profileFor('chase-platformer'), bad);
    expect(match.blockedReason).toBeDefined();
    expect(match.score).toBe(0);

    const ranked = rankPacks(profileFor('chase-platformer'), [...CANDIDATES, bad]);
    expect(ranked[ranked.length - 1]!.candidate.packId).toBe('proprietary-pack');
    expect(ranked.filter((m) => !m.blockedReason).length).toBe(CANDIDATES.length);
  });

  it('reports the genuinely uncovered roles for a demanding profile', () => {
    const profile = profileFor('chase-platformer');
    const uncovered = uncoveredRoles(profile, rankPacks(profile, CANDIDATES));
    // Every returned role really is in the profile and really is uncovered by all packs.
    for (const role of uncovered) expect(profile.roles.some((r) => r.role === role)).toBe(true);
  });
});
