import { describe, expect, it } from 'vitest';
import {
  TiledMapStructureError,
  TiledObjectPropertyError,
  UnknownTiledObjectClassError,
  UnsupportedTiledFeatureError,
  normalizeTiledMap,
} from '../../src/index.ts';

function validMap(): unknown {
  return {
    type: 'map',
    orientation: 'orthogonal',
    infinite: false,
    width: 30,
    height: 17,
    tilewidth: 32,
    tileheight: 32,
    layers: [
      { type: 'tilelayer', name: 'Background', width: 30, height: 17, data: [] },
      {
        type: 'objectgroup',
        name: 'Solids',
        objects: [{ id: 1, class: 'Solid', x: 0, y: 480, width: 960, height: 32 }],
      },
      {
        type: 'objectgroup',
        name: 'Entities',
        objects: [
          { id: 2, class: 'PlayerSpawn', x: 48, y: 400, width: 0, height: 0 },
          {
            id: 3,
            class: 'Collectible',
            x: 200,
            y: 400,
            width: 16,
            height: 16,
            properties: [{ name: 'itemId', type: 'string', value: 'coin-1' }],
          },
        ],
      },
    ],
  };
}

describe('normalizeTiledMap', () => {
  it('normalizes tile layers, solids and semantic objects', () => {
    const level = normalizeTiledMap('intro', validMap());

    expect(level.mapWidth).toBe(30);
    expect(level.mapHeight).toBe(17);
    expect(level.tileWidth).toBe(32);
    expect(level.tileHeight).toBe(32);
    expect(level.tileLayers).toEqual([{ name: 'Background', widthInTiles: 30, heightInTiles: 17 }]);
    expect(level.solids).toEqual([{ x: 0, y: 480, width: 960, height: 32 }]);
    expect(level.objects).toHaveLength(2);
    expect(level.objects[0]).toMatchObject({ class: 'PlayerSpawn', x: 48, y: 400 });
    expect(level.objects[1]).toMatchObject({ class: 'Collectible', properties: { itemId: 'coin-1' } });
  });

  it('accepts an object naming its class through the legacy "type" field', () => {
    const raw = validMap() as { layers: unknown[] };
    const entities = raw.layers[2] as { objects: Array<Record<string, unknown>> };
    entities.objects.push({ id: 9, type: 'Interactable', x: 10, y: 10, properties: [{ name: 'interactionId', type: 'string', value: 'lever' }] });

    const level = normalizeTiledMap('intro', raw);
    expect(level.objects.some((object) => object.class === 'Interactable')).toBe(true);
  });

  it('rejects a non-orthogonal orientation', () => {
    const raw = { ...validMap() as Record<string, unknown>, orientation: 'isometric' };
    expect(() => normalizeTiledMap('intro', raw)).toThrow(UnsupportedTiledFeatureError);
  });

  it('rejects an infinite map', () => {
    const raw = { ...validMap() as Record<string, unknown>, infinite: true };
    expect(() => normalizeTiledMap('intro', raw)).toThrow(UnsupportedTiledFeatureError);
  });

  it('rejects an unsupported layer type with a named error', () => {
    const raw = validMap() as { layers: unknown[] };
    raw.layers = [...raw.layers, { type: 'group', name: 'Nested', layers: [] }];
    expect(() => normalizeTiledMap('intro', raw)).toThrow(/layer "Nested" has type "group"/);
  });

  it('rejects an object with an unknown class in strict (default) mode', () => {
    const raw = validMap() as { layers: unknown[] };
    const entities = raw.layers[2] as { objects: Array<Record<string, unknown>> };
    entities.objects.push({ id: 10, class: 'SecretBoss', x: 1, y: 1 });
    expect(() => normalizeTiledMap('intro', raw)).toThrow(UnknownTiledObjectClassError);
  });

  it('skips an unknown class instead of throwing when strict is false', () => {
    const raw = validMap() as { layers: unknown[] };
    const entities = raw.layers[2] as { objects: Array<Record<string, unknown>> };
    entities.objects.push({ id: 10, class: 'SecretBoss', x: 1, y: 1 });
    const level = normalizeTiledMap('intro', raw, { strict: false });
    expect(level.objects.some((object) => object.class === 'SecretBoss')).toBe(false);
  });

  it('rejects an object missing a required property, naming the object and property', () => {
    const raw = validMap() as { layers: unknown[] };
    const entities = raw.layers[2] as { objects: Array<Record<string, unknown>> };
    entities.objects.push({ id: 11, class: 'Checkpoint', x: 5, y: 5 });
    expect(() => normalizeTiledMap('intro', raw)).toThrow(TiledObjectPropertyError);
    expect(() => normalizeTiledMap('intro', raw)).toThrow(/checkpointId/);
  });

  it('rejects a required property with the wrong type', () => {
    const raw = validMap() as { layers: unknown[] };
    const entities = raw.layers[2] as { objects: Array<Record<string, unknown>> };
    entities.objects.push({
      id: 12,
      class: 'Hazard',
      x: 5,
      y: 5,
      properties: [{ name: 'damage', type: 'string', value: 'a lot' }],
    });
    expect(() => normalizeTiledMap('intro', raw)).toThrow(/damage.*must be number/);
  });

  it('rejects malformed top-level structure', () => {
    expect(() => normalizeTiledMap('intro', null)).toThrow(TiledMapStructureError);
    expect(() => normalizeTiledMap('intro', { orientation: 'orthogonal', width: 1, height: 1, tilewidth: 1, tileheight: 1 })).toThrow(
      TiledMapStructureError,
    );
  });
});
