import { describe, expect, it } from 'vitest';
import { validateContentBundleData, validateDocumentOrThrow } from '@sw2d/schemas';
import { validateStrategyActionsDocument, type StrategyActionsDocument } from '@sw2d/contracts';
import { normalizeTiledMap } from '@sw2d/content-pipeline';
import gameData from '../content/game.json' with { type: 'json' };
import tuningData from '../content/tuning.json' with { type: 'json' };
import themeData from '../content/themes/default/theme.json' with { type: 'json' };
import rawLevel from '../content/levels/main.json' with { type: 'json' };
import strategyActionsData from '../content/strategy-actions.json' with { type: 'json' };

describe('generated game content', () => {
  it('content/game.json validates against the GameDefinition schema', () => {
    expect(() => validateDocumentOrThrow('game-definition', 'content/game.json', gameData)).not.toThrow();
  });

  it('selects the Phase 14 pack the preset requires', () => {
    const packIds = (gameData as { systemPacks: { packId: string }[] }).systemPacks.map((s) => s.packId);
    expect(packIds).toContain('sw2d.strategy-actions');
    expect(packIds).toContain('sw2d.navigation');
    expect(packIds).toContain('sw2d.combat');
  });

  it('content/themes/default/theme.json validates against the theme-manifest schema', () => {
    expect(() => validateDocumentOrThrow('theme-manifest', 'content/themes/default/theme.json', themeData)).not.toThrow();
  });

  it('content/levels/main.json normalizes and validates as a level document', () => {
    const level = normalizeTiledMap('main', rawLevel);
    expect(() => validateContentBundleData({ tuning: tuningData, 'levels/main': level })).not.toThrow();
  });

  it('content/strategy-actions.json validates against content-strategy-actions:v1', () => {
    const result = validateContentBundleData({ 'strategy-actions': strategyActionsData });
    expect(result['strategy-actions']?.valid).toBe(true);
    expect(result['strategy-actions']?.schemaId).toBe('urn:sw2d:schema:content-strategy-actions:v1');
  });

  it('the action catalog also passes the semantic checks the schema cannot express', () => {
    expect(() => validateStrategyActionsDocument(strategyActionsData as StrategyActionsDocument)).not.toThrow();
  });

  it('rejects a malformed action with a located error', () => {
    const malformed = {
      ...strategyActionsData,
      actions: [{ ...strategyActionsData.actions[0], targeting: 'somewhere' }],
    };
    expect(() => validateContentBundleData({ 'strategy-actions': malformed })).toThrow();
  });
});
