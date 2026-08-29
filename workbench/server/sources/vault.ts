/**
 * The verified local asset-pack vault.
 *
 * Once a free pack has been safely acquired and its rights recorded, that work
 * is not repeated. The vault caches the raw pack bytes (keyed by SHA-256, so
 * identical downloads dedupe) alongside the exact licence/provenance snapshot
 * taken at acquisition. A later acquisition of the same pack reads from here
 * and never touches the network.
 *
 * CRITICAL: this is authoring infrastructure, not runtime infrastructure.
 * A generated game already contains its own local copies of whatever it uses;
 * deleting this vault cannot break an existing or packed game, and no game
 * ever reads from the vault path. Freshness is represented, never silently
 * turned into invalidity - a stale entry stays usable for what was already
 * built, and only a *new* acquisition re-checks it.
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { WORKBENCH_ROOT, resolveContained } from '../paths.ts';
import { readJsonVersioned, writeJsonAtomic } from '../atomicJson.ts';
import { evaluateRights } from './rights.ts';
import { findCandidate } from './registry.ts';
import type { RightsEvidence, RightsStatus, SourceCandidate } from './types.ts';

/**
 * Vault location. `SW2D_VAULT_DIR` overrides it - used by tests so they never
 * touch a developer's real vault, and resolved lazily so each test worker can
 * point at its own directory.
 */
export function vaultRoot(): string {
  return process.env['SW2D_VAULT_DIR'] || path.join(WORKBENCH_ROOT, '.sw2d-vault');
}
export const VAULT_ROOT = vaultRoot();
function packsDir(): string {
  return path.join(vaultRoot(), 'packs');
}
function indexPath(): string {
  return path.join(vaultRoot(), 'index.json');
}

const SHA_RE = /^[a-f0-9]{64}$/;

export interface VaultPackRecord {
  readonly sha256: string;
  readonly providerId: string;
  readonly packId: string;
  readonly title: string;
  readonly creator: string;
  readonly sourcePage: string;
  readonly acquisitionUrl: string;
  /** The licence/provenance snapshot taken when this pack was acquired. Never rewritten by a policy change. */
  readonly rights: RightsEvidence;
  readonly byteSize: number;
  /** Usable raster images the pack staged. */
  readonly fileCount: number;
  readonly acquiredAt: string;
  /** Last time the recorded rights were re-checked against the current policy. */
  readonly lastVerifiedAt: string;
}

interface VaultIndex {
  readonly version: 1;
  readonly packs: readonly VaultPackRecord[];
}

const EMPTY: VaultIndex = { version: 1, packs: [] };

function ensureDirs(): void {
  if (!existsSync(packsDir())) mkdirSync(packsDir(), { recursive: true });
}

function readIndex(): VaultIndex {
  return readJsonVersioned<VaultIndex>(indexPath(), 1, EMPTY);
}

function writeIndex(packs: readonly VaultPackRecord[]): void {
  ensureDirs();
  writeJsonAtomic(indexPath(), { version: 1, packs });
}

function bytesPathFor(sha256: string): string {
  if (!SHA_RE.test(sha256)) throw new Error(`Invalid vault sha256 ${JSON.stringify(sha256)}.`);
  return resolveContained(packsDir(), `${sha256}.zip`);
}

/** Current freshness of a stored record's rights, recomputed against today's policy. */
export function vaultFreshness(record: VaultPackRecord, now: number = Date.now()): RightsStatus {
  return evaluateRights(
    {
      license: record.rights.license,
      licenseName: record.rights.licenseName,
      evidenceUrl: record.rights.evidenceUrl,
      verifiedAt: record.lastVerifiedAt,
      attributionRequired: record.rights.attributionRequired,
      ...(record.rights.attributionText ? { attributionText: record.rights.attributionText } : {}),
    },
    now,
  ).status;
}

export interface VaultHit {
  readonly record: VaultPackRecord;
  readonly bytesPath: string;
}

