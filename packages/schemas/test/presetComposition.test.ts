import { describe, expect, it } from 'vitest';
import type { PresetDefinition } from '@sw2d/contracts';
import { checkSystemPackSelections, validatePresetComposition } from '../src/presetComposition.ts';

function basePreset(overrides: Partial<PresetDefinition> = {}): PresetDefinition {
  return {
    id: 'test-preset',
    displayName: 'Test Preset',
    family: 'platforming',
    maturity: 'recipe',
    controllerFamilies: ['platform'],
    requiredSystemPacks: [{ packId: 'world' }, { packId: 'combat' }],
    optionalSystemPacks: [{ packId: 'ai' }],
    defaultConfig: {},
    requiredContentRoles: [],
    supportedInputModes: ['keyboard'],
    starterScene: 'PlayScene',
    validationProfile: 'default',
    knownLimitations: [],
    ...overrides,
  };
}

describe('checkSystemPackSelections', () => {
  it('accepts a valid, non-overlapping selection list', () => {
    expect(checkSystemPackSelections([{ packId: 'world' }, { packId: 'combat' }])).toEqual([]);
  });

  it('reports a duplicate pack reference - the "invalid preset/system-pack reference" case', () => {
    const issues = checkSystemPackSelections([{ packId: 'world' }, { packId: 'world' }]);
    expect(issues).toHaveLength(1);
    expect(issues[0]?.packId).toBe('world');
    expect(issues[0]?.message).toMatch(/duplicate/);
  });

  it('reports an empty pack id', () => {
    const issues = checkSystemPackSelections([{ packId: '' }]);
    expect(issues).toHaveLength(1);
    expect(issues[0]?.message).toMatch(/empty packId/);
  });

  it('is deterministic and stable for equivalent input', () => {
    const selections = [{ packId: 'a' }, { packId: 'b' }, { packId: 'a' }];
    const first = checkSystemPackSelections(selections);
    const second = checkSystemPackSelections(selections);
    expect(second).toEqual(first);
    expect(first).toEqual([
      { packId: 'a', message: 'duplicate system pack reference "a" (first at index 0, again at index 2)' },
    ]);
  });
});

describe('validatePresetComposition', () => {
  it('accepts a preset whose required and optional packs do not overlap', () => {
    expect(validatePresetComposition(basePreset())).toEqual([]);
  });

  it('flags a pack id shared between requiredSystemPacks and optionalSystemPacks', () => {
    const preset = basePreset({
      requiredSystemPacks: [{ packId: 'combat' }],
      optionalSystemPacks: [{ packId: 'combat' }],
    });
    const issues = validatePresetComposition(preset);
    expect(issues).toHaveLength(1);
    expect(issues[0]?.packId).toBe('combat');
  });
});
