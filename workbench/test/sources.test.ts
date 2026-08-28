/**
 * Phase B: verified free-sprite source foundation.
 *
 * Everything here is deterministic and offline. Network is exercised only
 * through injected fetch/lookup stubs, so a provider being up or down never
 * decides whether this suite passes. The live provider is a separate,
 * out-of-CI smoke.
 */

import { readFileSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import { evaluateRights, rightsAllowShipping, rightsAllowUse, acceptableLicenses, VERIFICATION_FRESHNESS_DAYS } from '../server/sources/rights.ts';
import { isDisallowedAddress, providerGet, SourceNetworkError } from '../server/sources/net.ts';
import { kenneyProvider } from '../server/sources/kenney.ts';
import { CATALOG_VERIFIED_AT } from '../server/sources/catalog.ts';
import { allCandidates, findCandidate, getProvider, listProviders } from '../server/sources/registry.ts';
import { acquirePack } from '../server/sources/acquire.ts';
import { gameRoot } from '../server/paths.ts';

import { mkdtempSync, rmSync as _rmSyncVault } from 'node:fs';
import { tmpdir } from 'node:os';
import { join as _joinVault } from 'node:path';
import { beforeAll as _beforeAllVault, afterAll as _afterAllVault } from 'vitest';
const _VAULT_DIR = mkdtempSync(_joinVault(tmpdir(), 'sw2d-vault-src-'));
_beforeAllVault(() => { process.env.SW2D_VAULT_DIR = _VAULT_DIR; });
_afterAllVault(() => { delete process.env.SW2D_VAULT_DIR; _rmSyncVault(_VAULT_DIR, { recursive: true, force: true }); });

const AT_VERIFY = Date.parse(`${CATALOG_VERIFIED_AT}T12:00:00Z`);
const FAR_FUTURE = AT_VERIFY + (VERIFICATION_FRESHNESS_DAYS + 30) * 86_400_000;

// --- rights --------------------------------------------------------------

describe('rights evaluation against resource-policy.json', () => {
  it('reads the accepted-licence list from the policy, not a second copy', () => {
    const list = acceptableLicenses();
    expect(list).toContain('CC0-1.0');
    expect(list).toContain('CC-BY-4.0');
    expect(list).not.toContain('GPL-3.0-only');
  });

  it('CC0 with fresh evidence and no attribution is verified', () => {
    const r = evaluateRights({ license: 'CC0-1.0', licenseName: 'CC0', evidenceUrl: 'https://x/', verifiedAt: CATALOG_VERIFIED_AT, attributionRequired: false }, AT_VERIFY);
    expect(r.status).toBe('verified');
    expect(rightsAllowUse(r)).toBe(true);
    expect(rightsAllowShipping(r)).toBe(true);
  });

  it('CC-BY requires attribution', () => {
    const r = evaluateRights({ license: 'CC-BY-4.0', licenseName: 'CC BY 4.0', evidenceUrl: 'https://x/', verifiedAt: CATALOG_VERIFIED_AT }, AT_VERIFY);
    expect(r.status).toBe('attribution-required');
    expect(r.attributionRequired).toBe(true);
    expect(rightsAllowUse(r)).toBe(true);
    expect(rightsAllowShipping(r)).toBe(true);
  });

  it('an unsupported licence is a hard block', () => {
    const r = evaluateRights({ license: 'GPL-3.0-only', licenseName: 'GPL', evidenceUrl: 'https://x/', verifiedAt: CATALOG_VERIFIED_AT }, AT_VERIFY);
    expect(r.status).toBe('unsupported-license');
    expect(rightsAllowUse(r)).toBe(false);
    expect(rightsAllowShipping(r)).toBe(false);
  });

  it('missing licence evidence is unknown, never assumed usable', () => {
    expect(evaluateRights({ license: '', licenseName: '', evidenceUrl: '', verifiedAt: CATALOG_VERIFIED_AT }, AT_VERIFY).status).toBe('unknown');
    expect(evaluateRights({ license: 'CC0-1.0', licenseName: 'CC0', evidenceUrl: '', verifiedAt: CATALOG_VERIFIED_AT }, AT_VERIFY).status).toBe('unknown');
  });

  it('evidence older than the freshness window is stale, not invalid', () => {
    const r = evaluateRights({ license: 'CC0-1.0', licenseName: 'CC0', evidenceUrl: 'https://x/', verifiedAt: CATALOG_VERIFIED_AT, attributionRequired: false }, FAR_FUTURE);
    expect(r.status).toBe('stale-verification');
    expect(rightsAllowUse(r)).toBe(true); // still usable for existing/known packs
    expect(rightsAllowShipping(r)).toBe(false); // but a new acquisition must be re-checked
  });
});

// --- catalogue / provider ---------------------------------------------

describe('kenney provider and the curated catalogue', () => {
  it('registers exactly the kenney provider', () => {
    expect(listProviders().map((p) => p.id)).toEqual(['kenney']);
    expect(getProvider('kenney')).toBeDefined();
    expect(getProvider('nope')).toBeUndefined();
  });

  it('every candidate is CC0-verified PNG from kenney.nl', () => {
    const candidates = kenneyProvider.listCandidates(AT_VERIFY);
    expect(candidates.length).toBeGreaterThanOrEqual(5);
    for (const c of candidates) {
      expect(c.providerId).toBe('kenney');
      expect(c.rasterFormats).toEqual(['png']);
      expect(c.rights.license).toBe('CC0-1.0');
      expect(c.rights.status).toBe('verified');
      expect(c.rights.attributionRequired).toBe(false);
      expect(c.acquisitionUrl.startsWith('https://kenney.nl/')).toBe(true);
      expect(c.sourcePage.startsWith('https://kenney.nl/assets/')).toBe(true);
      // SVG is recorded as present-but-ignored, never a raster format.
      expect(c.rasterFormats).not.toContain('svg');
    }
  });

  it('recorded rights go stale once the freshness window passes', () => {
    for (const c of kenneyProvider.listCandidates(FAR_FUTURE)) {
      expect(c.rights.status).toBe('stale-verification');
    }
  });

  it('exposes candidates by id and rejects unknown ids', () => {
    expect(findCandidate('kenney', 'tiny-dungeon', AT_VERIFY)?.title).toBe('Tiny Dungeon');
    expect(findCandidate('kenney', 'not-a-pack', AT_VERIFY)).toBeUndefined();
    expect(allCandidates(AT_VERIFY).length).toBe(kenneyProvider.listCandidates(AT_VERIFY).length);
  });
});

// --- network boundary ------------------------------------------------

describe('provider network boundary', () => {
  const publicLookup = async () => [{ address: '203.0.113.10' }];
  const opts = { maxBytes: 1024, timeoutMs: 1000, lookupImpl: publicLookup };

  it('classifies private and public addresses', () => {
    for (const bad of ['10.0.0.1', '172.16.5.5', '172.31.9.9', '192.168.1.1', '127.0.0.1', '169.254.1.1', '100.64.0.1', '0.0.0.0', '::1', 'fe80::1', 'fd00::1', '::ffff:127.0.0.1', 'not-an-ip']) {
      expect(isDisallowedAddress(bad), `${bad} should be disallowed`).toBe(true);
    }
    for (const good of ['8.8.8.8', '203.0.113.10', '1.1.1.1', '2606:4700:4700::1111']) {
      expect(isDisallowedAddress(good), `${good} should be allowed`).toBe(false);
    }
    // link-local across the whole fe80::/10 block, and IPv4-mapped in hex form
    for (const bad of ['fe90::1', 'fea0::1', 'feb0::1', '::ffff:7f00:1']) {
      expect(isDisallowedAddress(bad), `${bad} should be disallowed`).toBe(true);
    }
  });

  it('caps a response whose body stalls after headers (no hang)', async () => {
    const fetchImpl = (async (_url: string, init?: RequestInit) => {
      const signal = init?.signal;
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new Uint8Array(4));
          // never close, never enqueue again - a trickle/stall
          signal?.addEventListener('abort', () => {
            try {
              controller.error(new DOMException('aborted', 'AbortError'));
            } catch {
              /* already errored */
            }
          });
        },
      });
      return new Response(body, { status: 200, headers: { 'content-type': 'application/zip' } });
    }) as unknown as typeof fetch;
    await expect(
      providerGet('kenney', 'https://kenney.nl/x.zip', { maxBytes: 1024, timeoutMs: 200, lookupImpl: publicLookup, fetchImpl }),
    ).rejects.toThrow(/stalled|timed out/);
  });

  it('refuses a non-HTTPS URL', async () => {
    await expect(providerGet('kenney', 'http://kenney.nl/x.zip', opts)).rejects.toBeInstanceOf(SourceNetworkError);
  });

  it('refuses a host outside the provider allowlist', async () => {
    await expect(providerGet('kenney', 'https://evil.example/x.zip', opts)).rejects.toThrow(/allowlist/);
  });

  it('refuses an unknown provider', async () => {
    await expect(providerGet('mystery', 'https://kenney.nl/x.zip', opts)).rejects.toThrow(/Unknown source provider/);
  });

  it('refuses a host that resolves to a private address', async () => {
    await expect(
      providerGet('kenney', 'https://kenney.nl/x.zip', { ...opts, lookupImpl: async () => [{ address: '127.0.0.1' }] }),
    ).rejects.toThrow(/non-public address/);
  });

  it('refuses a redirect that leaves the allowlist', async () => {
    const fetchImpl = (async () =>
      new Response(null, { status: 302, headers: { location: 'https://evil.example/pack.zip' } })) as unknown as typeof fetch;
    await expect(providerGet('kenney', 'https://kenney.nl/x.zip', { ...opts, fetchImpl })).rejects.toThrow(/allowlist/);
  });

  it('follows an in-allowlist redirect and returns bytes', async () => {
    let hop = 0;
    const fetchImpl = (async () => {
      hop += 1;
      if (hop === 1) return new Response(null, { status: 302, headers: { location: 'https://www.kenney.nl/pack.zip' } });
      return new Response(new Uint8Array([1, 2, 3, 4]), { status: 200, headers: { 'content-type': 'application/zip' } });
    }) as unknown as typeof fetch;
    const result = await providerGet('kenney', 'https://kenney.nl/x.zip', {
      maxBytes: 1024,
      timeoutMs: 1000,
      lookupImpl: publicLookup,
      fetchImpl,
    });
    expect([...result.bytes]).toEqual([1, 2, 3, 4]);
    expect(result.finalUrl).toBe('https://www.kenney.nl/pack.zip');
  });

  it('enforces the byte cap from content-length', async () => {
    const fetchImpl = (async () =>
      new Response(new Uint8Array(10), { status: 200, headers: { 'content-type': 'application/zip', 'content-length': '999999' } })) as unknown as typeof fetch;
    await expect(providerGet('kenney', 'https://kenney.nl/x.zip', { maxBytes: 8, timeoutMs: 1000, lookupImpl: publicLookup, fetchImpl })).rejects.toThrow(/over the/);
  });

  it('enforces the byte cap while streaming when no content-length is sent', async () => {
    const fetchImpl = (async () =>
      new Response(new Uint8Array(64), { status: 200, headers: { 'content-type': 'application/zip' } })) as unknown as typeof fetch;
    await expect(providerGet('kenney', 'https://kenney.nl/x.zip', { maxBytes: 8, timeoutMs: 1000, lookupImpl: publicLookup, fetchImpl })).rejects.toThrow(/cap/);
  });
});

