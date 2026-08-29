import type { AssetDescriptor, ContentBundle, ContentSource, ThemeManifest, UiCopy } from '@sw2d/contracts';
import { normalizeTiledMap } from '@sw2d/content-pipeline';
import { validateContentBundleData, validateDocumentOrThrow } from '@sw2d/schemas';
import gameData from '../content/game.json' with { type: 'json' };
import tuningData from '../content/tuning.json' with { type: 'json' };
import themeData from '../content/themes/default/theme.json' with { type: 'json' };
import rawMain from '../content/levels/main.json' with { type: 'json' };
import rawHub from '../content/levels/hub.json' with { type: 'json' };
import rawEast from '../content/levels/east.json' with { type: 'json' };
import rawTreasury from '../content/levels/treasury.json' with { type: 'json' };
import itemsData from '../content/items.json' with { type: 'json' };
import weaponsData from '../content/weapons.json' with { type: 'json' };
import encountersData from '../content/encounters.json' with { type: 'json' };
import puzzlesData from '../content/puzzles.json' with { type: 'json' };
import generationData from '../content/generation.json' with { type: 'json' };
import worldGraphData from '../content/world-graph.json' with { type: 'json' };

/**
 * Proof - metroidvania (see ../PROOF_CONTRACT.md).
 *
 * Three real rooms (hub / east / treasury), each its own validated Tiled
 * level, referenced by `content/world-graph.json`. No hand-coded Phaser
 * scenes: the reusable `sw2d.world-graph` capability owns the graph and the
 * transition bridge rebuilds one room at a time.
 */
const theme: ThemeManifest = validateDocumentOrThrow<ThemeManifest>('theme-manifest', 'content/themes/default/theme.json', themeData);

export const gameContent: ContentSource = {
  id: (gameData as { id: string }).id,
  load: async (): Promise<ContentBundle> => {
    const data = validateContentBundleData({
      tuning: tuningData,
      'levels/main': normalizeTiledMap('main', rawMain),
      'levels/hub': normalizeTiledMap('hub', rawHub),
      'levels/east': normalizeTiledMap('east', rawEast),
      'levels/treasury': normalizeTiledMap('treasury', rawTreasury),
      items: itemsData,
      weapons: weaponsData,
      encounters: encountersData,
      puzzles: puzzlesData,
      generation: generationData,
      'world-graph': worldGraphData,
    });

    const assets: readonly AssetDescriptor[] = theme.assets;
    const ui: Partial<UiCopy> | undefined = theme.ui;
    return {
      id: (gameData as { id: string }).id,
      schemaVersion: 1,
      assets,
      ...(theme.animations !== undefined ? { animations: theme.animations } : {}),
      ...(ui !== undefined ? { ui } : {}),
      data,
    };
  },
};
