/**
 * Phase F: verified local asset vault.
 *
 * Offline. The vault is authoring infrastructure - these lock the two
 * guarantees that matter: acquisition re-uses a cached pack without touching
 * the network, and freshness is represented without ever becoming silent
 * invalidity.
 */

import { readFileSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  clearVault,
  listVault,
  removeFromVault,
  reverifyVault,
  vaultLookup,
  vaultStore,
} from '../server/sources/vault.ts';
import { acquirePack } from '../server/sources/acquire.ts';
import { kenneyProvider } from '../server/sources/kenney.ts';
import { CATALOG_VERIFIED_AT } from '../server/sources/catalog.ts';
import { VERIFICATION_FRESHNESS_DAYS } from '../server/sources/rights.ts';
import { gameRoot } from '../server/paths.ts';

import { mkdtempSync, rmSync as _rmSyncVault } from 'node:fs';
import { tmpdir } from 'node:os';
import { join as _joinVault } from 'node:path';
import { beforeAll as _beforeAllVault, afterAll as _afterAllVault } from 'vitest';
const _VAULT_DIR = mkdtempSync(_joinVault(tmpdir(), 'sw2d-vault-vlt-'));
_beforeAllVault(() => { process.env.SW2D_VAULT_DIR = _VAULT_DIR; });
_afterAllVault(() => { delete process.env.SW2D_VAULT_DIR; _rmSyncVault(_VAULT_DIR, { recursive: true, force: true }); });

const AT = Date.parse(`${CATALOG_VERIFIED_AT}T12:00:00Z`);
const STALE = AT + (VERIFICATION_FRESHNESS_DAYS + 30) * 86_400_000;
const PNG = new Uint8Array(readFileSync(fileURLToPath(new URL('../fixtures/frames/hero_idle_0.png', import.meta.url))));

function candidate(now = AT) {
  return kenneyProvider.getCandidate('tiny-dungeon', now)!;
}

