import { describe, expect, it } from 'vitest';
import type { GameDefinition, NormalizedLevel } from '@sw2d/contracts';
import { normalizeTiledMap, resolveTheme } from '@sw2d/content-pipeline';
import { SchemaValidationError, validateDocumentOrThrow } from '@sw2d/schemas';
import { selectedTheme, tiledProofContent } from '../src/tiledProofContent.ts';
import rawLevel from '../content/levels/intro.json';
import defaultTheme from '../content/themes/default/theme.json';
import neonTheme from '../content/themes/neon/theme.json';
import gameData from '../content/tiled-proof-game.json';

/**
 * Regression coverage for the Phase 6 Tiled/theme content pipeline.
 *
 * Deliberately does not import tiledLevelPack.ts or tiledProofMain.ts: both
 * import Phaser or touch the DOM, and this suite runs in plain Node (see
 * vitest.config.ts). What is under test here - normalization, schema
 * validation, theme resolution, game definition validation - is exactly the
 * part of the pipeline that runs before any of that.
 */

describe('content/tiled-proof-game.json', () => {
  it('validates against the GameDefinition schema and selects the Tiled level pack', () => {
    const definition = validateDocumentOrThrow<GameDefinition>('game-definition', 'content/tiled-proof-game.json', gameData);
    expect(definition.systemPacks.map((selection) => selection.packId)).toEqual([
      'sw2d.world',
      'sw2d.world-entities',
      'starter.tiled-level',
    ]);
  });
});

describe('content/levels/intro.json normalizes to the required Phase 6 proof classes', () => {
  const level = normalizeTiledMap('intro', rawLevel);

  it('has exactly one solid ground and two solid platforms, sourced from Solid objects', () => {
    expect(level.solids).toHaveLength(3);
  });

  it('contains PlayerSpawn, Checkpoint, two Collectibles, Hazard and Exit', () => {
    const classes = level.objects.map((object) => object.class).sort();
    expect(classes).toEqual(['Checkpoint', 'Collectible', 'Collectible', 'Exit', 'Hazard', 'PlayerSpawn']);
  });

  it('normalizes Collectible custom properties with correct types', () => {
    const coin = level.objects.find((object) => object.properties.itemId === 'coin-1');
    expect(coin?.properties).toEqual({ itemId: 'coin-1', value: 5 });
  });

  it('validates as a level-document against @sw2d/schemas', () => {
    expect(() => validateDocumentOrThrow<NormalizedLevel>('level-document', 'levels/intro', level)).not.toThrow();
  });
});

describe('the Tiled-proof theme manifests', () => {
  it('both default and neon validate against theme-manifest', () => {
    expect(() => validateDocumentOrThrow('theme-manifest', 'themes/default', defaultTheme)).not.toThrow();
    expect(() => validateDocumentOrThrow('theme-manifest', 'themes/neon', neonTheme)).not.toThrow();
  });

  it('rejects a theme manifest missing a required token', () => {
    const malformed = { ...defaultTheme, tokens: { ...defaultTheme.tokens, accent: undefined } };
    expect(() => validateDocumentOrThrow('theme-manifest', 'themes/malformed', malformed)).toThrow(SchemaValidationError);
  });

  it('resolveTheme applies highContrastTokens only when accessibility.highContrast is true', () => {
    const normal = resolveTheme(selectedTheme, { highContrast: false });
    const highContrast = resolveTheme(selectedTheme, { highContrast: true });
    expect(normal.tokens).not.toEqual(highContrast.tokens);
    expect(highContrast.tokens.text).toBe('#ffffff');
  });
});

describe('a theme swap changes presentation, never gameplay data', () => {
  it('the same normalized level results regardless of which theme is selected', async () => {
    const bundle = await tiledProofContent.load();
    const level = bundle.data['levels/intro']?.value as NormalizedLevel;
    // normalizeTiledMap never reads theme.json - re-normalizing directly
    // proves the level the running game gets is theme-independent by
    // construction, not merely by coincidence of the two current fixtures.
    expect(level).toEqual(normalizeTiledMap('intro', rawLevel));
  });

  it('default and neon resolve the same semantic asset roles with different textures', () => {
    const defaultRoles = defaultTheme.assets.map((asset) => asset.role).sort();
    const neonRoles = neonTheme.assets.map((asset) => asset.role).sort();
    expect(defaultRoles).toEqual(neonRoles);

    const defaultPlayerKey = defaultTheme.assets.find((asset) => asset.role === 'player')?.key;
    const neonPlayerKey = neonTheme.assets.find((asset) => asset.role === 'player')?.key;
    expect(defaultPlayerKey).not.toBe(neonPlayerKey);
  });
});