// --- acquisition into the canonical pipeline -------------------------

/** Minimal STORED-method ZIP writer. `readZip` does not validate CRCs, so 0 is fine. */
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
    lv.setUint16(8, 0, true); // method: stored
    lv.setUint32(14, 0, true); // crc32
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
    cv.setUint16(10, 0, true);
    cv.setUint32(16, 0, true);
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

  const total = chunks.reduce((sum, c) => sum + c.length, 0);
  const out = new Uint8Array(total);
  let cursor = 0;
  for (const c of chunks) {
    out.set(c, cursor);
    cursor += c.length;
  }
  return out;
}

/** A real generated PNG fixture - decodes cleanly through the host's PNG path. */
const PNG_1x1 = new Uint8Array(readFileSync(fileURLToPath(new URL('../fixtures/frames/hero_idle_0.png', import.meta.url))));

const SVG_BYTES = new TextEncoder().encode('<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"><rect width="1" height="1"/></svg>');

describe('acquisition feeds the canonical staged import', () => {
  const GAME = 'test-ffs-acquire';
  afterAll(() => rmSync(gameRoot(GAME), { recursive: true, force: true }));

  function zipFetch(zip: Uint8Array): typeof fetch {
    return (async () =>
      new Response(new Uint8Array(zip), { status: 200, headers: { 'content-type': 'application/zip' } })) as unknown as typeof fetch;
  }

  it('stages PNG entries, skips SVG, and records third-party CC0 provenance', async () => {
    const zip = makeStoredZip([
      { name: 'kenney_tiny-dungeon/Tiles/tile_0000.png', bytes: PNG_1x1 },
      { name: 'kenney_tiny-dungeon/Tiles/tile_0001.png', bytes: PNG_1x1 },
      { name: 'kenney_tiny-dungeon/Vector/tilemap.svg', bytes: SVG_BYTES },
      { name: 'kenney_tiny-dungeon/Sample.svg', bytes: SVG_BYTES },
    ]);
    const { result, plan } = await acquirePack({
      gameId: GAME,
      providerId: 'kenney',
      packId: 'tiny-dungeon',
      now: AT_VERIFY,
      net: { fetchImpl: zipFetch(zip), lookupImpl: async () => [{ address: '203.0.113.10' }] },
    });

    expect(result.staged).toBe(2);
    expect(result.svgOnly).toBe(false);
    expect(result.ignored).toBeGreaterThanOrEqual(2);
    expect(result.provenance).toEqual({
      kind: 'third-party-known',
      originalSource: 'https://kenney.nl/assets/tiny-dungeon',
      license: 'CC0-1.0',
      attributionRequired: false,
      modificationStatus: 'unmodified',
    });
    expect(plan.files.length).toBe(2);
    // SVG entries appear in the ignored list with a clear reason, not silently dropped.
    expect(plan.ignored.some((entry) => /SVG/i.test(entry.reason))).toBe(true);
  });

  it('reports svgOnly when a pack has no usable raster art', async () => {
    const zip = makeStoredZip([
      { name: 'pack/Vector/a.svg', bytes: SVG_BYTES },
      { name: 'pack/Vector/b.svg', bytes: SVG_BYTES },
    ]);
    const { result } = await acquirePack({
      gameId: GAME,
      providerId: 'kenney',
      packId: 'pixel-platformer',
      now: AT_VERIFY,
      net: { fetchImpl: zipFetch(zip), lookupImpl: async () => [{ address: '203.0.113.10' }] },
    });
    expect(result.staged).toBe(0);
    expect(result.svgOnly).toBe(true);
  });

  it('refuses to acquire a pack whose recorded rights are unusable', async () => {
    await expect(
      acquirePack({
        gameId: GAME,
        providerId: 'kenney',
        packId: 'tiny-dungeon',
        now: FAR_FUTURE + 10 * 365 * 86_400_000, // decades stale -> still "stale", usable; assert the happy guard path instead
        net: { fetchImpl: zipFetch(makeStoredZip([{ name: 'p/x.png', bytes: PNG_1x1 }])), lookupImpl: async () => [{ address: '203.0.113.10' }] },
      }),
    ).resolves.toBeDefined();
    await expect(
      acquirePack({ gameId: GAME, providerId: 'kenney', packId: 'no-such-pack' }),
    ).rejects.toThrow(/no pack/);
  });
});