/** A cached pack for this provider+id whose bytes are actually present, or null. */
export function vaultLookup(providerId: string, packId: string): VaultHit | null {
  const record = readIndex().packs.find((entry) => entry.providerId === providerId && entry.packId === packId);
  if (!record) return null;
  const bytesPath = bytesPathFor(record.sha256);
  if (!existsSync(bytesPath)) return null; // index without bytes - treat as a miss
  return { record, bytesPath };
}

export function readVaultBytes(sha256: string): Uint8Array {
  return new Uint8Array(readFileSync(bytesPathFor(sha256)));
}

export interface VaultStoreInput {
  readonly candidate: Pick<SourceCandidate, 'providerId' | 'packId' | 'title' | 'creator' | 'sourcePage' | 'acquisitionUrl' | 'rights'>;
  readonly sha256: string;
  readonly bytes: Uint8Array;
  readonly fileCount: number;
  readonly now?: number;
}

/** Stores a freshly acquired pack. Idempotent: re-storing the same bytes just refreshes the record. */
export function vaultStore(input: VaultStoreInput): VaultPackRecord {
  if (!SHA_RE.test(input.sha256)) throw new Error(`Invalid vault sha256 ${JSON.stringify(input.sha256)}.`);
  ensureDirs();
  const bytesPath = bytesPathFor(input.sha256);
  if (!existsSync(bytesPath)) writeFileSync(bytesPath, input.bytes);

  const acquiredIso = new Date(input.now ?? Date.now()).toISOString();
  const existing = readIndex().packs.find((entry) => entry.providerId === input.candidate.providerId && entry.packId === input.candidate.packId);
  const record: VaultPackRecord = {
    sha256: input.sha256,
    providerId: input.candidate.providerId,
    packId: input.candidate.packId,
    title: input.candidate.title,
    creator: input.candidate.creator,
    sourcePage: input.candidate.sourcePage,
    acquisitionUrl: input.candidate.acquisitionUrl,
    rights: input.candidate.rights,
    byteSize: input.bytes.byteLength,
    fileCount: input.fileCount,
    acquiredAt: existing?.acquiredAt ?? acquiredIso,
    // The verification date is the provider's authoritative review date carried
    // on the candidate, NOT "when I downloaded it". Freshness can only be
    // restored by an actual review that bumps that date, never by re-acquiring.
    lastVerifiedAt: input.candidate.rights.verifiedAt,
  };
  const others = readIndex().packs.filter((entry) => !(entry.providerId === record.providerId && entry.packId === record.packId));
  // If a previous record for this pack pointed at different bytes, drop the orphan.
  if (existing && existing.sha256 !== record.sha256 && !others.some((o) => o.sha256 === existing.sha256)) {
    rmSync(bytesPathFor(existing.sha256), { force: true });
  }
  writeIndex([...others, record]);
  return record;
}

export interface VaultEntryView extends VaultPackRecord {
  readonly freshness: RightsStatus;
  readonly bytesPresent: boolean;
}

export function listVault(now: number = Date.now()): readonly VaultEntryView[] {
  return readIndex()
    .packs.map((record) => ({ ...record, freshness: vaultFreshness(record, now), bytesPresent: existsSync(bytesPathFor(record.sha256)) }))
    .sort((a, b) => b.acquiredAt.localeCompare(a.acquiredAt));
}

export interface ReverifyOutcome {
  readonly entry: VaultEntryView;
  /**
   * 'catalogue-refreshed' - the current catalogue candidate carries a newer
   *   authoritative review date, so this entry is fresh again.
   * 'still-stale' - the catalogue's own verification is still stale; a human
   *   must re-check the provider's rights statement and bump the catalogue.
   * 'catalogue-changed' - the catalogue now lists a different licence for this
   *   pack; the entry reflects that.
   * 'pack-removed' - the catalogue no longer offers this pack.
   */
  readonly result: 'catalogue-refreshed' | 'still-stale' | 'catalogue-changed' | 'pack-removed';
  readonly detail: string;
}

