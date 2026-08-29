import { describe, expect, it } from 'vitest';
import { ACTION_IDS, type ActionBindings, type GameDefinition, type GameSettings, type PresetDefinition, type SystemPackSelection } from '@sw2d/contracts';
import { schemaDocumentFor, validateDocument } from '../src/validator.ts';

/**
 * Schema/type parity, without a code generator.
 *
 * Each fixture below is a TypeScript object literal typed with `satisfies
 * <ContractInterface>`. That gives two guarantees for free from the compiler
 * alone: every required field of the interface must be present, and no field
 * outside the interface can sneak in. The runtime assertions then check the
 * schema's declared property set against `Object.keys(fixture)` - if a field
 * is added to or removed from a contracts interface without updating the
 * matching schema (or vice versa), one of these two checks fails.
 *
 * Residual limitation: this proves the *field-name sets* match and that a
 * fully-populated, correctly-typed fixture validates. It does not prove every
 * individual field's JSON Schema type constraint exactly matches its
 * TypeScript type (e.g. a field narrowed to a numeric range in the schema but
 * typed as plain `number` in TypeScript would not be caught here). The
 * targeted negative fixtures in validator.test.ts cover specific fields where
 * that distinction matters. A fully mechanical check would need either a
 * TypeScript-to-JSON-Schema generator or a JSON-Schema-to-TypeScript
 * generator as a new dependency; this is the strongest zero-new-dependency
 * check available without one.
 */

function propertyKeys(schemaName: Parameters<typeof schemaDocumentFor>[0]): string[] {
  const schema = schemaDocumentFor(schemaName) as { properties?: Record<string, unknown> };
  return Object.keys(schema.properties ?? {}).sort();
}

describe('schema/type parity', () => {
  it('ActionBindings schema keys are exactly the contracts ACTION_IDS vocabulary', () => {
    const fixture: ActionBindings = Object.fromEntries(
      ACTION_IDS.map((id) => [id, { keyboard: ['KeyQ'], pointerTargets: [id.toLowerCase()] }]),
    );
    expect(propertyKeys('action-bindings')).toEqual([...ACTION_IDS].sort());
    expect(Object.keys(fixture).sort()).toEqual([...ACTION_IDS].sort());
    expect(validateDocument('action-bindings', 'parity-fixture', fixture).valid).toBe(true);
  });

  it('SystemPackSelection schema keys match the SystemPackSelection interface', () => {
    const fixture: SystemPackSelection = { packId: 'demo.pack', config: { any: true } };
    expect(propertyKeys('system-pack-selection')).toEqual(['config', 'packId']);
    expect(Object.keys(fixture).sort()).toEqual(['config', 'packId']);
    expect(validateDocument('system-pack-selection', 'parity-fixture', fixture).valid).toBe(true);
  });

  it('GameSettings schema keys match the GameSettings interface', () => {
    const fixture: GameSettings = {
      schemaVersion: 1,
      masterVolume: 0.7,
      musicVolume: 0.6,
      sfxVolume: 0.6,
      muted: false,
      reducedMotion: false,
      screenShake: 1,
      highContrast: false,
      touchControls: 'auto',
    };
    expect(propertyKeys('game-settings')).toEqual(Object.keys(fixture).sort());
    expect(validateDocument('game-settings', 'parity-fixture', fixture).valid).toBe(true);
  });

  it('PresetDefinition schema keys match the PresetDefinition interface', () => {
    const fixture: PresetDefinition = {
      id: 'demo-preset',
      displayName: 'Demo Preset',
      family: 'platforming',
      maturity: 'recipe',
      controllerFamilies: ['platform'],
      requiredSystemPacks: [{ packId: 'demo.pack' }],
      optionalSystemPacks: [],
      defaultConfig: {},
      requiredContentRoles: ['tuning'],
      supportedInputModes: ['keyboard'],
      defaultBindings: {},
      starterScene: 'PlayScene',
      validationProfile: 'default',
      knownLimitations: [],
      physicsProfile: 'matter',
    };
    expect(propertyKeys('preset-definition')).toEqual(Object.keys(fixture).sort());
    expect(validateDocument('preset-definition', 'parity-fixture', fixture).valid).toBe(true);
  });

  it('GameDefinition schema keys match the GameDefinition interface', () => {
    const fixture: GameDefinition = {
      id: 'demo-game',
      displayName: 'Demo Game',
      version: '0.1.0',
      schemaVersion: 1,
      bindings: {},
      systemPacks: [{ packId: 'demo.pack' }],
      defaultSettings: { masterVolume: 0.7 },
      viewport: { width: 960, height: 540 },
      physicsProfile: 'matter',
    };
    expect(propertyKeys('game-definition')).toEqual(Object.keys(fixture).sort());
    expect(validateDocument('game-definition', 'parity-fixture', fixture).valid).toBe(true);
  });
});
