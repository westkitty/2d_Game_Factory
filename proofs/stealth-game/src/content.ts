import type { AssetDescriptor, ContentBundle, ContentSource, ThemeManifest, UiCopy } from '@sw2d/contracts';
import { normalizeTiledMap } from '@sw2d/content-pipeline';
import { validateContentBundleData, validateDocumentOrThrow } from '@sw2d/schemas';
import gameData from '../content/game.json' with { type: 'json' };
import tuningData from '../content/tuning.json' with { type: 'json' };
import perceptionData from '../content/perception.json' with { type: 'json' };
import themeData from '../content/themes/default/theme.json' with { type: 'json' };
import rawLevel from '../content/levels/main.json' with { type: 'json' };

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
      perception: perceptionData,
      'levels/main': normalizedLevel,
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
