import type { AssetDescriptor, ContentBundle, ContentSource, ThemeManifest, UiCopy } from '@sw2d/contracts';
import { normalizeTiledMap } from '@sw2d/content-pipeline';
import { validateContentBundleData, validateDocumentOrThrow } from '@sw2d/schemas';
import gameData from '../content/game.json' with { type: 'json' };
import tuningData from '../content/tuning.json' with { type: 'json' };
import themeData from '../content/themes/default/theme.json' with { type: 'json' };
import rawMain from '../content/levels/main.json' with { type: 'json' };
import rawPlaza from '../content/levels/plaza.json' with { type: 'json' };
import rawGarden from '../content/levels/garden.json' with { type: 'json' };
import rawLibrary from '../content/levels/library.json' with { type: 'json' };
import itemsData from '../content/items.json' with { type: 'json' };
import weaponsData from '../content/weapons.json' with { type: 'json' };
import encountersData from '../content/encounters.json' with { type: 'json' };
import puzzlesData from '../content/puzzles.json' with { type: 'json' };
import generationData from '../content/generation.json' with { type: 'json' };
import worldGraphData from '../content/world-graph.json' with { type: 'json' };

/**
 * Proof - exploration-game (see ../PROOF_CONTRACT.md).
 *
 * Three areas (plaza / garden / library) in a loop, each its own validated
 * level, driven by the reusable `sw2d.world-graph` capability. Materially
 * simpler than the metroidvania proof: no gating, the point is discovery /
 * visited state, the map, and no duplicate room resources after repeated
 * back-and-forth traversal.
 */
const theme: ThemeManifest = validateDocumentOrThrow<ThemeManifest>('theme-manifest', 'content/themes/default/theme.json', themeData);

export const gameContent: ContentSource = {
  id: (gameData as { id: string }).id,
  load: async (): Promise<ContentBundle> => {
    const data = validateContentBundleData({
      tuning: tuningData,
      'levels/main': normalizeTiledMap('main', rawMain),
      'levels/plaza': normalizeTiledMap('plaza', rawPlaza),
      'levels/garden': normalizeTiledMap('garden', rawGarden),
      'levels/library': normalizeTiledMap('library', rawLibrary),
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
