/**
 * Phase D: coherent reskin proposal + acquisition wiring for the audition.
 *
 * `proposeReskin` is pure and gets direct coverage; the acquisition path is
 * exercised with the same offline zip-fetch stub as the Phase B suite.
 */

import { readFileSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import { proposeReskin, type StagedFileLite } from '../server/sources/reskin.ts';
import { acquirePack } from '../server/sources/acquire.ts';
import { CATALOG_VERIFIED_AT } from '../server/sources/catalog.ts';
import { gameRoot } from '../server/paths.ts';
import type { WorkbenchAssetRole } from '../shared/types.ts';

import { mkdtempSync, rmSync as _rmSyncVault } from 'node:fs';
import { tmpdir } from 'node:os';
import { join as _joinVault } from 'node:path';
import { beforeAll as _beforeAllVault, afterAll as _afterAllVault } from 'vitest';
const _VAULT_DIR = mkdtempSync(_joinVault(tmpdir(), 'sw2d-vault-aud-'));
_beforeAllVault(() => { process.env.SW2D_VAULT_DIR = _VAULT_DIR; });
_afterAllVault(() => { delete process.env.SW2D_VAULT_DIR; _rmSyncVault(_VAULT_DIR, { recursive: true, force: true }); });

const AT = Date.parse(`${CATALOG_VERIFIED_AT}T12:00:00Z`);
const PNG = new Uint8Array(readFileSync(fileURLToPath(new URL('../fixtures/frames/hero_idle_0.png', import.meta.url))));

function file(stagingId: string, name: string, roles: readonly WorkbenchAssetRole[], analysis?: Partial<StagedFileLite['analysis']>): StagedFileLite {
  return {
    stagingId,
    displayName: name,
    suggestedRoles: roles,
    analysis: { width: 16, height: 16, hasAlpha: true, aspectRatio: 1, ...analysis },
  };
}

describe('proposeReskin (one representative sprite per role)', () => {
  it('assigns each requested role its named candidate and reuses none', () => {
    const files = [
      file('a', 'character_0.png', ['player']),
      file('b', 'background_0.png', ['background'], { hasAlpha: false, width: 320, aspectRatio: 1.8 }),
      file('c', 'tile_0.png', ['tile']),
      file('d', 'tile_1.png', ['tile']),
    ];
    const proposal = proposeReskin(['player', 'background', 'tile'], files);
    expect(proposal.assignments.map((a) => [a.role, a.stagingId])).toEqual([
      ['player', 'a'],
      ['background', 'b'],
      ['tile', 'c'],
    ]);
    expect(proposal.fallbackRoles).toEqual([]);
    const used = proposal.assignments.map((a) => a.stagingId);
    expect(new Set(used).size).toBe(used.length);
  });

  it('reports a role with no candidate as a generated-fallback role', () => {
    const proposal = proposeReskin(['player', 'exit'], [file('a', 'hero.png', ['player'])]);
    expect(proposal.assignments.map((a) => a.role)).toEqual(['player']);
    expect(proposal.fallbackRoles).toEqual(['exit']);
  });

  it('falls back to a shape guess when no filename mentioned the role', () => {
    const files = [file('bg', 'img_0000.png', [], { hasAlpha: false, width: 400, aspectRatio: 2 })];
    const proposal = proposeReskin(['background'], files);
    expect(proposal.assignments).toHaveLength(1);
    expect(proposal.assignments[0]!.basis).toBe('shape');
  });

  it('is order-stable for the same inputs', () => {
    const files = [file('a', 'player.png', ['player']), file('b', 'coin.png', ['pickup'])];
    const roles: WorkbenchAssetRole[] = ['player', 'pickup'];
    expect(proposeReskin(roles, files)).toEqual(proposeReskin(roles, files));
  });
});

describe('acquire with a reskin proposal', () => {
  const GAME = 'test-ffs-reskin';
  afterAll(() => rmSync(gameRoot(GAME), { recursive: true, force: true }));

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
    let cursor = 0;
    for (const c of chunks) {
      out.set(c, cursor);
      cursor += c.length;
    }
    return out;
  }

  it('returns a reskin proposal mapping platformer roles onto the pack', async () => {
    const zip = makeStoredZip([
      { name: 'pack/character_0000.png', bytes: PNG },
      { name: 'pack/platform_0000.png', bytes: PNG },
      { name: 'pack/background_0000.png', bytes: PNG },
      { name: 'pack/coin_0000.png', bytes: PNG },
      { name: 'pack/spike_0000.png', bytes: PNG },
    ]);
    const { reskinProposal } = await acquirePack({
      gameId: GAME,
      providerId: 'kenney',
      packId: 'pixel-platformer',
      now: AT,
      reskinForPresetId: 'chase-platformer',
      net: {
        fetchImpl: (async () => new Response(new Uint8Array(zip), { status: 200, headers: { 'content-type': 'application/zip' } })) as unknown as typeof fetch,
        lookupImpl: async () => [{ address: '203.0.113.10' }],
      },
    });
    expect(reskinProposal).toBeDefined();
    const roles = reskinProposal!.assignments.map((a) => a.role);
    expect(roles).toContain('player');
    expect(roles).toContain('platform');
    expect(roles).toContain('background');
    // Every assignment points at a distinct staged file.
    const ids = reskinProposal!.assignments.map((a) => a.stagingId);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
