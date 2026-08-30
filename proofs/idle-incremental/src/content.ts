import type { AssetDescriptor, ContentBundle, ContentSource, ThemeManifest, UiCopy } from '@sw2d/contracts';
import { normalizeTiledMap } from '@sw2d/content-pipeline';
import { validateContentBundleData, validateDocumentOrThrow } from '@sw2d/schemas';
import gameData from '../content/game.json' with { type: 'json' };
import tuningData from '../content/tuning.json' with { type: 'json' };
import themeData from '../content/themes/default/theme.json' with { type: 'json' };
import rawLevel from '../content/levels/main.json' with { type: 'json' };
import economyData from '../content/economy.json' with { type: 'json' };

/**
 * The generated game's content source.
 *
 * Follows the same validated-JSON pattern `starter/src/content.ts` and
 * `starter/src/tiledProofContent.ts` establish: every document is schema-
 * validated before a ContentBundle is produced, so malformed content fails
 * here with a located error rather than wherever gameplay first touches a
 * bad field. Assets/UI/theme come from the local theme manifest
 * (content/themes/default/theme.json) - swap or add a theme with
 * `npm run sw2d -- add-theme proof-idle-incremental <theme-id>`. Every generated game
 * ships one Tiled level (content/levels/main.json) so the Tiled pipeline is
 * always real, even for controller families whose shell does not read it -
 * add more with `npm run sw2d -- add-level proof-idle-incremental <level-id>`.
 *
 * `content/economy.json` is the post-ten Phase 19 document
 * (`urn:sw2d:schema:content-economy:v1`): the smelting chain this idle game
 * runs, the offline cap and efficiency, and the prestige policy. The Phase-10
 * gold ledger and job primitive it already had are untouched - the economy sits
 * alongside them rather than replacing them.
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
    const data = validateContentBundleData({
      tuning: tuningData,
      'levels/main': normalizedLevel,
      economy: economyData,
    });

    const assets: readonly AssetDescriptor[] = theme.assets;
    const ui: Partial<UiCopy> | undefined = theme.ui;

    return {
      id: (gameData as { id: string }).id,
      schemaVersion: 1,
      assets,
      ...(ui !== undefined ? { ui } : {}),
      data,
    };
  },
};
