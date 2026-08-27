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
 * Family builders emit one shell body with a concrete preset id embedded in it.
 * If that id is written with `as const`, TypeScript narrows every sibling
 * branch to an impossible comparison in the generated game. The runtime value
 * is still immutable; only its compile-time type needs to stay broad enough for
 * the shared family implementation to typecheck.
 */
function widenGeneratedVariant(source: string): string {
  if (!source.includes('const VARIANT = ')) return source;
  const widened = source.replace(/const VARIANT = ([^;\n]+) as const;/, 'const VARIANT: string = $1;');
  if (widened === source) {
    throw new Error('Expanded starter shell declares VARIANT in an unsupported form.');
  }
  return widened;
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
        shellSource: widenGeneratedVariant(spec.shellSource),
        requiredPackIds: requiredPackIds(spec.presetId, spec.extraPackIds ?? []),
        ...(spec.level !== undefined ? { level: spec.level } : {}),
        ...(spec.tuning !== undefined ? { tuning: spec.tuning } : {}),
        ...(spec.extraFiles !== undefined ? { extraFiles: spec.extraFiles } : {}),
        ...(spec.includePresentation !== undefined ? { includePresentation: spec.includePresentation } : {}),
      });
    },
  };
}
