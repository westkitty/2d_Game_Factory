import { describe, expect, it } from 'vitest';
import type { ResourceManifest } from '@sw2d/contracts';
import { ResourceGovernanceError, SchemaValidationError, validateResourceManifest } from '../src/index.ts';

const POLICY = { acceptableLicenses: ['MIT', 'Apache-2.0', 'CC0-1.0'] };

function manifest(records: ResourceManifest['records']): ResourceManifest {
  return { manifestVersion: 1, updated: '2026-08-25', category: 'visual', records };
}

describe('validateResourceManifest', () => {
  it('accepts a well-formed, policy-compliant manifest', () => {
    const data = manifest([
      {
        id: 'placeholder-player',
        category: 'visual',
        sourceKind: 'project-owned',
        license: 'project-owned',
        attributionRequired: false,
        modificationStatus: 'generated',
        localPath: 'starter/content/themes/default/theme.json',
        status: 'approved',
      },
    ]);
    expect(validateResourceManifest('visual', data, POLICY)).toEqual(data);
  });

  it('rejects a manifest whose shape does not match resource-record.schema.json', () => {
    const malformed = { manifestVersion: 1, updated: '2026-08-25', category: 'visual', records: [{ id: 'x' }] };
    expect(() => validateResourceManifest('visual', malformed, POLICY)).toThrow(SchemaValidationError);
  });

  it('rejects duplicate resource ids', () => {
    const record = {
      id: 'dup',
      category: 'visual' as const,
      sourceKind: 'project-owned' as const,
      license: 'project-owned',
      attributionRequired: false,
      modificationStatus: 'generated' as const,
      localPath: 'a.json',
      status: 'approved' as const,
    };
    expect(() => validateResourceManifest('visual', manifest([record, record]), POLICY)).toThrow(ResourceGovernanceError);
  });

  it('rejects a third-party record with no originalSource', () => {
    const data = manifest([
      {
        id: 'missing-source',
        category: 'visual',
        sourceKind: 'third-party',
        license: 'MIT',
        attributionRequired: true,
        modificationStatus: 'unmodified',
        localPath: 'a.png',
        status: 'pending',
      },
    ]);
    expect(() => validateResourceManifest('visual', data, POLICY)).toThrow(/originalSource/);
  });

  it('rejects an approved third-party record whose license is not in the accepted list', () => {
    const data = manifest([
      {
        id: 'bad-license',
        category: 'visual',
        sourceKind: 'third-party',
        originalSource: 'https://example.invalid/asset',
        license: 'Proprietary',
        attributionRequired: true,
        modificationStatus: 'unmodified',
        localPath: 'a.png',
        status: 'approved',
      },
    ]);
    expect(() => validateResourceManifest('visual', data, POLICY)).toThrow(/acceptableLicenses/);
  });

  it('allows a pending third-party record with a license outside the accepted list (not yet approved)', () => {
    const data = manifest([
      {
        id: 'pending-review',
        category: 'visual',
        sourceKind: 'third-party',
        originalSource: 'https://example.invalid/asset',
        license: 'Proprietary',
        attributionRequired: true,
        modificationStatus: 'unmodified',
        localPath: 'a.png',
        status: 'pending',
      },
    ]);
    expect(() => validateResourceManifest('visual', data, POLICY)).not.toThrow();
  });

  it('rejects an approved record with an empty localPath', () => {
    const data = manifest([
      {
        id: 'no-path',
        category: 'visual',
        sourceKind: 'project-owned',
        license: 'project-owned',
        attributionRequired: false,
        modificationStatus: 'generated',
        localPath: '',
        status: 'approved',
      },
    ]);
    expect(() => validateResourceManifest('visual', data, POLICY)).toThrow(/localPath/);
  });
});
