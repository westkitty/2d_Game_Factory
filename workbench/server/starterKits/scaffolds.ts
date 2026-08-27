/**
 * Exhaustive implementation scaffolds for every preset that does not yet have
 * a shipped rich starter kit. This is development control-plane data only;
 * unfinished scaffolds never enter the runtime kit registry.
 */
import type { SystemPackSelection } from '@sw2d/contracts';
import { getPreset, listPresets } from '@sw2d/presets';
import type { ExplicitStarterKitPlan, OriginalRichKitId, ScaffoldPriority } from './scaffolds/types.ts';
import { ORIGINAL_RICH_KIT_IDS } from './scaffolds/types.ts';
import { PLATFORMING_SCAFFOLD_PLANS } from './scaffolds/platforming.ts';
import { TOPDOWNACTION_SCAFFOLD_PLANS } from './scaffolds/topDownAction.ts';
import { SHOOTER_SCAFFOLD_PLANS } from './scaffolds/shooter.ts';
import { VEHICLEMOVEMENT_SCAFFOLD_PLANS } from './scaffolds/vehicleMovement.ts';
import { PUZZLEARCADE_SCAFFOLD_PLANS } from './scaffolds/puzzleArcade.ts';
import { STRATEGYDEFENSE_SCAFFOLD_PLANS } from './scaffolds/strategyDefense.ts';
import { SIMULATIONMANAGEMENT_SCAFFOLD_PLANS } from './scaffolds/simulationManagement.ts';
import { NARRATIVEEXPLORATION_SCAFFOLD_PLANS } from './scaffolds/narrativeExploration.ts';
import { PARTYTOYWEIRD_SCAFFOLD_PLANS } from './scaffolds/partyToyWeird.ts';

export { ORIGINAL_RICH_KIT_IDS } from './scaffolds/types.ts';
export type { OriginalRichKitId, ScaffoldPriority } from './scaffolds/types.ts';

export interface StarterKitScaffold extends ExplicitStarterKitPlan {
  readonly presetId: string;
  readonly displayName: string;
  readonly family: string;
  readonly currentMaturity: string;
  readonly targetDepth: 'rich-starter-kit';
  readonly controllerFamilies: readonly string[];
  /** Exact selections are authoritative; ids are a convenience for status/docs. */
  readonly requiredSystemPacks: readonly SystemPackSelection[];
  readonly optionalSystemPacks: readonly SystemPackSelection[];
  readonly requiredPackIds: readonly string[];
  readonly optionalPackIds: readonly string[];
  readonly requiredContentRoles: readonly string[];
  readonly knownLimitations: readonly string[];
  readonly implementationPath: string;
}

const PLAN_BY_ID: Readonly<Record<string, ExplicitStarterKitPlan>> = {
  ...PLATFORMING_SCAFFOLD_PLANS,
  ...TOPDOWNACTION_SCAFFOLD_PLANS,
  ...SHOOTER_SCAFFOLD_PLANS,
  ...VEHICLEMOVEMENT_SCAFFOLD_PLANS,
  ...PUZZLEARCADE_SCAFFOLD_PLANS,
  ...STRATEGYDEFENSE_SCAFFOLD_PLANS,
  ...SIMULATIONMANAGEMENT_SCAFFOLD_PLANS,
  ...NARRATIVEEXPLORATION_SCAFFOLD_PLANS,
  ...PARTYTOYWEIRD_SCAFFOLD_PLANS,
};

function expectedPendingPresetIds(): readonly string[] {
  const shipped = new Set<string>(ORIGINAL_RICH_KIT_IDS);
  return listPresets().filter((preset) => !shipped.has(preset.id)).map((preset) => preset.id);
}

export function assertStarterKitScaffoldCoverage(): void {
  const expected = [...expectedPendingPresetIds()].sort();
  const planned = Object.keys(PLAN_BY_ID).sort();
  const missing = expected.filter((id) => !planned.includes(id));
  const extra = planned.filter((id) => !expected.includes(id));
  if (missing.length || extra.length) {
    throw new Error(`Starter-kit scaffold catalogue is out of sync. Missing: ${missing.join(', ') || 'none'}. Extra: ${extra.join(', ') || 'none'}.`);
  }
}

export function allStarterKitScaffolds(): readonly StarterKitScaffold[] {
  assertStarterKitScaffoldCoverage();
  return expectedPendingPresetIds().map((presetId) => {
    const preset = getPreset(presetId);
    const explicit = PLAN_BY_ID[presetId];
    if (!explicit) throw new Error(`No starter-kit scaffold for ${presetId}.`);
    return {
      presetId,
      displayName: preset.displayName,
      family: preset.family,
      currentMaturity: preset.maturity,
      targetDepth: 'rich-starter-kit' as const,
      controllerFamilies: preset.controllerFamilies,
      requiredSystemPacks: preset.requiredSystemPacks,
      optionalSystemPacks: preset.optionalSystemPacks,
      requiredPackIds: preset.requiredSystemPacks.map((entry) => entry.packId),
      optionalPackIds: preset.optionalSystemPacks.map((entry) => entry.packId),
      requiredContentRoles: preset.requiredContentRoles,
      knownLimitations: preset.knownLimitations,
      implementationPath: `workbench/server/starterKits/expanded/${preset.id}.ts`,
      ...explicit,
    };
  });
}

export function starterKitScaffoldFor(presetId: string): StarterKitScaffold | undefined {
  return allStarterKitScaffolds().find((entry) => entry.presetId === presetId);
}
