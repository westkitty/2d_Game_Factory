/**
 * Preset -> requirement profile -> ranked packs, in one call.
 *
 * This is what "opening Find Free Sprites already knows what you're building"
 * resolves to: no search box first, a ranked shortlist immediately.
 */

import { getPreset } from '@sw2d/presets';
import type { WorkbenchAssetRole } from '../../shared/types.ts';
import { deriveProfile } from './requirements.ts';
import { rankPacks, uncoveredRoles } from './matching.ts';
import { allCandidates } from './registry.ts';
import type { PackMatch, SpriteRequirementProfile } from './types.ts';

export interface Recommendation {
  readonly profile: SpriteRequirementProfile;
  readonly matches: readonly PackMatch[];
  /** Profile roles no ranked pack covers - these use generated fallback art. */
  readonly uncovered: readonly WorkbenchAssetRole[];
}

export function recommendForPreset(presetId: string, now?: number): Recommendation {
  const preset = getPreset(presetId); // throws for an unknown preset id
  const profile = deriveProfile(preset);
  const matches = rankPacks(profile, allCandidates(now));
  return { profile, matches, uncovered: uncoveredRoles(profile, matches) };
}
