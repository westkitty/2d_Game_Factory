import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { validateDocumentOrThrow } from '@sw2d/schemas';
import { normalizeTiledMap } from '@sw2d/content-pipeline';
import { generateTiledLevel } from '../generator/contentDocuments.ts';
import { GAMES_ROOT, TargetExistsError, assertDoesNotExist, resolveUnder } from '../paths.ts';
import { InvalidSlugError, assertValidSlug } from '../slug.ts';

export async function run(args: readonly string[]): Promise<number> {
  const [gameId, levelId] = args;
  if (!gameId || !levelId) {
    console.error('Usage: npm run sw2d -- add-level <game-id> <level-id>');
    return 1;
  }

  try {
    assertValidSlug('game id', gameId);
    assertValidSlug('level id', levelId);
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

  const levelsDir = `${gamePath}/content/levels`;
  const targetPath = `${resolveUnder(levelsDir, levelId)}.json`;
  try {
    assertDoesNotExist(`Level "${levelId}"`, targetPath);
  } catch (error) {
    if (error instanceof TargetExistsError) {
      console.error(error.message);
      return 1;
    }
    throw error;
  }

  const level = generateTiledLevel();
  // Self-validate before writing - the same "must run before custom art
  // exists" ethos the rest of the factory applies (MASTER_PROJECT.md
  // section 8), not just trust the generator.
  const normalized = normalizeTiledMap(levelId, level);
  validateDocumentOrThrow('level-document', `content/levels/${levelId}.json`, normalized);

  mkdirSync(levelsDir, { recursive: true });
  writeFileSync(targetPath, JSON.stringify(level, null, 2) + '\n', 'utf8');
  console.log(`Wrote content/levels/${levelId}.json for "${gameId}". Reference it as content document "levels/${levelId}".`);
  return 0;
}
