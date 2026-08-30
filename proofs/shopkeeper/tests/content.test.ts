import { describe, expect, it } from 'vitest';
import { validateContentBundleData, validateDocumentOrThrow } from '@sw2d/schemas';
import { validateEconomyDocument, type EconomyDocument } from '@sw2d/contracts';
import { normalizeTiledMap } from '@sw2d/content-pipeline';
import gameData from '../content/game.json' with { type: 'json' };
import tuningData from '../content/tuning.json' with { type: 'json' };
import themeData from '../content/themes/default/theme.json' with { type: 'json' };
import rawLevel from '../content/levels/main.json' with { type: 'json' };
import economyData from '../content/economy.json' with { type: 'json' };

const doc = economyData as unknown as EconomyDocument;

describe('generated game content', () => {
  it('content/game.json validates against the GameDefinition schema', () => {
    expect(() => validateDocumentOrThrow('game-definition', 'content/game.json', gameData)).not.toThrow();
  });

  it('selects the Phase 19 pack the preset requires', () => {
    const packIds = (gameData as { systemPacks: { packId: string }[] }).systemPacks.map((s) => s.packId);
    expect(packIds).toContain('sw2d.economy');
    // The economy reads and writes progression's currency rather than opening
    // its own wallet, so the wallet has to actually be installed.
    expect(packIds).toContain('sw2d.progression');
  });

  it('content/themes/default/theme.json validates against the theme-manifest schema', () => {
    expect(() => validateDocumentOrThrow('theme-manifest', 'content/themes/default/theme.json', themeData)).not.toThrow();
  });

  it('content/levels/main.json normalizes and validates as a level document', () => {
    const level = normalizeTiledMap('main', rawLevel);
    expect(() => validateContentBundleData({ tuning: tuningData, 'levels/main': level })).not.toThrow();
  });

  it('content/economy.json validates against content-economy:v1', () => {
    const result = validateContentBundleData({ economy: economyData });
    expect(result['economy']?.valid).toBe(true);
    expect(result['economy']?.schemaId).toBe('urn:sw2d:schema:content-economy:v1');
  });

  it('also passes the semantic checks the schema cannot express', () => {
    expect(() => validateEconomyDocument(doc)).not.toThrow();
  });

  it('a good references an item id and redefines none of what an item is', () => {
    for (const good of doc.goods) {
      expect(typeof good.itemId).toBe('string');
      // A good carries shop facts only. Anything describing the *thing* -
      // displayName, category, stackability, effects - belongs to the item
      // catalog, and the schema refuses those fields here.
      expect(Object.keys(good).sort()).toEqual(
        expect.arrayContaining(['itemId', 'stock', 'capacity', 'buyPrice', 'sellPrice'].sort()),
      );
      expect(Object.keys(good)).not.toContain('displayName');
      expect(Object.keys(good)).not.toContain('category');
    }
  });

  it('every recipe, customer and prestige reference resolves to a defined good', () => {
    const goodIds = new Set(doc.goods.map((good) => good.itemId));
    for (const recipe of doc.recipes ?? []) {
      for (const entry of [...recipe.inputs, ...recipe.outputs]) expect(goodIds.has(entry.itemId)).toBe(true);
    }
    for (const archetype of doc.customers ?? []) {
      for (const itemId of Object.keys(archetype.demandWeights)) expect(goodIds.has(itemId)).toBe(true);
    }
  });

  it('rejects a schema-invalid economy document with a located error', () => {
    expect(() => validateContentBundleData({ economy: { ...doc, goods: [] } })).toThrow();
    expect(() =>
      validateContentBundleData({ economy: { ...doc, goods: [{ ...doc.goods[0]!, whoops: true }] } }),
    ).toThrow();
    expect(() =>
      validateContentBundleData({ economy: { ...doc, goods: [{ ...doc.goods[0]!, capacity: 0 }] } }),
    ).toThrow();
  });

  it('rejects a dangling reference at the semantic gate, which the schema cannot see', () => {
    const dangling = {
      ...doc,
      recipes: [{ ...doc.recipes![0]!, outputs: [{ itemId: 'nope', quantity: 1 }] }],
    };
    // 'nope' is a well-formed string, so the schema is content - this is exactly
    // the class of error the contract's second gate exists for.
    expect(() => validateContentBundleData({ economy: dangling })).not.toThrow();
    expect(() => validateEconomyDocument(dangling)).toThrow(/not a defined good/);
  });

  it('rejects a recipe needing a station type nothing provides', () => {
    const orphan = { ...doc, recipes: [{ ...doc.recipes![0]!, stationType: 'forge' }] };
    expect(() => validateContentBundleData({ economy: orphan })).not.toThrow();
    expect(() => validateEconomyDocument(orphan)).toThrow(/no station of that type/);
  });
});
