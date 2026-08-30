import type { AssetDescriptor, ContentBundle, ContentSource, ThemeManifest, UiCopy } from '@sw2d/contracts';
import { normalizeTiledMap } from '@sw2d/content-pipeline';
import { validateContentBundleData, validateDocumentOrThrow } from '@sw2d/schemas';
import gameData from '../content/game.json' with { type: 'json' };
import tuningData from '../content/tuning.json' with { type: 'json' };
import themeData from '../content/themes/default/theme.json' with { type: 'json' };
import rawLevel from '../content/levels/main.json' with { type: 'json' };
import dialogueData from '../content/dialogue.json' with { type: 'json' };
import itemsData from '../content/items.json' with { type: 'json' };

/**
 * The generated game's content source.
 *
 * `content/dialogue.json` is the post-ten Phase 20 document
 * (`urn:sw2d:schema:content-dialogue:v1`): the characters and their portraits
 * by expression, the nodes, the lines, and the choices with their conditions
 * and effects.
 *
 * Every line and choice carries a stable id distinct from its text, because
 * text is the thing that gets translated and proofread and an id that *is* the
 * text breaks a save the first time a typo is fixed. Portraits are named by
 * *asset role* and resolved through the theme, so a zero-art build is valid.
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
      dialogue: dialogueData,
      items: itemsData,
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
