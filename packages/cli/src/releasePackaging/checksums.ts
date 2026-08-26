import { createHash } from 'node:crypto';
import { createReadStream, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

/**
 * SHA-256 checksums for a release pack (MASTER_PROJECT.md/Phase 11 section 5).
 * Node's own `node:crypto` - no new dependency. Paths are always POSIX
 * (`/`-separated) and sorted, regardless of host OS, so `SHA256SUMS` is
 * byte-identical across platforms for the same file contents - the same
 * determinism bar the generator itself holds (MASTER_PROJECT.md section 10).
 */

export interface ChecksumEntry {
  readonly relativePath: string;
  readonly sha256: string;
}

/** List every regular file under `rootDir`, recursively, as sorted POSIX-relative paths. Never includes `rootDir` itself or directory entries. */
function listFilesSorted(rootDir: string): string[] {
  const out: string[] = [];
  function walk(dir: string): void {
    for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile()) {
        out.push(path.relative(rootDir, fullPath).split(path.sep).join('/'));
      }
    }
  }
  walk(rootDir);
  return out.sort();
}

function sha256File(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    const stream = createReadStream(filePath);
    stream.on('error', reject);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}

/** Compute a SHA-256 checksum for every file under `rootDir`, excluding `excludeRelativePaths` (used to keep SHA256SUMS from trying to check itself in). */
export async function computeChecksums(rootDir: string, excludeRelativePaths: readonly string[] = []): Promise<ChecksumEntry[]> {
  const exclude = new Set(excludeRelativePaths);
  const relativePaths = listFilesSorted(rootDir).filter((p) => !exclude.has(p));
  const entries: ChecksumEntry[] = [];
  for (const relativePath of relativePaths) {
    const sha256 = await sha256File(path.join(rootDir, relativePath));
    entries.push({ relativePath, sha256 });
  }
  return entries;
}

/** `<hex-digest>  <relative/path>\n` per line, sorted by path - the same format `sha256sum` produces, so a human can also verify with the standard tool. */
export function formatSha256Sums(entries: readonly ChecksumEntry[]): string {
  return entries.map((e) => `${e.sha256}  ${e.relativePath}\n`).join('');
}

export interface ChecksumMismatch {
  readonly relativePath: string;
  readonly reason: 'missing' | 'mismatch';
}

/** Parse a SHA256SUMS file's contents into checksum entries. */
export function parseSha256Sums(content: string): ChecksumEntry[] {
  return content
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => {
      const match = /^([0-9a-f]{64})\s{2}(.+)$/.exec(line);
      if (!match) throw new Error(`Malformed SHA256SUMS line: "${line}"`);
      return { sha256: match[1]!, relativePath: match[2]! };
    });
}

/** Recompute every file's checksum under `rootDir` and compare against `expected`. A tampered or missing file is reported, never silently accepted. */
export async function verifyChecksums(rootDir: string, expected: readonly ChecksumEntry[]): Promise<ChecksumMismatch[]> {
  const mismatches: ChecksumMismatch[] = [];
  for (const entry of expected) {
    const filePath = path.join(rootDir, entry.relativePath);
    try {
      statSync(filePath);
    } catch {
      mismatches.push({ relativePath: entry.relativePath, reason: 'missing' });
      continue;
    }
    const actual = await sha256File(filePath);
    if (actual !== entry.sha256) mismatches.push({ relativePath: entry.relativePath, reason: 'mismatch' });
  }
  return mismatches;
}
