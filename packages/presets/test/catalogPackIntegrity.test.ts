import { describe, expect, it } from 'vitest';
import type { ControllerFamily } from '@sw2d/contracts';
import {
  aiPack,
  arcadePack,
  combatPack,
  entityRegistryPack,
  narrativePack,
  progressionPack,
  puzzlePack,
  simulationPack,
  strategyPack,
  worldPack,
  itemsPack,
  weaponsPack,
  encountersPack,
  navigationPack,
  puzzleRulesPack,
  generationPack,
  worldGraphPack,
} from '@sw2d/packs';
import { resolveInstallOrder } from '@sw2d/runtime/composition';
import { PRESETS } from '../src/index.ts';

/**
 * Pack and controller integrity for all 27 recipes, against the *real*
 * @sw2d/packs definitions and the *real*, pure `resolveInstallOrder` -
 * @sw2d/runtime is a devDependency here (this is a test, which may cross
 * package boundaries freely to verify; @sw2d/presets' production code does
 * not import either). Reuses resolveInstallOrder rather than duplicating it,
 * per MASTER_PROJECT.md section 15.
 *
 * Imported via the `@sw2d/runtime/composition` subpath, not the package's
 * main barrel: the barrel transitively loads Phaser (BootScene et al.),
 * which throws under Vitest's Node environment (`window is not defined`).
 * `resolveInstallOrder` itself has always been Phaser-free - only how it was
 * reachable was the problem. See
 * docs/architecture/adr/0015-preset-catalog-and-pack-metadata-boundary.md.
 */

const REAL_PACKS = [
  combatPack,
  aiPack,
  worldPack,
  entityRegistryPack,
  progressionPack,
  arcadePack,
  puzzlePack,
  simulationPack,
  narrativePack,
  strategyPack,
  itemsPack,
  weaponsPack,
  encountersPack,
  navigationPack,
  puzzleRulesPack,
  generationPack,
  worldGraphPack,
];

const REGISTRY = new Map(REAL_PACKS.map((definition) => [definition.id, definition]));

const CONTROLLER_FAMILIES: readonly ControllerFamily[] = ['platform', 'top-down', 'vehicle', 'grid', 'pointer', 'ui-simulation'];

describe('every referenced pack id is real', () => {
  for (const preset of PRESETS) {
    it(`${preset.id} references only real pack ids`, () => {
      const referenced = [...preset.requiredSystemPacks, ...preset.optionalSystemPacks].map((s) => s.packId);
      for (const packId of referenced) {
        expect(REGISTRY.has(packId), `${preset.id} references unknown pack "${packId}"`).toBe(true);
      }
    });
  }
});

describe('no preset duplicates a pack reference across required + optional', () => {
  for (const preset of PRESETS) {
    it(`${preset.id} has no duplicate pack ids`, () => {
      const referenced = [...preset.requiredSystemPacks, ...preset.optionalSystemPacks].map((s) => s.packId);
      expect(new Set(referenced).size).toBe(referenced.length);
    });
  }
});

describe('every preset\'s full pack selection resolves through resolveInstallOrder', () => {
  for (const preset of PRESETS) {
    it(`${preset.id}'s required+optional packs install in a deterministic order`, () => {
      const selections = [...preset.requiredSystemPacks, ...preset.optionalSystemPacks];
      expect(() => resolveInstallOrder(selections, { registry: REGISTRY, preexisting: [] })).not.toThrow();
    });
  }

  it('every preset selecting sw2d.ai also selects sw2d.combat (aiPack.dependencies)', () => {
    for (const preset of PRESETS) {
      const referenced = new Set([...preset.requiredSystemPacks, ...preset.optionalSystemPacks].map((s) => s.packId));
      if (referenced.has(aiPack.id)) {
        expect(referenced.has(combatPack.id), `${preset.id} selects sw2d.ai without sw2d.combat`).toBe(true);
      }
    }
  });
});

describe('every controller family referenced is real', () => {
  for (const preset of PRESETS) {
    it(`${preset.id} references only real controller families`, () => {
      expect(preset.controllerFamilies.length).toBeGreaterThan(0);
      for (const family of preset.controllerFamilies) {
        expect(CONTROLLER_FAMILIES, `${preset.id} references unknown controller family "${family}"`).toContain(family);
      }
    });
  }
});
