import { describe, expect, it } from 'vitest';
import { OBJECT_CLASS_CATALOG, OBJECT_CLASS_IDS, TiledObjectPropertyError, validateObjectProperties } from '../../src/index.ts';

const REQUIRED_CLASSES = [
  'PlayerSpawn',
  'Checkpoint',
  'Exit',
  'Enemy',
  'Hazard',
  'Collectible',
  'Powerup',
  'Spring',
  'Updraft',
  'DashPanel',
  'Trigger',
  'CameraZone',
  'MusicZone',
  'DialogueTrigger',
  'BossTrigger',
  'SpawnZone',
  'Objective',
  'Interactable',
];

describe('object-class catalog', () => {
  it('recognizes every semantic object class MASTER_PROJECT.md section 6 requires', () => {
    for (const id of REQUIRED_CLASSES) {
      expect(OBJECT_CLASS_CATALOG.has(id), id).toBe(true);
    }
  });

  it('class ids are unique across the catalog', () => {
    expect(new Set(OBJECT_CLASS_IDS).size).toBe(OBJECT_CLASS_IDS.length);
  });

  it('accepts a class instance with all required properties present and typed correctly', () => {
    const definition = OBJECT_CLASS_CATALOG.get('Hazard')!;
    expect(() => validateObjectProperties('map', 1, definition, { damage: 10 })).not.toThrow();
  });

  it('rejects a missing required property', () => {
    const definition = OBJECT_CLASS_CATALOG.get('Checkpoint')!;
    expect(() => validateObjectProperties('map', 1, definition, {})).toThrow(TiledObjectPropertyError);
  });

  it('rejects a required property of the wrong type', () => {
    const definition = OBJECT_CLASS_CATALOG.get('MusicZone')!;
    expect(() => validateObjectProperties('map', 1, definition, { track: 42 })).toThrow(/must be string/);
  });

  it('rejects an optional property of the wrong type when present', () => {
    const definition = OBJECT_CLASS_CATALOG.get('Enemy')!;
    expect(() =>
      validateObjectProperties('map', 1, definition, { enemyType: 'slime', patrolRange: 'far' }),
    ).toThrow(/patrolRange.*must be number/);
  });

  it('a class with no declared properties accepts an empty property bag', () => {
    const definition = OBJECT_CLASS_CATALOG.get('Solid')!;
    expect(() => validateObjectProperties('map', 1, definition, {})).not.toThrow();
  });
});
