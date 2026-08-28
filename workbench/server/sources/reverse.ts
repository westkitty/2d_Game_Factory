/**
 * Reverse discovery: "what kinds of games could I make with this pack?"
 *
 * The same requirement-profile / matching machinery as forward
 * recommendation, run the other way: for one pack, score every preset's
 * profile against it and rank the presets. Compatibility is decided from real
 * role coverage and camera fit, never from genre labels.
 */

import { listPresets } from '@sw2d/presets';
import type { WorkbenchAssetRole } from '../../shared/types.ts';
import { deriveProfile } from './requirements.ts';
import { matchPack } from './matching.ts';
import { findCandidate } from './registry.ts';
import type { SourceCandidate } from './types.ts';

export type MatchLevel = 'excellent' | 'strong' | 'partial';

export interface PresetSuggestion {
  readonly presetId: string;
  readonly presetDisplayName: string;
  readonly family: string;
  readonly maturity: string;
  readonly matchLevel: MatchLevel;
  readonly score: number;
  readonly coveredRoles: readonly WorkbenchAssetRole[];
  /** Profile roles the pack does not cover - these would use generated fallback art. */
  readonly missingRoles: readonly WorkbenchAssetRole[];
  readonly note: string;
}

export interface ReverseDiscovery {
  readonly candidate: SourceCandidate;
  readonly suggestions: readonly PresetSuggestion[];
}

function levelFor(score: number, coveredRequired: number, totalRequired: number): MatchLevel | null {
  const coreComplete = totalRequired === 0 || coveredRequired === totalRequired;
  if (score >= 72 && coreComplete) return 'excellent';
  if (score >= 52 && coreComplete) return 'strong';
  if (score >= 34) return 'partial';
  return null;
}

/**
 * @param limit max suggestions to return (family-diverse first)
 */
export function whatCanIMakeWith(providerId: string, packId: string, options?: { limit?: number; now?: number }): ReverseDiscovery {
  const candidate = findCandidate(providerId, packId, options?.now);
  if (!candidate) throw new Error(`Provider "${providerId}" has no pack "${packId}".`);
  const limit = options?.limit ?? 8;

  const scored: PresetSuggestion[] = [];
  for (const preset of listPresets()) {
    const profile = deriveProfile(preset);
    const match = matchPack(profile, candidate);
    if (match.blockedReason) continue;
    const level = levelFor(match.score, match.coveredRequired, match.totalRequired);
    if (!level) continue;

    const coveredRoles = match.roleCoverage.filter((entry) => entry.state === 'covered' || entry.state === 'partial').map((entry) => entry.role);
    const missingRoles = match.roleCoverage.filter((entry) => entry.state === 'fallback').map((entry) => entry.role);
    scored.push({
      presetId: preset.id,
      presetDisplayName: preset.displayName,
      family: preset.family,
      maturity: preset.maturity,
      matchLevel: level,
      score: match.score,
      coveredRoles,
      missingRoles,
      note:
        missingRoles.length === 0
          ? 'Covers every role this genre draws.'
          : `Missing ${missingRoles.length} role${missingRoles.length === 1 ? '' : 's'} - generated fallback available.`,
    });
  }

  scored.sort((a, b) => {
    const rank = (s: PresetSuggestion): number => (s.matchLevel === 'excellent' ? 0 : s.matchLevel === 'strong' ? 1 : 2);
    return rank(a) - rank(b) || b.score - a.score || a.presetId.localeCompare(b.presetId);
  });

  // One per family first, so the list reads as genuinely different directions.
  const seenFamily = new Set<string>();
  const diverse: PresetSuggestion[] = [];
  for (const suggestion of scored) {
    if (diverse.length >= limit) break;
    if (seenFamily.has(suggestion.family)) continue;
    seenFamily.add(suggestion.family);
    diverse.push(suggestion);
  }
  for (const suggestion of scored) {
    if (diverse.length >= limit) break;
    if (diverse.includes(suggestion)) continue;
    diverse.push(suggestion);
  }

  return { candidate, suggestions: diverse };
}
