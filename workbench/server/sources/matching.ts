/**
 * Deterministic pack ranking.
 *
 * No opaque scoring: every point is traceable to a recorded fact, and the
 * "why this fits" lines are generated from the same checks that produce the
 * score. Hard gates (rights, usable raster, importable) exclude a candidate
 * outright - a good-looking pack can never score its way past a licence
 * failure or an unknown provenance.
 *
 * "Prefer one coherent pack over five compatible ones" is built in: each
 * candidate is a single coherent pack, and coverage is measured per pack, so
 * the pack that alone covers the most of the profile wins rather than a
 * scattering of partial matches.
 */

import type { WorkbenchAssetRole } from '../../shared/types.ts';
import { ROLE_LABELS } from '../../shared/types.ts';
import { rightsAllowNewAcquisition } from './rights.ts';
import type {
  PackMatch,
  ProfileRole,
  RoleCoverageEntry,
  RoleCoverageState,
  SourceCandidate,
  SpriteRequirementProfile,
} from './types.ts';

const IMPORTANCE_WEIGHT: Readonly<Record<ProfileRole['importance'], number>> = {
  required: 3,
  important: 2,
  optional: 1,
};

/** Provider role-hint thresholds. */
const COVERED_AT = 0.7;
const PARTIAL_AT = 0.4;

function coverageState(hint: number | undefined): RoleCoverageState {
  if (hint === undefined) return 'fallback';
  if (hint >= COVERED_AT) return 'covered';
  if (hint >= PARTIAL_AT) return 'partial';
  return 'fallback';
}

function shortLicense(license: string): string {
  return license.replace(/-1\.0$/, '').replace(/-4\.0$/, '');
}

/**
 * Hard gates. Returns a reason string when the candidate must not be offered
 * as acquirable. Matching is a precursor to a *new* acquisition, so
 * `stale-verification` blocks here too - it is not just a badge.
 */
function gate(candidate: SourceCandidate): string | undefined {
  if (!rightsAllowNewAcquisition(candidate.rights)) {
    return candidate.rights.status === 'unsupported-license'
      ? `licence ${candidate.rights.license} is not on the accepted list`
      : candidate.rights.status === 'stale-verification'
        ? 'rights verification is stale - refresh the catalogue evidence before acquiring'
        : `rights are ${candidate.rights.status}`;
  }
  if (!candidate.rasterFormats.includes('png')) return 'no usable PNG raster content';
  return undefined;
}

