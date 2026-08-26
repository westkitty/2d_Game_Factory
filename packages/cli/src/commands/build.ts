import { existsSync } from 'node:fs';
import { run as runProcess } from '../exec.ts';
import { GAMES_ROOT, resolveUnder } from '../paths.ts';
import { InvalidSlugError, assertValidSlug } from '../slug.ts';
import { ensureWorkspaceInstalled } from '../workspace.ts';

export async function run(args: readonly string[]): Promise<number> {
  const gameId = args[0];
  if (!gameId) {
    console.error('Usage: npm run sw2d -- build <game-id>');
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

  const gamePath = resolveUnder(GAMES_ROOT, gameId);
  if (!existsSync(gamePath)) {
    console.error(`Game "${gameId}" does not exist. Run: npm run sw2d -- new ${gameId} --preset <preset-id>`);
    return 1;
  }

  await ensureWorkspaceInstalled();

  const result = await runProcess('npx', ['vite', 'build'], { cwd: gamePath });
  if (result.code !== 0) {
    console.error(`Build failed for "${gameId}":`);
    console.error(result.stderr || result.stdout);
    return 1;
  }
  console.log(result.stdout);
  console.log(`Built "${gameId}" -> games/${gameId}/dist/`);
  return 0;
}
