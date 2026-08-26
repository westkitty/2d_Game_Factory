import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { PathEscapeError, TargetExistsError, assertDoesNotExist, resolveUnder } from '../src/paths.ts';

describe('resolveUnder', () => {
  const root = '/repo/games';

  it('resolves a plain id under the root', () => {
    expect(resolveUnder(root, 'my-game')).toBe('/repo/games/my-game');
  });

  it('throws PathEscapeError for a traversal that escapes the root', () => {
    expect(() => resolveUnder(root, '../outside')).toThrow(PathEscapeError);
  });

  it('throws PathEscapeError for an absolute path pointing elsewhere', () => {
    expect(() => resolveUnder(root, '/etc/passwd')).toThrow(PathEscapeError);
  });
});

describe('assertDoesNotExist', () => {
  let dir: string;

  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  it('does not throw when the path is free', () => {
    dir = mkdtempSync(path.join(tmpdir(), 'sw2d-paths-'));
    expect(() => assertDoesNotExist('Game', path.join(dir, 'nope'))).not.toThrow();
  });

  it('throws TargetExistsError when the path already exists', () => {
    dir = mkdtempSync(path.join(tmpdir(), 'sw2d-paths-'));
    const target = path.join(dir, 'taken');
    writeFileSync(target, 'x');
    expect(() => assertDoesNotExist('Game', target)).toThrow(TargetExistsError);
  });
});