function makeStoredZip(entries: readonly { name: string; bytes: Uint8Array }[]): Uint8Array {
  const enc = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const entry of entries) {
    const nameBytes = enc.encode(entry.name);
    const lfh = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(lfh.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint32(18, entry.bytes.length, true);
    lv.setUint32(22, entry.bytes.length, true);
    lv.setUint16(26, nameBytes.length, true);
    lfh.set(nameBytes, 30);
    chunks.push(lfh, entry.bytes);
    const cdh = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(cdh.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint32(20, entry.bytes.length, true);
    cv.setUint32(24, entry.bytes.length, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint32(42, offset, true);
    cdh.set(nameBytes, 46);
    central.push(cdh);
    offset += lfh.length + entry.bytes.length;
  }
  const cdStart = offset;
  let cdSize = 0;
  for (const c of central) {
    chunks.push(c);
    cdSize += c.length;
  }
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, entries.length, true);
  ev.setUint16(10, entries.length, true);
  ev.setUint32(12, cdSize, true);
  ev.setUint32(16, cdStart, true);
  chunks.push(eocd);
  const total = chunks.reduce((s, c) => s + c.length, 0);
  const out = new Uint8Array(total);
  let cur = 0;
  for (const c of chunks) {
    out.set(c, cur);
    cur += c.length;
  }
  return out;
}

const ZIP = makeStoredZip([
  { name: 'pack/tile_0000.png', bytes: PNG },
  { name: 'pack/tile_0001.png', bytes: PNG },
]);
const publicLookup = async () => [{ address: '203.0.113.10' }];
const zipFetch = (async () => new Response(new Uint8Array(ZIP), { status: 200, headers: { 'content-type': 'application/zip' } })) as unknown as typeof fetch;

beforeEach(() => clearVault());
afterEach(() => clearVault());

describe('vault store / lookup / dedup', () => {
  it('stores bytes and an index record, and finds them again', () => {
    const record = vaultStore({ candidate: candidate(), sha256: 'a'.repeat(64), bytes: ZIP, fileCount: 2, now: AT });
    expect(record.providerId).toBe('kenney');
    expect(record.rights.status).toBe('verified');
    const hit = vaultLookup('kenney', 'tiny-dungeon');
    expect(hit).not.toBeNull();
    expect(readFileSync(hit!.bytesPath).byteLength).toBe(ZIP.byteLength);
  });

  it('keeps one record per provider+pack and drops orphaned bytes on re-store', () => {
    vaultStore({ candidate: candidate(), sha256: 'a'.repeat(64), bytes: ZIP, fileCount: 2, now: AT });
    vaultStore({ candidate: candidate(), sha256: 'b'.repeat(64), bytes: ZIP, fileCount: 2, now: AT });
    const list = listVault(AT);
    expect(list.filter((e) => e.packId === 'tiny-dungeon')).toHaveLength(1);
    expect(list[0]!.sha256).toBe('b'.repeat(64));
  });
});

describe('vault freshness', () => {
  it('is verified when fresh and stale-verification when the window has passed', () => {
    vaultStore({ candidate: candidate(), sha256: 'a'.repeat(64), bytes: ZIP, fileCount: 2, now: AT });
    expect(listVault(AT)[0]!.freshness).toBe('verified');
    expect(listVault(STALE)[0]!.freshness).toBe('stale-verification');
  });

  it('stores the provider review date, not the download time, as lastVerifiedAt', () => {
    // now = AT + 5 days, but the catalogue review date is CATALOG_VERIFIED_AT.
    vaultStore({ candidate: candidate(), sha256: 'a'.repeat(64), bytes: ZIP, fileCount: 2, now: AT + 5 * 86_400_000 });
    const entry = listVault(AT)[0]!;
    expect(entry.lastVerifiedAt).toBe(candidate().rights.verifiedAt);
    expect(Date.parse(entry.acquiredAt)).toBe(AT + 5 * 86_400_000);
  });

  it('re-verify never manufactures freshness: a stale catalogue review stays stale', () => {
    vaultStore({ candidate: candidate(), sha256: 'a'.repeat(64), bytes: ZIP, fileCount: 2, now: AT });
    expect(listVault(STALE)[0]!.freshness).toBe('stale-verification');
    const outcome = reverifyVault('a'.repeat(64), STALE);
    expect(outcome.result).toBe('still-stale');
    expect(outcome.entry.freshness).toBe('stale-verification');
    // The stored verification date is the catalogue review date - NOT "now".
    expect(outcome.entry.lastVerifiedAt).not.toBe(new Date(STALE).toISOString());
    expect(outcome.entry.lastVerifiedAt).toBe(candidate(STALE).rights.verifiedAt);
    // And it is still stale on the next list, i.e. nothing was silently refreshed.
    expect(listVault(STALE)[0]!.freshness).toBe('stale-verification');
  });

  it('re-verify reports the entry fresh when the catalogue review is genuinely current', () => {
    vaultStore({ candidate: candidate(), sha256: 'a'.repeat(64), bytes: ZIP, fileCount: 2, now: AT });
    const outcome = reverifyVault('a'.repeat(64), AT);
    expect(outcome.result).toBe('catalogue-refreshed');
    expect(outcome.entry.freshness).toBe('verified');
  });
});

describe('remove does not touch games', () => {
  it('deletes the cached bytes and record only', () => {
    vaultStore({ candidate: candidate(), sha256: 'a'.repeat(64), bytes: ZIP, fileCount: 2, now: AT });
    expect(removeFromVault('a'.repeat(64))).toBe(true);
    expect(listVault(AT)).toHaveLength(0);
    expect(vaultLookup('kenney', 'tiny-dungeon')).toBeNull();
    expect(removeFromVault('a'.repeat(64))).toBe(false);
  });
});

describe('acquisition re-uses the vault offline', () => {
  const GAME = 'test-vault-acquire';
  afterEach(() => rmSync(gameRoot(GAME), { recursive: true, force: true }));

  it('downloads once, then serves the same pack from the vault with the network down', async () => {
    const first = await acquirePack({
      gameId: GAME,
      providerId: 'kenney',
      packId: 'tiny-dungeon',
      now: AT,
      net: { fetchImpl: zipFetch, lookupImpl: publicLookup },
    });
    expect(first.result.fromVault).toBe(false);
    expect(listVault(AT)).toHaveLength(1);

    const failingFetch = (async () => {
      throw new Error('network is down');
    }) as unknown as typeof fetch;

    const second = await acquirePack({
      gameId: GAME,
      providerId: 'kenney',
      packId: 'tiny-dungeon',
      now: AT,
      net: { fetchImpl: failingFetch, lookupImpl: publicLookup },
    });
    expect(second.result.fromVault).toBe(true);
    expect(second.result.staged).toBe(first.result.staged);
    expect(second.result.sha256).toBe(first.result.sha256);
  });
});
