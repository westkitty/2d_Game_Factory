import { UnknownPresetError, getPreset } from '@sw2d/presets';
import { buildGameFiles, findUnresolvedTokens, writeGameFiles } from '../generator/generate.ts';
import { assertDoesNotExist, GAMES_ROOT, resolveUnder } from '../paths.ts';
import { assertValidSlug, InvalidSlugError } from '../slug.ts';
import { parseArgs } from '../args.ts';

export async function run(args: readonly string[]): Promise<number> {
  const { positional, flags } = parseArgs(args);
  const gameId = positional[0];
  const presetId = flags.preset;

  if (!gameId || !presetId) {
    console.error('Usage: npm run sw2d -- new <game-id> --preset <preset-id>');
    return 1;
  }

  try {
    assertValidSlug('game id', gameId);
  } catch (error) {
    if (error instanceof InvalidSlugError) {
      console.error(error.message);
      return 1;
    }
    throw error;
  }

  let preset;
  try {
    preset = getPreset(presetId);
  } catch (error) {
    if (error instanceof UnknownPresetError) {
      console.error(error.message);
      console.error('Run: npm run sw2d -- list-presets');
      return 1;
    }
    throw error;
  }

  const targetPath = resolveUnder(GAMES_ROOT, gameId);
  try {
    assertDoesNotExist(`Game "${gameId}"`, targetPath);
  } catch (error) {
    console.error((error as Error).message);
    return 1;
  }

  const files = buildGameFiles(gameId, preset);
  const unresolved = findUnresolvedTokens(files);
  if (unresolved.length > 0) {
    console.error(`Internal generator error: unresolved template token(s) ${unresolved.join(', ')}. Not writing "${gameId}".`);
    return 1;
  }

  writeGameFiles(files, targetPath);
  console.log(`Generated "${gameId}" from preset "${presetId}" at games/${gameId}/.`);
  console.log(`Next: npm install && npm run sw2d -- validate ${gameId}`);
  return 0;
}
