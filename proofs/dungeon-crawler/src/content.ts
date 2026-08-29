import type { AssetDescriptor, ContentBundle, ContentSource, ThemeManifest, UiCopy } from '@sw2d/contracts';
import { normalizeTiledMap } from '@sw2d/content-pipeline';
import { validateContentBundleData, validateDocumentOrThrow } from '@sw2d/schemas';
import gameData from '../content/game.json' with { type: 'json' };
import tuningData from '../content/tuning.json' with { type: 'json' };
import themeData from '../content/themes/default/theme.json' with { type: 'json' };
import rawLevel from '../content/levels/main.json' with { type: 'json' };
import itemsData from '../content/items.json' with { type: 'json' };
import weaponsData from '../content/weapons.json' with { type: 'json' };
import encountersData from '../content/encounters.json' with { type: 'json' };
import puzzlesData from '../content/puzzles.json' with { type: 'json' };
import generationData from '../content/generation.json' with { type: 'json' };

/**
 * The generated game's content source.
 *
 * Follows the same validated-JSON pattern `starter/src/content.ts` and
 * `starter/src/tiledProofContent.ts` establish: every document is schema-
 * validated before a ContentBundle is produced, so malformed content fails
 * here with a located error rather than wherever gameplay first touches a
 * bad field. Assets/UI/theme come from the local theme manifest
 * (content/themes/default/theme.json) - swap or add a theme with
 * `npm run sw2d -- add-theme proof-dungeon-crawler <theme-id>`. Every generated game
 * ships one Tiled level (content/levels/main.json) so the Tiled pipeline is
 * always real, even for controller families whose shell does not read it -
 * add more with `npm run sw2d -- add-level proof-dungeon-crawler <level-id>`.
 */
const theme: ThemeManifest = validateDocumentOrThrow<ThemeManifest>(
  'theme-manifest',
  'content/themes/default/theme.json',
  themeData,
);

export const gameContent: ContentSource = {
  id: (gameData as { id: string }).id,
  load: async (): Promise<ContentBundle> => {
    const normalizedLevel = normalizeTiledMap('main', rawLevel);
    const data = validateContentBundleData({ tuning: tuningData, 'levels/main': normalizedLevel, items: itemsData, weapons: weaponsData, encounters: encountersData, puzzles: puzzlesData, generation: generationData });

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
