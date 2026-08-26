import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { computeChecksums, formatSha256Sums, parseSha256Sums, verifyChecksums } from '../src/releasePackaging/checksums.ts';

describe('checksums', () => {
  let dir: string;

  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  function makeFixture(): string {
    const d = mkdtempSync(path.join(tmpdir(), 'sw2d-checksums-'));
    mkdirSync(path.join(d, 'assets'));
    writeFileSync(path.join(d, 'index.html'), '<html></html>');
    writeFileSync(path.join(d, 'assets', 'main.js'), 'console.log(1);');
    return d;
  }

  it('computes a sorted, deterministic checksum for every file, recursively', async () => {
    dir = makeFixture();
    const entries = await computeChecksums(dir);
    expect(entries.map((e) => e.relativePath)).toEqual(['assets/main.js', 'index.html']);
    expect(entries.every((e) => /^[0-9a-f]{64}$/.test(e.sha256))).toBe(true);
  });

  it('produces the same checksums on repeated runs over identical content', async () => {
    dir = makeFixture();
    const first = await computeChecksums(dir);
    const second = await computeChecksums(dir);
    expect(second).toEqual(first);
  });

  it('formatSha256Sums and parseSha256Sums round-trip', async () => {
    dir = makeFixture();
    const entries = await computeChecksums(dir);
    const text = formatSha256Sums(entries);
    expect(parseSha256Sums(text)).toEqual(entries);
  });

  it('verifyChecksums finds no mismatch for an untouched pack', async () => {
    dir = makeFixture();
    const entries = await computeChecksums(dir);
    expect(await verifyChecksums(dir, entries)).toEqual([]);
  });

  it('verifyChecksums detects a tampered file', async () => {
    dir = makeFixture();
    const entries = await computeChecksums(dir);
    writeFileSync(path.join(dir, 'assets', 'main.js'), 'console.log(2); // tampered');
    const mismatches = await verifyChecksums(dir, entries);
    expect(mismatches).toEqual([{ relativePath: 'assets/main.js', reason: 'mismatch' }]);
  });

  it('verifyChecksums detects a missing file', async () => {
    dir = makeFixture();
    const entries = await computeChecksums(dir);
    rmSync(path.join(dir, 'index.html'));
    const mismatches = await verifyChecksums(dir, entries);
    expect(mismatches).toEqual([{ relativePath: 'index.html', reason: 'missing' }]);
  });

  it('excludes the given relative paths (so SHA256SUMS never has to include itself)', async () => {
    dir = makeFixture();
    writeFileSync(path.join(dir, 'SHA256SUMS'), 'placeholder');
    const entries = await computeChecksums(dir, ['SHA256SUMS']);
    expect(entries.map((e) => e.relativePath)).not.toContain('SHA256SUMS');
  });
});
