import { cpSync, existsSync, rmSync } from 'node:fs';
import { run as runProcess } from '../exec.ts';
import { REPO_ROOT, GAMES_ROOT, resolveUnder } from '../paths.ts';
import { InvalidSlugError, assertValidSlug } from '../slug.ts';
import { ensureWorkspaceInstalled } from '../workspace.ts';

export async function run(args: readonly string[]): Promise<number> {
  const gameId = args[0];
  if (!gameId) {
    console.error('Usage: npm run sw2d -- pack <game-id>');
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

  const buildResult = await runProcess('npx', ['vite', 'build'], { cwd: gamePath });
  if (buildResult.code !== 0) {
    console.error(`Build failed for "${gameId}":`);
    console.error(buildResult.stderr || buildResult.stdout);
    return 1;
  }

  const distDir = `${gamePath}/dist`;
  const packDir = `${gamePath}/pack`;
  // Clean packing, not incremental - a stale file from a previous pack must
  // never survive into this one.
  rmSync(packDir, { recursive: true, force: true });
  // dist/ already contains only build output (Vite never emits source, tests
  // or node_modules into it), so copying it verbatim already satisfies
  // MASTER_PROJECT.md section 9's "exclude source/tests/node_modules".
  cpSync(distDir, packDir, { recursive: true });

  const offlineResult = await runProcess('node', ['tools/scripts/check-offline-build.mjs', `games/${gameId}/pack`], {
    cwd: REPO_ROOT,
  });
  console.log(offlineResult.stdout);
  if (offlineResult.code !== 0) {
    console.error(offlineResult.stderr);
    console.error(`Pack produced but failed the offline guard for "${gameId}".`);
    return 1;
  }

  console.log(`Packed "${gameId}" -> games/${gameId}/pack/ (clean, static, offline-guard-passed).`);
  return 0;
}
