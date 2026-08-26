import { run } from './exec.ts';
import { REPO_ROOT } from './paths.ts';

/**
 * The one allowed npm invocation for linking generated games into the local
 * workspace. It is deliberately offline and package-lock-free:
 *
 * - generated games live under the root `games/*` workspace and therefore
 *   need npm to refresh workspace links after creation;
 * - ordinary factory use must not contact the registry; the repository has
 *   already been installed before the workbench starts;
 * - scratch games must never become tracked `package-lock.json` entries.
 */
export const WORKSPACE_INSTALL_ARGS = ['install', '--offline', '--no-package-lock', '--no-audit', '--no-fund'] as const;

/**
 * Link a freshly-generated game into the npm workspace so its
 * `@sw2d/*`/`phaser` dependencies resolve from the repository's own
 * node_modules (MASTER_PROJECT.md section 7: "generated source may consume
 * local factory workspaces while inside this repository").
 *
 * The operation is intentionally local-only and does not rewrite the tracked
 * lockfile. If the repository was not installed first, npm fails instead of
 * silently reaching the network.
 */
export async function ensureWorkspaceInstalled(): Promise<void> {
  const result = await run('npm', WORKSPACE_INSTALL_ARGS, { cwd: REPO_ROOT });
  if (result.code !== 0) {
    throw new Error(`offline npm workspace linking failed:\n${result.stderr || result.stdout}`);
  }
}
