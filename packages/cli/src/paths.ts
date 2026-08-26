import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Repository root, resolved from this file's own location - never from process.cwd(). */
export const REPO_ROOT = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '../../..');

export const GAMES_ROOT = path.join(REPO_ROOT, 'games');
export const DEMOS_ROOT = path.join(REPO_ROOT, 'demos');

export class PathEscapeError extends Error {
  constructor(root: string, resolved: string) {
    super(`Refusing to write outside "${root}": resolved path "${resolved}" escapes it.`);
    this.name = 'PathEscapeError';
  }
}

/**
 * Resolve `id` (already slug-validated by the caller) under `root` and prove
 * the result is still inside `root`. Defence in depth: `assertValidSlug`
 * already rejects the characters that would let an id escape, but a path
 * this function returns is about to be written to, so it re-derives safety
 * from the resolved path itself rather than trusting the caller remembered.
 */
export function resolveUnder(root: string, id: string): string {
  const resolved = path.resolve(root, id);
  const relative = path.relative(root, resolved);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new PathEscapeError(root, resolved);
  }
  return resolved;
}

export class TargetExistsError extends Error {
  constructor(kind: string, targetPath: string) {
    super(`${kind} already exists at "${path.relative(REPO_ROOT, targetPath)}"; refusing to overwrite.`);
    this.name = 'TargetExistsError';
  }
}

/** Throws TargetExistsError if the path is already present. No --force mode exists (MASTER_PROJECT.md section 6/26). */
export function assertDoesNotExist(kind: string, targetPath: string): void {
  if (existsSync(targetPath)) {
    throw new TargetExistsError(kind, targetPath);
  }
}
