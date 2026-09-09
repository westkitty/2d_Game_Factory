import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { validateDocumentOrThrow } from '@sw2d/schemas';
import { generateTheme } from '../generator/contentDocuments.ts';
import { GAMES_ROOT, TargetExistsError, assertDoesNotExist, resolveUnder } from '../paths.ts';
import { InvalidSlugError, assertValidSlug } from '../slug.ts';

export async function run(args: readonly string[]): Promise<number> {
  const [gameId, themeId] = args;
  if (!gameId || !themeId) {
    console.error('Usage: npm run sw2d -- add-theme <game-id> <theme-id>');
    return 1;
  }

  try {
    assertValidSlug('game id', gameId);
    assertValidSlug('theme id', themeId);
  } catch (error) {
    if (error instanceof InvalidSlugError) {
      console.error(error.message);
      return 1;
    }
    throw error;
  }

  const gamePath = resolveUnder(GAMES_ROOT, gameId);
  if (!existsSync(gamePath)) {
    console.error(`Game "${gameId}" does not exist. Run: npm run sw2d -- new ${gameId} --preset <preset-id>`);
    return 1;
  }

  const themesDir = `${gamePath}/content/themes`;
  const themeDir = resolveUnder(themesDir, themeId);
  const targetPath = `${themeDir}/theme.json`;
  try {
    assertDoesNotExist(`Theme "${themeId}"`, themeDir);
  } catch (error) {
    if (error instanceof TargetExistsError) {
      console.error(error.message);
      return 1;
    }
    throw error;
  }

  // Carry the default theme's ui copy forward: switching a shooter's palette
  // must not silently revert its HUD back to the runtime's neutral copy
  // (Wave 2's generateUiCopy work would otherwise be lost on add-theme).
  let inheritedUi: Record<string, string> | undefined;
  const defaultThemePath = `${themesDir}/default/theme.json`;
  if (existsSync(defaultThemePath)) {
    try {
      const defaultTheme = JSON.parse(readFileSync(defaultThemePath, 'utf8')) as { ui?: Record<string, string> };
      inheritedUi = defaultTheme.ui;
    } catch {
      /* unreadable default theme: the new theme simply carries no ui copy */
    }
  }

  const theme = generateTheme(themeId, themeId.charAt(0).toUpperCase() + themeId.slice(1), inheritedUi);
  validateDocumentOrThrow('theme-manifest', `content/themes/${themeId}/theme.json`, theme);

  mkdirSync(themeDir, { recursive: true });
  writeFileSync(targetPath, JSON.stringify(theme, null, 2) + '\n', 'utf8');
  console.log(`Wrote content/themes/${themeId}/theme.json for "${gameId}". Point src/content.ts at it to switch themes.`);
  return 0;
}
