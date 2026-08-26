/**
 * A bounded, dependency-free ZIP reader for asset packs.
 *
 * Construct 3's import surface is worth copying (folders and zips, not
 * frame-by-frame), but a ZIP from the internet is hostile input. Everything
 * here is a limit or a refusal:
 *
 *  - entries are read from the central directory, not by scanning for local
 *    headers, so a crafted local header cannot smuggle in an extra file;
 *  - zip-slip is refused outright - any entry whose name is absolute, contains
 *    `..`, or has a drive letter is rejected by name, not sanitised into
 *    something that might still escape;
 *  - entry count, per-entry uncompressed size and total expanded size are all
 *    capped before a single byte is inflated;
 *  - only stored (0) and deflated (8) methods are accepted, and nothing is
 *    ever executed or interpreted - entries are bytes handed to the image
 *    sniffer, which decides what they are.
 *
 * Built on `node:zlib`'s raw inflate, which is the only piece that would
 * otherwise need a dependency.
 */

import { inflateRawSync } from 'node:zlib';
import { LIMITS } from './security.ts';

export class ZipError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ZipError';
  }
}

export interface ZipEntry {
  readonly name: string;
  readonly bytes: Uint8Array;
}

export interface ZipReadResult {
  readonly entries: readonly ZipEntry[];
  /** Entries deliberately not returned, with the reason - shown in the Import Inbox's "ignored" list rather than silently dropped. */
  readonly skipped: readonly { readonly name: string; readonly reason: string }[];
}

const END_OF_CENTRAL_DIRECTORY = 0x06054b50;
const CENTRAL_FILE_HEADER = 0x02014b50;

function findEndOfCentralDirectory(view: DataView, length: number): number {
  // The EOCD is at the end, but a trailing comment can push it back up to
  // 64 KiB, so scan backwards over that window rather than assuming.
  const earliest = Math.max(0, length - 0x10000 - 22);
  for (let offset = length - 22; offset >= earliest; offset--) {
    if (view.getUint32(offset, true) === END_OF_CENTRAL_DIRECTORY) return offset;
  }
  throw new ZipError('Not a ZIP archive: no end-of-central-directory record found.');
}

/** Rejects, never sanitises. A name that needed cleaning to be safe is a name the archive should not have contained. */
function unsafeEntryName(name: string): string | null {
  if (name.length === 0) return 'empty name';
  if (name.startsWith('/') || name.startsWith('\\')) return 'absolute path';
  if (/^[a-zA-Z]:/.test(name)) return 'drive-letter path';
  if (name.split(/[\\/]/).includes('..')) return 'path traversal';
  if (name.includes('\0')) return 'null byte in name';
  return null;
}

export function readZip(bytes: Uint8Array): ZipReadResult {
  if (bytes.length < 22) throw new ZipError('Not a ZIP archive: file is too small.');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  const eocd = findEndOfCentralDirectory(view, bytes.length);
  const entryCount = view.getUint16(eocd + 10, true);
  const centralDirectoryOffset = view.getUint32(eocd + 16, true);

  if (entryCount > LIMITS.zipEntryCount) {
    throw new ZipError(`ZIP declares ${entryCount} entries, over the ${LIMITS.zipEntryCount}-entry limit.`);
  }

  const entries: ZipEntry[] = [];
  const skipped: { name: string; reason: string }[] = [];
  let expandedTotal = 0;
  let offset = centralDirectoryOffset;

  for (let index = 0; index < entryCount; index++) {
    if (offset + 46 > bytes.length) throw new ZipError('Truncated ZIP: central directory runs past the end of the file.');
    if (view.getUint32(offset, true) !== CENTRAL_FILE_HEADER) throw new ZipError(`Malformed ZIP: bad central directory header at entry ${index}.`);

    const method = view.getUint16(offset + 10, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const uncompressedSize = view.getUint32(offset + 24, true);
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const localOffset = view.getUint32(offset + 42, true);
    const name = new TextDecoder().decode(bytes.subarray(offset + 46, offset + 46 + nameLength));
    offset += 46 + nameLength + extraLength + commentLength;

    const unsafe = unsafeEntryName(name);
    if (unsafe) {
      skipped.push({ name, reason: `refused: ${unsafe}` });
      continue;
    }
    if (name.endsWith('/')) continue; // directory entry, nothing to read
    // macOS resource forks and Windows thumbnail caches are noise in every
    // real asset pack; naming them explicitly is friendlier than "unsupported".
    if (name.startsWith('__MACOSX/') || name.split('/').pop()?.startsWith('._') || name.endsWith('.DS_Store') || name.endsWith('Thumbs.db')) {
      skipped.push({ name, reason: 'system file' });
      continue;
    }
    if (method !== 0 && method !== 8) {
      skipped.push({ name, reason: `unsupported compression method ${method}` });
      continue;
    }
    if (uncompressedSize > LIMITS.zipEntryBytes) {
      skipped.push({ name, reason: `entry is ${uncompressedSize} bytes, over the ${LIMITS.zipEntryBytes}-byte per-entry limit` });
      continue;
    }
    if (expandedTotal + uncompressedSize > LIMITS.zipExpandedBytes) {
      skipped.push({ name, reason: 'total expanded size limit reached' });
      continue;
    }

    // Local header length is variable, so the data offset must be read from
    // the local header itself rather than assumed from the central one.
    if (localOffset + 30 > bytes.length) throw new ZipError(`Truncated ZIP: local header for "${name}" is past the end of the file.`);
    const localNameLength = view.getUint16(localOffset + 26, true);
    const localExtraLength = view.getUint16(localOffset + 28, true);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    if (dataStart + compressedSize > bytes.length) throw new ZipError(`Truncated ZIP: data for "${name}" is past the end of the file.`);

    const raw = bytes.subarray(dataStart, dataStart + compressedSize);
    let inflated: Uint8Array;
    try {
      inflated = method === 0 ? new Uint8Array(raw) : new Uint8Array(inflateRawSync(raw, { maxOutputLength: LIMITS.zipEntryBytes }));
    } catch (error) {
      skipped.push({ name, reason: `could not decompress: ${error instanceof Error ? error.message : String(error)}` });
      continue;
    }

    expandedTotal += inflated.length;
    entries.push({ name, bytes: inflated });
  }

  return { entries, skipped };
}

export function looksLikeZip(bytes: Uint8Array): boolean {
  return bytes.length > 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && (bytes[2] === 0x03 || bytes[2] === 0x05 || bytes[2] === 0x07);
}
