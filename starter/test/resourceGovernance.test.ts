import { describe, expect, it } from 'vitest';
import { validateResourceManifest, type ResourcePolicy } from '@sw2d/schemas';
import resourcePolicy from '../../resource-policy.json';
import visualAssetManifest from '../../docs/resources/VISUAL_ASSET_MANIFEST.json';

/**
 * Proves the resource governance pipeline is executable against the real
 * repository files, not just synthetic fixtures - MASTER_PROJECT.md
 * section 11's "make the resource pipeline executable/validatable rather
 * than documentary only".
 */
describe('docs/resources/VISUAL_ASSET_MANIFEST.json', () => {
  const policy: ResourcePolicy = { acceptableLicenses: resourcePolicy.defaults.acceptableLicenses };

  it('validates against resource-record.schema.json and resource-policy.json', () => {
    expect(() => validateResourceManifest('VISUAL_ASSET_MANIFEST', visualAssetManifest, policy)).not.toThrow();
  });

  it('every record is project-owned - no third-party visual asset exists yet', () => {
    for (const record of visualAssetManifest.records) {
      expect(record.sourceKind, record.id).toBe('project-owned');
    }
  });
});