/**
 * Genuine re-verification: re-derives this entry's rights from the *current
 * catalogue candidate*, whose `verifiedAt` is the date a human last reviewed
 * the provider's authoritative rights statement.
 *
 * It does NOT invent a fresh timestamp. If the catalogue's own verification is
 * still stale, the entry stays stale and the caller is told a real review is
 * required - honest blocking over fake confidence. If a review has since
 * happened (the catalogue's `CATALOG_VERIFIED_AT` was bumped in code), that
 * newer date flows through here and the entry becomes fresh. A licence change
 * or a pack removal in the catalogue is reflected too.
 */
export function reverifyVault(sha256: string, now: number = Date.now()): ReverifyOutcome {
  const packs = readIndex().packs;
  const record = packs.find((entry) => entry.sha256 === sha256);
  if (!record) throw new Error(`No vault pack ${sha256}.`);

  const candidate = findCandidate(record.providerId, record.packId, now);
  if (!candidate) {
    // Keep the acquisition snapshot for provenance, but the entry can no longer
    // be re-acquired and its rights can no longer be re-checked here.
    const view = { ...record, freshness: vaultFreshness(record, now), bytesPresent: existsSync(bytesPathFor(sha256)) };
    return {
      entry: view,
      result: 'pack-removed',
      detail: `The catalogue no longer offers "${record.title}". The stored acquisition snapshot is kept for provenance; it cannot be re-acquired.`,
    };
  }

  const licenceChanged = candidate.rights.license !== record.rights.license;
  const updated: VaultPackRecord = {
    ...record,
    rights: candidate.rights,
    // The provider's authoritative review date - never `now`.
    lastVerifiedAt: candidate.rights.verifiedAt,
  };
  writeIndex(packs.map((entry) => (entry.sha256 === sha256 ? updated : entry)));
  const view: VaultEntryView = {
    ...updated,
    freshness: candidate.rights.status,
    bytesPresent: existsSync(bytesPathFor(sha256)),
  };

  if (licenceChanged) {
    return { entry: view, result: 'catalogue-changed', detail: `Licence in the catalogue changed to ${candidate.rights.license} (${candidate.rights.status}).` };
  }
  if (candidate.rights.status === 'stale-verification') {
    return {
      entry: view,
      result: 'still-stale',
      detail: `The catalogue's own rights review for ${record.providerId} is stale (last done ${candidate.rights.verifiedAt}). A human must re-check ${record.sourcePage} / ${candidate.rights.evidenceUrl} and update the catalogue's verification date before this counts as fresh.`,
    };
  }
  return { entry: view, result: 'catalogue-refreshed', detail: `Re-derived from the current catalogue review (${candidate.rights.verifiedAt}); status ${candidate.rights.status}.` };
}

/**
 * Removes one vault entry and its bytes. This never touches a game: games hold
 * their own copies, so this only affects whether the next acquisition of this
 * pack re-downloads.
 */
export function removeFromVault(sha256: string): boolean {
  const packs = readIndex().packs;
  const record = packs.find((entry) => entry.sha256 === sha256);
  if (!record) return false;
  const remaining = packs.filter((entry) => entry.sha256 !== sha256);
  if (!remaining.some((entry) => entry.sha256 === sha256)) rmSync(bytesPathFor(sha256), { force: true });
  writeIndex(remaining);
  return true;
}

/** Test/maintenance helper: wipe the whole vault. */
export function clearVault(): void {
  rmSync(vaultRoot(), { recursive: true, force: true });
}

/** Bytes currently stored, for a size report. */
export function vaultByteTotal(): number {
  if (!existsSync(packsDir())) return 0;
  let total = 0;
  for (const name of readdirSync(packsDir())) {
    try {
      total += readFileSync(path.join(packsDir(), name)).byteLength;
    } catch {
      /* ignore */
    }
  }
  return total;
}
