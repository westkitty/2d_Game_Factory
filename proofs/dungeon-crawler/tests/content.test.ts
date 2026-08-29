import { describe, expect, it } from 'vitest';
import { validateContentBundleData, validateDocumentOrThrow } from '@sw2d/schemas';
import { normalizeTiledMap } from '@sw2d/content-pipeline';
import gameData from '../content/game.json' with { type: 'json' };
import tuningData from '../content/tuning.json' with { type: 'json' };
import themeData from '../content/themes/default/theme.json' with { type: 'json' };
import rawLevel from '../content/levels/main.json' with { type: 'json' };
import generationData from '../content/generation.json' with { type: 'json' };
import itemsData from '../content/items.json' with { type: 'json' };
import lootTablesData from '../content/loot-tables.json' with { type: 'json' };
import chestTypesData from '../content/chest-types.json' with { type: 'json' };

describe('generated game content', () => {
  it('content/game.json validates against the GameDefinition schema', () => {
    expect(() => validateDocumentOrThrow('game-definition', 'content/game.json', gameData)).not.toThrow();
  });

  it('content/themes/default/theme.json validates against the theme-manifest schema', () => {
    expect(() => validateDocumentOrThrow('theme-manifest', 'content/themes/default/theme.json', themeData)).not.toThrow();
  });

  it('content/levels/main.json normalizes and validates as a level document', () => {
    const level = normalizeTiledMap('main', rawLevel);
    expect(() => validateContentBundleData({ tuning: tuningData, 'levels/main': level })).not.toThrow();
  });

  it('content/generation.json validates as a generation document', () => {
    expect(() => validateContentBundleData({ generation: generationData })).not.toThrow();
  });

  it('content/items.json, loot-tables.json and chest-types.json validate against their schemas', () => {
    expect(() =>
      validateContentBundleData({
        items: itemsData,
        'loot-tables': lootTablesData,
        'chest-types': chestTypesData,
      }),
    ).not.toThrow();
  });

  it('rejects a malformed tuning document with a located error', () => {
    const malformed = { ...tuningData, player: { ...tuningData.player, jumpVelocity: 'fast' } };
    expect(() => validateContentBundleData({ tuning: malformed })).toThrow();
  });
});
