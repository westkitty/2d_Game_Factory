import { describe, expect, it } from 'vitest';
import { getPreset, listPresets } from '../../packages/presets/src/index.ts';
import { buildStarterKitOverlay } from '../server/starterKits/authoring.ts';
import { starterKitFor } from '../server/starterKits/index.ts';
import {
  ORIGINAL_RICH_KIT_IDS,
  allStarterKitScaffolds,
  assertStarterKitScaffoldCoverage,
  starterKitScaffoldFor,
} from '../server/starterKits/scaffolds.ts';

const ORIGINAL = new Set<string>(ORIGINAL_RICH_KIT_IDS);

describe('starter-kit expansion scaffolds', () => {
  it('covers every preset without an original rich kit, exactly once', () => {
    expect(() => assertStarterKitScaffoldCoverage()).not.toThrow();
    const expected = listPresets().filter((preset) => !ORIGINAL.has(preset.id)).map((preset) => preset.id).sort();
    const actual = allStarterKitScaffolds().map((entry) => entry.presetId).sort();
    expect(actual).toEqual(expected);
    expect(actual).toHaveLength(69);
  });

  it('gives every expansion preset an actionable, unique implementation slot', () => {
    const paths = new Set<string>();
    for (const scaffold of allStarterKitScaffolds()) {
      expect(scaffold.targetDepth).toBe('rich-starter-kit');
      expect(scaffold.loop.length, scaffold.presetId).toBeGreaterThan(30);
      expect(scaffold.usefulRoles, scaffold.presetId).toContain('player');
      expect(scaffold.usefulRoles.length, scaffold.presetId).toBeGreaterThan(1);
      expect(scaffold.mechanicProofs.length, scaffold.presetId).toBeGreaterThanOrEqual(2);
      expect(ORIGINAL.has(scaffold.referenceKit), scaffold.presetId).toBe(true);
      expect(scaffold.implementationPath).toBe(`workbench/server/starterKits/expanded/${scaffold.presetId}.ts`);
      expect(paths.has(scaffold.implementationPath), scaffold.implementationPath).toBe(false);
      paths.add(scaffold.implementationPath);
      expect(() => getPreset(scaffold.presetId)).not.toThrow();
    }
  });

  it('derives controller, exact pack selections, content roles and limitations from the live preset catalogue', () => {
    for (const scaffold of allStarterKitScaffolds()) {
      const preset = getPreset(scaffold.presetId);
      expect(scaffold.currentMaturity).toBe(preset.maturity);
      expect(scaffold.controllerFamilies).toEqual(preset.controllerFamilies);
      expect(scaffold.requiredSystemPacks).toEqual(preset.requiredSystemPacks);
      expect(scaffold.optionalSystemPacks).toEqual(preset.optionalSystemPacks);
      expect(scaffold.requiredPackIds).toEqual(preset.requiredSystemPacks.map((entry) => entry.packId));
      expect(scaffold.optionalPackIds).toEqual(preset.optionalSystemPacks.map((entry) => entry.packId));
      expect(scaffold.requiredContentRoles).toEqual(preset.requiredContentRoles);
      expect(scaffold.knownLimitations).toEqual(preset.knownLimitations);
    }
  });

  it('allows promotion only as rich-starter-kit while preserving the scaffold record', () => {
    for (const scaffold of allStarterKitScaffolds()) {
      const kit = starterKitFor(scaffold.presetId);
      if (kit) expect(kit.depth, scaffold.presetId).toBe('rich-starter-kit');
      expect(starterKitScaffoldFor(scaffold.presetId)?.presetId).toBe(scaffold.presetId);
    }
  });

  it('does not create scaffold records for the original proof kits', () => {
    for (const presetId of ORIGINAL_RICH_KIT_IDS) expect(starterKitScaffoldFor(presetId)).toBeUndefined();
  });
});

describe('starter-kit authoring helper', () => {
  it('produces the canonical overlay surfaces and canonical empty JSON pack configs without touching the machine', () => {
    const files = buildStarterKitOverlay({
      gameId: 'sample-game',
      displayName: 'Sample Game',
      shellPackId: 'game.sample-shell',
      shellSource: "export const GAME_SPECIFIC_PACK = { id: 'game.sample-shell' };\n",
      requiredPackIds: ['sw2d.arcade'],
      level: { entities: [{ id: 1, class: 'PlayerSpawn', name: 'Spawn', x: 20, y: 20, width: 0, height: 0, properties: [] }] },
      tuning: { moveSpeed: 200 },
    });
    expect([...files.keys()].sort()).toEqual([
      'content/game.json',
      'content/levels/main.json',
      'content/tuning.json',
      'src/game-specific/presentation.ts',
      'src/game-specific/shellPack.ts',
    ]);
    for (const path of files.keys()) expect(path.startsWith('packages/')).toBe(false);
    const manifest = JSON.parse(files.get('content/game.json')!) as { id: string; displayName: string; systemPacks: { packId: string; config: unknown }[] };
    expect(manifest.id).toBe('sample-game');
    expect(manifest.displayName).toBe('Sample Game');
    expect(manifest.systemPacks).toEqual([
      { packId: 'sw2d.arcade', config: {} },
      { packId: 'game.sample-shell', config: {} },
    ]);
    const tuning = JSON.parse(files.get('content/tuning.json')!) as { player: Record<string, number> };
    for (const value of Object.values(tuning.player)) expect(value).toBeGreaterThan(0);
  });
});
