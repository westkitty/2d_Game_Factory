import type { ContentBundle, ContentSource, ThemeManifest } from '@sw2d/contracts';
import { normalizeTiledMap } from '@sw2d/content-pipeline';
import { validateContentBundleData, validateDocumentOrThrow } from '@sw2d/schemas';
import rawLevel from '../content/levels/intro.json' with { type: 'json' };
import defaultTheme from '../content/themes/default/theme.json' with { type: 'json' };
import neonTheme from '../content/themes/neon/theme.json' with { type: 'json' };

/**
 * The Tiled-proof page's content source.
 *
 * Two themes exist so a test - and the browser proof - can show the same
 * level surviving a theme swap: `selectedTheme` changes only `assets`/`ui`/
 * `tokens`; `data['levels/intro']` (the normalized level - spawn point,
 * solids, every semantic object) is identical regardless of which theme is
 * selected, because normalizeTiledMap never reads theme.json at all.
 */

const THEMES: Readonly<Record<string, unknown>> = {
  default: defaultTheme,
  neon: neonTheme,
};

export const THEME_IDS: readonly string[] = Object.keys(THEMES);

function readThemeIdFromUrl(): string {
  if (typeof window === 'undefined') return 'default';
  const requested = new URLSearchParams(window.location.search).get('theme');
  return requested !== null && requested in THEMES ? requested : 'default';
}

export const selectedThemeId = readThemeIdFromUrl();

// The whole theme document - including its `assets` and optional `ui` - is
// validated here, at the content boundary, in one pass (theme-manifest.schema.json
// itself $refs asset-descriptor and ui-copy). A malformed theme.json fails
// right here, before a ContentBundle exists, the same guarantee game.json
// and tuning.json already carry.
export const selectedTheme: ThemeManifest = validateDocumentOrThrow<ThemeManifest>(
  'theme-manifest',
  `content/themes/${selectedThemeId}/theme.json`,
  THEMES[selectedThemeId],
);

export const tiledProofContent: ContentSource = {
  id: 'sw2d-tiled-proof',
  load: async (): Promise<ContentBundle> => {
    // normalizeTiledMap + the level-document schema below are the two-stage
    // gate: content-pipeline transforms and semantically validates (unknown
    // classes, missing required properties), @sw2d/schemas re-validates the
    // transform's own output shape - the same split presetComposition uses
    // for rules JSON Schema alone cannot express.
    const normalizedLevel = normalizeTiledMap('intro', rawLevel);
    const data = validateContentBundleData({ 'levels/intro': normalizedLevel });

    return {
      id: 'sw2d-tiled-proof',
      schemaVersion: 1,
      assets: selectedTheme.assets,
      ...(selectedTheme.ui !== undefined ? { ui: selectedTheme.ui } : {}),
      data,
    };
  },
};
