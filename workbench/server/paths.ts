/**
 * Every filesystem path the workbench host touches is derived here.
 *
 * Roots come from this file's own location, never from `process.cwd()` - the
 * same rule `packages/cli/src/paths.ts` follows, for the same reason: a host
 * started from any directory must still write into this repository and only
 * into this repository.
 */

import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPO_ROOT = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '../..');
export const GAMES_ROOT = path.join(REPO_ROOT, 'games');
export const DEMOS_ROOT = path.join(REPO_ROOT, 'demos');
export const PROOFS_ROOT = path.join(REPO_ROOT, 'proofs');
export const WORKBENCH_ROOT = path.join(REPO_ROOT, 'workbench');

export class PathContainmentError extends Error {
  constructor(root: string, resolved: string) {
    super(`Refusing to touch "${resolved}": it escapes "${root}".`);
    this.name = 'PathContainmentError';
  }
}

/**
 * Join `segments` under `root` and prove the result is still inside it.
 *
 * Containment is re-derived from the *resolved* path rather than from a check
 * on the inputs, so a segment that survives validation but still escapes
 * (`..`, an absolute path, a symlink-shaped name) is caught here. The trailing
 * separator on `root` matters: without it, `/games/a` would appear to contain
 * `/games/abc`.
 */
export function resolveContained(root: string, ...segments: readonly string[]): string {
  const resolved = path.resolve(root, ...segments);
  const rootWithSep = root.endsWith(path.sep) ? root : root + path.sep;
  if (resolved !== root && !resolved.startsWith(rootWithSep)) {
    throw new PathContainmentError(root, resolved);
  }
  return resolved;
}

export function gameRoot(gameId: string): string {
  return resolveContained(GAMES_ROOT, gameId);
}

export function sw2dDir(gameId: string): string {
  return resolveContained(gameRoot(gameId), '.sw2d');
}

export function sourceAssetsDir(gameId: string): string {
  return resolveContained(sw2dDir(gameId), 'source-assets');
}

export function cacheDir(gameId: string): string {
  return resolveContained(sw2dDir(gameId), 'cache');
}

/** Where derived, game-local, same-origin runtime assets live. Vite serves `public/` at the site root, so the runtime URL is `assets/workbench/<file>`. */
export function derivedAssetsDir(gameId: string): string {
  return resolveContained(gameRoot(gameId), 'public', 'assets', 'workbench');
}

/** The URL a theme's `{ kind: 'image' }` descriptor uses for a derived asset. Relative and same-origin by construction. */
export function derivedAssetUrl(fileName: string): string {
  return `assets/workbench/${fileName}`;
}

export function ensureDir(dir: string): void {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

/** A repository-relative path, for display and for metadata that must stay portable across machines. */
export function repoRelative(absolutePath: string): string {
  return path.relative(REPO_ROOT, absolutePath).split(path.sep).join('/');
}

export function projectRelative(gameId: string, absolutePath: string): string {
  return path.relative(gameRoot(gameId), absolutePath).split(path.sep).join('/');
}
