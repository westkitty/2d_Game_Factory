import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { REPO_ROOT } from '../src/paths.ts';

/**
 * Clean-checkout install reproducibility (Category-C convergence program).
 *
 * The root `package.json` declares `games/*`, `demos/*` and `proofs/*` as
 * workspaces. `games/` is gitignored scratch output, so a lockfile that
 * gained a `games/<id>` link entry from a local `npm install` would make
 * `npm ci` fail for everyone else (the linked directory does not exist in a
 * fresh clone). Conversely, every *committed* workspace (`demos/*`,
 * `proofs/*`) must be present in the lockfile, or `npm ci` refuses the
 * install with "lock file's ... does not satisfy" - the exact failure the
 * Category-C ledger once recorded against a stale environment.
 *
 * This suite pins both directions from the on-disk truth so a lockfile
 * drift fails here, in `npm test`, instead of at somebody else's `npm ci`.
 */

interface LockfileShape {
  readonly packages?: Record<string, { readonly link?: boolean; readonly resolved?: string }>;
}

function readLockfile(): LockfileShape {
  return JSON.parse(readFileSync(path.join(REPO_ROOT, 'package-lock.json'), 'utf8')) as LockfileShape;
}

function committedWorkspaceDirs(group: 'demos' | 'proofs'): readonly string[] {
  const root = path.join(REPO_ROOT, group);
  if (!existsSync(root)) return [];
  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(path.join(root, entry.name, 'package.json')))
    .map((entry) => `${group}/${entry.name}`)
    .sort();
}

describe('package-lock.json workspace policy', () => {
  const lock = readLockfile();
  const lockedPaths = Object.keys(lock.packages ?? {});

  it('never links a gitignored games/<id> scratch workspace', () => {
    const scratch = lockedPaths.filter((key) => key.startsWith('games/') || key.startsWith('node_modules/games/'));
    expect(scratch, 'scratch game workspaces leaked into the lockfile - delete games/* before `npm install`').toEqual([]);
  });

  it('records every committed demos/* workspace', () => {
    for (const dir of committedWorkspaceDirs('demos')) {
      expect(lockedPaths, `${dir} is a committed workspace but is missing from package-lock.json`).toContain(dir);
    }
  });

  it('records every committed proofs/* workspace', () => {
    for (const dir of committedWorkspaceDirs('proofs')) {
      expect(lockedPaths, `${dir} is a committed workspace but is missing from package-lock.json`).toContain(dir);
    }
  });

  it('every locked demos/* or proofs/* entry still exists on disk (no orphaned workspace links)', () => {
    const orphaned = lockedPaths.filter(
      (key) => (key.startsWith('demos/') || key.startsWith('proofs/')) && !existsSync(path.join(REPO_ROOT, key, 'package.json')),
    );
    expect(orphaned).toEqual([]);
  });
});
