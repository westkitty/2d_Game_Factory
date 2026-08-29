import { describe, expect, it } from 'vitest';
import { validateContentBundleData, validateDocumentOrThrow } from '@sw2d/schemas';
import { validatePlayerRosterDocument, type PlayerRosterDocument } from '@sw2d/contracts';
import { normalizeTiledMap } from '@sw2d/content-pipeline';
import gameData from '../content/game.json' with { type: 'json' };
import tuningData from '../content/tuning.json' with { type: 'json' };
import themeData from '../content/themes/default/theme.json' with { type: 'json' };
import rawLevel from '../content/levels/main.json' with { type: 'json' };
import playersData from '../content/players.json' with { type: 'json' };

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

  it('content/players.json validates against content-players:v1', () => {
    const result = validateContentBundleData({ players: playersData });
    expect(result['players']?.valid).toBe(true);
    expect(result['players']?.schemaId).toBe('urn:sw2d:schema:content-players:v1');
  });

  it('the roster also passes the semantic checks the schema cannot express', () => {
    expect(() => validatePlayerRosterDocument(playersData as PlayerRosterDocument)).not.toThrow();
  });

  it('authoring content/players.json is what opts this game into input.players', () => {
    // The capability is not named in game.json - it is granted by the presence of
    // the roster document, which is why this test guards the document itself.
    const packIds = (gameData as { systemPacks: { packId: string }[] }).systemPacks.map((s) => s.packId);
    expect(packIds).not.toContain('input.players');
    expect(playersData.maxPlayers).toBeGreaterThanOrEqual(2);
  });

  it('rejects a malformed roster with a located error', () => {
    expect(() => validateContentBundleData({ players: { ...playersData, minPlayers: 0 } })).toThrow();
  });
});
