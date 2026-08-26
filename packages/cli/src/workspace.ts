import { run } from './exec.ts';
import { REPO_ROOT } from './paths.ts';

/**
 * Link a freshly-generated game into the npm workspace so its
 * `@sw2d/*`/`phaser` dependencies resolve from the repository's own
 * node_modules (MASTER_PROJECT.md section 7: "generated source may consume
 * local factory workspaces while inside this repository"). Idempotent and
 * fast when nothing changed - safe to call at the start of every command
 * that needs to run something inside a generated game.
 */
export async function ensureWorkspaceInstalled(): Promise<void> {
  const result = await run('npm', ['install'], { cwd: REPO_ROOT });
  if (result.code !== 0) {
    throw new Error(`npm install failed while linking the workspace:\n${result.stderr || result.stdout}`);
  }
}
