import { describe, expect, it } from 'vitest';
import { validateResourceManifest } from '@sw2d/schemas';
import { generateResourceManifest } from '../src/generator/contentDocuments.ts';

const POLICY = { acceptableLicenses: ['MIT', 'Apache-2.0', 'BSD-2-Clause', 'BSD-3-Clause', 'ISC', 'CC0-1.0', 'CC-BY-4.0'] };

describe('generateResourceManifest', () => {
  it('produces a manifest that passes real schema + governance validation', () => {
    const manifest = generateResourceManifest('my-game');
    expect(() => validateResourceManifest('my-game/resources/RESOURCE_MANIFEST.json', manifest, POLICY)).not.toThrow();
  });

  it('every record is project-owned, generated, and approved (honest placeholder provenance)', () => {
    const manifest = generateResourceManifest('my-game') as { records: Array<Record<string, unknown>> };
    expect(manifest.records.length).toBeGreaterThan(0);
    for (const record of manifest.records) {
      expect(record.sourceKind).toBe('project-owned');
      expect(record.modificationStatus).toBe('generated');
      expect(record.status).toBe('approved');
    }
  });

  it('is deterministic: no timestamps, same gameId produces byte-identical output', () => {
    const first = JSON.stringify(generateResourceManifest('my-game'));
    const second = JSON.stringify(generateResourceManifest('my-game'));
    expect(second).toBe(first);
    expect(first).not.toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it('record ids are namespaced by gameId so two games never collide', () => {
    const a = generateResourceManifest('game-alpha') as { records: Array<{ id: string }> };
    const b = generateResourceManifest('game-beta') as { records: Array<{ id: string }> };
    const aIds = new Set(a.records.map((r) => r.id));
    for (const record of b.records) expect(aIds.has(record.id)).toBe(false);
  });
});
