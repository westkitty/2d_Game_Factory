import { describe, expect, it } from 'vitest';
import { PRESETS, materializeStarterPlan } from '../src/index.ts';

/**
 * Starter-materialization proof (MASTER_PROJECT.md section 16, extended by
 * Phase 7B section 13 and Phase 7C section 13): all 74 recipes go through
 * the same pure path and come out with a deterministic, complete plan. Not
 * a functional demo and not the file-generating CLI - both remain Phase 8.
 */
describe('materializeStarterPlan', () => {
  it('materializes all 74 presets without throwing', () => {
    for (const preset of PRESETS) {
      expect(() => materializeStarterPlan(preset), preset.id).not.toThrow();
    }
  });

  it('every plan carries preset identity, controllers, both pack lists, content roles, scene and profile', () => {
    for (const preset of PRESETS) {
      const plan = materializeStarterPlan(preset);
      expect(plan.presetId).toBe(preset.id);
      expect(plan.displayName).toBe(preset.displayName);
      expect(plan.controllerFamilies).toBe(preset.controllerFamilies);
      expect(plan.requiredSystemPacks).toBe(preset.requiredSystemPacks);
      expect(plan.optionalSystemPacks).toBe(preset.optionalSystemPacks);
      expect(plan.requiredContentRoles).toBe(preset.requiredContentRoles);
      expect(plan.starterScene).toBe(preset.starterScene);
      expect(plan.validationProfile).toBe(preset.validationProfile);
    }
  });

  it('is pure and deterministic: the same preset materializes to a structurally identical plan every call', () => {
    for (const preset of PRESETS) {
      expect(materializeStarterPlan(preset)).toEqual(materializeStarterPlan(preset));
    }
  });

  it('every materialized plan has at least one controller family and a non-empty starter scene', () => {
    for (const preset of PRESETS) {
      const plan = materializeStarterPlan(preset);
      expect(plan.controllerFamilies.length, preset.id).toBeGreaterThan(0);
      expect(plan.starterScene.length, preset.id).toBeGreaterThan(0);
      expect(plan.validationProfile.length, preset.id).toBeGreaterThan(0);
    }
  });
});
