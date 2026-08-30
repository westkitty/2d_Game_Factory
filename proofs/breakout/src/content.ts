import type { AssetDescriptor, ContentBundle, ContentSource, ThemeManifest, UiCopy } from '@sw2d/contracts';
import { normalizeTiledMap } from '@sw2d/content-pipeline';
import { validateContentBundleData, validateDocumentOrThrow } from '@sw2d/schemas';
import gameData from '../content/game.json' with { type: 'json' };
import tuningData from '../content/tuning.json' with { type: 'json' };
import themeData from '../content/themes/default/theme.json' with { type: 'json' };
import rawLevel from '../content/levels/main.json' with { type: 'json' };
import ballPaddleData from '../content/ball-paddle.json' with { type: 'json' };

/**
 * The generated game's content source.
 *
 * `content/ball-paddle.json` is the Phase 16 document
 * (`urn:sw2d:schema:content-ball-paddle:v1`): the ball, the arena and its edge
 * behaviours, the paddle, the brick catalog, the wall layout and the match rules.
 * Every rule of Breakout lives there rather than in this game's code.
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
      'ball-paddle': ballPaddleData,
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
