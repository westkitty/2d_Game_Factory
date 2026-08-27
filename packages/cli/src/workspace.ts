import { existsSync } from 'node:fs';
import path from 'node:path';
import { REPO_ROOT } from './paths.ts';

/**
 * Repository-installed packages/tools a generated game relies on through
 * ordinary ancestor node_modules resolution. A generated game does not need a
 * second npm install or a game-local workspace link: tsc, Vite and Node all
 * resolve these from the already-installed factory root.
 */
export const WORKSPACE_REQUIRED_PATHS = [
  'node_modules/@sw2d/contracts/package.json',
  'node_modules/@sw2d/content-pipeline/package.json',
  'node_modules/@sw2d/packs/package.json',
  'node_modules/@sw2d/runtime/package.json',
  'node_modules/@sw2d/schemas/package.json',
  'node_modules/@sw2d/qa/package.json',
  'node_modules/phaser/package.json',
  'node_modules/typescript/package.json',
  'node_modules/vite/package.json',
  'node_modules/vitest/package.json',
] as const;

/**
 * Prove the factory root was installed before operating on a generated game.
 *
 * This intentionally performs no package-manager mutation. Earlier code ran
 * `npm install --offline --no-package-lock` after every generated game, which
 * still depended on npm's cache and could fail on a clean offline machine.
 * Generated games already resolve dependencies from the root node_modules, so
 * the correct operation is a read-only readiness check.
 */
export async function ensureWorkspaceInstalled(): Promise<void> {
  const missing = WORKSPACE_REQUIRED_PATHS.filter((relativePath) => !existsSync(path.join(REPO_ROOT, relativePath)));
  if (missing.length > 0) {
    throw new Error(
      `Factory dependencies are not installed. Missing: ${missing.join(', ')}. ` +
        'Install the repository dependencies once before using generated games.',
    );
  }
}
