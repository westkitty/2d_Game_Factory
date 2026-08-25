import type { PresetDefinition } from '@sw2d/contracts';
import { PLATFORMING_PRESETS } from './catalog/platforming.ts';
import { TOP_DOWN_ACTION_PRESETS } from './catalog/topDownAction.ts';
import { SHOOTER_PRESETS } from './catalog/shooter.ts';

/**
 * The preset catalogue.
 *
 * A plain, frozen array assembled once at module load - no registry object,
 * no registration step, no dynamic/plugin discovery (MASTER_PROJECT.md
 * section 47 rules those out, and nothing here needs them). Catalogue order
 * is deterministic: family A, then B, then C, each in the order its own
 * source file declares - the same array every import produces.
 */
export const PRESETS: readonly PresetDefinition[] = Object.freeze([
  ...PLATFORMING_PRESETS,
  ...TOP_DOWN_ACTION_PRESETS,
  ...SHOOTER_PRESETS,
]);

const BY_ID: ReadonlyMap<string, PresetDefinition> = new Map(PRESETS.map((preset) => [preset.id, preset]));

export class UnknownPresetError extends Error {
  constructor(id: string) {
    const known = [...BY_ID.keys()].sort();
    super(`No preset registered for id "${id}". Registered presets: ${known.join(', ')}.`);
    this.name = 'UnknownPresetError';
  }
}

/** Throws UnknownPresetError, naming every registered id, when absent. */
export function getPreset(id: string): PresetDefinition {
  const preset = BY_ID.get(id);
  if (!preset) throw new UnknownPresetError(id);
  return preset;
}

/** Same catalogue order every call. */
export function listPresets(): readonly PresetDefinition[] {
  return PRESETS;
}

/** Same catalogue order every call, filtered. Unknown family returns an empty array, not an error - a family string is descriptive, not a closed enum. */
export function getPresetsByFamily(family: string): readonly PresetDefinition[] {
  return PRESETS.filter((preset) => preset.family === family);
}
