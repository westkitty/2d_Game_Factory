import type { ControllerFamily, PresetDefinition, SystemPackSelection } from '@sw2d/contracts';

/**
 * The catalog-to-starter-plan contract Phase 8's file-generating CLI will
 * consume.
 *
 * Deliberately a pure reshape, not a validator and not a file writer: Phase
 * 7A's job is to fix the *shape* every preset materializes into so Phase 8
 * has one stable path to build against, not 27 bespoke ones. "Does this plan
 * actually resolve" (unknown pack ids, unresolved dependencies, unknown
 * controller families) is a catalog-validation question, answered by
 * `packages/presets/test/catalogPackIntegrity.test.ts` - not by this
 * function, which has nothing to validate against by design (no Ajv, no
 * pack registry, no Phaser: see the package's own dependency shape).
 */
export interface StarterPlan {
  readonly presetId: string;
  readonly displayName: string;
  readonly controllerFamilies: readonly ControllerFamily[];
  readonly requiredSystemPacks: readonly SystemPackSelection[];
  readonly optionalSystemPacks: readonly SystemPackSelection[];
  readonly requiredContentRoles: readonly string[];
  readonly starterScene: string;
  readonly validationProfile: string;
}

/** Pure and deterministic: same preset in, byte-identical plan out, every time. */
export function materializeStarterPlan(preset: PresetDefinition): StarterPlan {
  return {
    presetId: preset.id,
    displayName: preset.displayName,
    controllerFamilies: preset.controllerFamilies,
    requiredSystemPacks: preset.requiredSystemPacks,
    optionalSystemPacks: preset.optionalSystemPacks,
    requiredContentRoles: preset.requiredContentRoles,
    starterScene: preset.starterScene,
    validationProfile: preset.validationProfile,
  };
}