export function matchPack(profile: SpriteRequirementProfile, candidate: SourceCandidate): PackMatch {
  const blockedReason = gate(candidate);

  const roleCoverage: RoleCoverageEntry[] = profile.roles.map((entry) => ({
    role: entry.role,
    importance: entry.importance,
    state: coverageState(candidate.roleHints[entry.role]),
  }));

  const totalRoles = profile.roles.length;
  const coveredRoles = roleCoverage.filter((entry) => entry.state === 'covered' || entry.state === 'partial').length;
  const requiredRoles = profile.roles.filter((entry) => entry.importance === 'required');
  const totalRequired = requiredRoles.length;
  const coveredRequired = roleCoverage.filter(
    (entry) => entry.importance === 'required' && (entry.state === 'covered' || entry.state === 'partial'),
  ).length;

  // --- score --------------------------------------------------------------
  let score = 0;
  const reasons: string[] = [];
  const caveats: string[] = [];

  // 1. weighted semantic-role coverage (dominant, up to 55)
  let weightHave = 0;
  let weightTotal = 0;
  for (const entry of roleCoverage) {
    const w = IMPORTANCE_WEIGHT[entry.importance];
    weightTotal += w;
    if (entry.state === 'covered') weightHave += w;
    else if (entry.state === 'partial') weightHave += w * 0.5;
  }
  const coverageRatio = weightTotal === 0 ? 0 : weightHave / weightTotal;
  score += coverageRatio * 55;
  reasons.push(`covers ${coveredRoles} of ${totalRoles} requested roles`);

  // 2. coherent single-pack bonus (up to 15) - one pack carrying the core roles
  if (totalRequired > 0 && coveredRequired === totalRequired) {
    score += 15;
    reasons.push('one coherent pack covers every core role');
  } else if (coveredRequired > 0) {
    score += 15 * (coveredRequired / Math.max(1, totalRequired));
    reasons.push('same visual pack across the covered roles');
  }

  // 3. camera / perspective (±12)
  if (candidate.camera === profile.camera) {
    score += 12;
    reasons.push(`matches ${profile.camera === 'side' ? 'side-view' : profile.camera} camera`);
  } else if (candidate.camera === 'mixed' || profile.camera === 'mixed') {
    score += 4;
  } else if (candidate.camera) {
    score -= 8;
    caveats.push(`authored for a ${candidate.camera} camera, not ${profile.camera === 'side' ? 'side-view' : profile.camera}`);
  }

  // 4. tile-scale compatibility (up to 6)
  if (profile.likelyTileSize && candidate.tileSize) {
    const ratio = candidate.tileSize.width / profile.likelyTileSize.width;
    if (ratio >= 0.5 && ratio <= 2) {
      score += 6;
      reasons.push(`${candidate.tileSize.width}x${candidate.tileSize.height} tiles suit the target scale`);
    }
  } else if (candidate.tileSize && candidate.pixelArt) {
    reasons.push(`${candidate.tileSize.width}x${candidate.tileSize.height} pixel-art set`);
  }

  // 5. animation availability (up to 8)
  if (profile.animationUseful && candidate.hasAnimationFrames) {
    score += 8;
    reasons.push('includes movement frames');
  } else if (profile.animationUseful && !candidate.hasAnimationFrames) {
    caveats.push('no animation frames - actors render as a single pose');
  }

  // 6. pixel-art preference (±4) - only when the profile actually states one
  if (profile.pixelArtPreferred === true && candidate.pixelArt) score += 4;
  else if (profile.pixelArtPreferred === false && candidate.pixelArt) score -= 4;

  // 7. integration burden (±4) - a giant pack is more to wire up
  if ((candidate.fileCount ?? 0) > 800) {
    score -= 4;
    caveats.push(`${candidate.fileCount} files - larger to work through`);
  } else if ((candidate.fileCount ?? 0) > 0 && (candidate.fileCount ?? 0) <= 260) {
    score += 2;
  }

  // 8. attribution burden (−3) and the rights fact itself
  if (candidate.rights.attributionRequired) {
    score -= 3;
    reasons.push(`${shortLicense(candidate.rights.license)} (credit required)`);
  } else {
    reasons.push(shortLicense(candidate.rights.license));
  }

  // --- caveats for uncovered core/important roles ------------------------
  for (const entry of roleCoverage) {
    if (entry.state === 'fallback' && entry.importance !== 'optional') {
      caveats.push(`no dedicated ${ROLE_LABELS[entry.role].toLowerCase()} art - generated fallback available`);
    }
  }

  const finalScore = blockedReason ? 0 : Math.max(0, Math.min(100, Math.round(score)));

  return {
    candidate,
    score: finalScore,
    roleCoverage,
    coveredRequired,
    totalRequired,
    coveredRoles,
    totalRoles,
    reasons,
    caveats,
    ...(blockedReason ? { blockedReason } : {}),
  };
}

/**
 * Ranks every candidate against the profile. Blocked candidates sort last and
 * keep their `blockedReason`; ties break on pack id so the order is stable.
 */
export function rankPacks(profile: SpriteRequirementProfile, candidates: readonly SourceCandidate[]): readonly PackMatch[] {
  return candidates
    .map((candidate) => matchPack(profile, candidate))
    .sort((a, b) => {
      if (Boolean(a.blockedReason) !== Boolean(b.blockedReason)) return a.blockedReason ? 1 : -1;
      return b.score - a.score || a.candidate.packId.localeCompare(b.candidate.packId);
    });
}

/** Roles the profile asks for that no ranked pack covers at all - the true generated-fallback set. */
export function uncoveredRoles(profile: SpriteRequirementProfile, matches: readonly PackMatch[]): readonly WorkbenchAssetRole[] {
  const covered = new Set<WorkbenchAssetRole>();
  for (const match of matches) {
    if (match.blockedReason) continue;
    for (const entry of match.roleCoverage) {
      if (entry.state === 'covered' || entry.state === 'partial') covered.add(entry.role);
    }
  }
  return profile.roles.filter((entry) => !covered.has(entry.role)).map((entry) => entry.role);
}
