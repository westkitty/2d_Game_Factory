/**
 * Versioned metadata persistence.
 *
 * Every `.sw2d/` document is written temp-then-rename so a crash halfway
 * through a save leaves either the previous complete document or the new
 * complete one - never half-JSON (section 11). `fsync` before the rename is
 * what makes that true on a real power loss rather than only on a process
 * crash.
 */

import { closeSync, existsSync, fsyncSync, mkdirSync, openSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';

export class MetadataError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MetadataError';
  }
}

export interface Versioned {
  readonly version: number;
}

export function writeJsonAtomic(filePath: string, value: unknown): void {
  mkdirSync(path.dirname(filePath), { recursive: true });
  const temp = `${filePath}.tmp-${process.pid}`;
  const text = JSON.stringify(value, null, 2) + '\n';
  writeFileSync(temp, text, 'utf8');
  const handle = openSync(temp, 'r');
  try {
    fsyncSync(handle);
  } finally {
    closeSync(handle);
  }
  renameSync(temp, filePath);
}

/**
 * Reads a versioned document, falling back to `fallback` when it is absent.
 *
 * A *malformed* document is not silently replaced by the fallback: that would
 * turn a corrupted asset index into "you have no assets", which is exactly
 * the kind of hidden data loss Godot's import-state pain teaches against.
 */
export function readJsonVersioned<T extends Versioned>(filePath: string, expectedVersion: number, fallback: T): T {
  if (!existsSync(filePath)) return fallback;
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(filePath, 'utf8'));
  } catch (error) {
    throw new MetadataError(`"${filePath}" is not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (typeof parsed !== 'object' || parsed === null) {
    throw new MetadataError(`"${filePath}" is not a metadata object.`);
  }
  const version = (parsed as Versioned).version;
  if (version !== expectedVersion) {
    throw new MetadataError(`"${filePath}" has version ${String(version)}; this workbench understands version ${expectedVersion}.`);
  }
  return parsed as T;
}

/** Removes a file if present. Used for disposable caches only - never for a source asset. */
export function removeIfPresent(filePath: string): void {
  rmSync(filePath, { force: true });
}
