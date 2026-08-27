import { getPreset } from '@sw2d/presets';
import type { StarterKit } from '../../contracts.ts';
import {
  buildStarterKitOverlay,
  type StarterLevelSpec,
  type StarterTuningSpec,
} from '../../authoring.ts';
import { starterKitScaffoldFor } from '../../scaffolds.ts';

export interface ExpandedKitSpec {
  readonly presetId: string;
  readonly shellPackId: string;
  readonly shellSource: string;
  readonly extraPackIds?: readonly string[];
  readonly level?: StarterLevelSpec;
  readonly tuning?: StarterTuningSpec;
  readonly extraFiles?: ReadonlyMap<string, string>;
  readonly includePresentation?: boolean;
}

function requiredPackIds(presetId: string, extraPackIds: readonly string[]): readonly string[] {
  const preset = getPreset(presetId);
  const ids = new Set<string>(preset.requiredSystemPacks.map((selection) => selection.packId));
  for (const packId of extraPackIds) ids.add(packId);
  return [...ids];
}

/**
 * Defines one expanded starter without changing preset maturity or inventing a
 * second generator. The canonical factory still creates the game first; this
 * helper only supplies the normal game-side overlay that the factory already
 * knows how to apply.
 */
export function defineExpandedKit(spec: ExpandedKitSpec): StarterKit {
  const scaffold = starterKitScaffoldFor(spec.presetId);
  if (!scaffold) throw new Error(`No expansion scaffold for ${spec.presetId}.`);

  return {
    presetId: spec.presetId,
    depth: 'rich-starter-kit',
    loop: scaffold.loop,
    usefulRoles: scaffold.usefulRoles,
    overlay(gameId: string, displayName: string): ReadonlyMap<string, string> {
      return buildStarterKitOverlay({
        gameId,
        displayName,
        shellPackId: spec.shellPackId,
        shellSource: spec.shellSource,
        requiredPackIds: requiredPackIds(spec.presetId, spec.extraPackIds ?? []),
        level: spec.level,
        tuning: spec.tuning,
        extraFiles: spec.extraFiles,
        includePresentation: spec.includePresentation,
      });
    },
  };
}
