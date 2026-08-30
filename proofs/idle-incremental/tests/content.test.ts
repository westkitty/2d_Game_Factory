import { describe, expect, it } from 'vitest';
import { validateContentBundleData, validateDocumentOrThrow } from '@sw2d/schemas';
import { normalizeTiledMap } from '@sw2d/content-pipeline';
import gameData from '../content/game.json' with { type: 'json' };
import tuningData from '../content/tuning.json' with { type: 'json' };
import themeData from '../content/themes/default/theme.json' with { type: 'json' };
import rawLevel from '../content/levels/main.json' with { type: 'json' };
import economyData from '../content/economy.json' with { type: 'json' };
import { validateEconomyDocument, type EconomyDocument } from '@sw2d/contracts';

const economyDoc = economyData as unknown as EconomyDocument;

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

  it('rejects a malformed tuning document with a located error', () => {
    const malformed = { ...tuningData, player: { ...tuningData.player, jumpVelocity: 'fast' } };
    expect(() => validateContentBundleData({ tuning: malformed })).toThrow();
  });

  // Post-ten Phase 19: the smelting chain, the offline cap and the prestige.
  it('content/economy.json validates against content-economy:v1', () => {
    const result = validateContentBundleData({ economy: economyData });
    expect(result['economy']?.valid).toBe(true);
    expect(result['economy']?.schemaId).toBe('urn:sw2d:schema:content-economy:v1');
  });

  it('also passes the semantic checks the schema cannot express', () => {
    expect(() => validateEconomyDocument(economyDoc)).not.toThrow();
  });

  it('selects sw2d.economy alongside the Phase 10 packs it already had', () => {
    const packIds = (gameData as { systemPacks: { packId: string }[] }).systemPacks.map((s) => s.packId);
    // The certified Phase-10 composition is intact; Phase 19 sits beside it.
    expect(packIds).toContain('sw2d.simulation');
    expect(packIds).toContain('sw2d.progression');
    expect(packIds).toContain('sw2d.economy');
  });

  it('authors a bounded offline policy rather than an unlimited one', () => {
    expect(economyDoc.offline?.maximumMs).toBeGreaterThan(0);
    expect(economyDoc.offline?.efficiency).toBeLessThanOrEqual(1);
  });
});
