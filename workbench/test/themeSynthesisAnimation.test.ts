import { describe, expect, it } from 'vitest';
import type { AssetRecord, AssetsDocument, BlueprintDocument, Provenance } from '../shared/types.ts';
import { buildTheme } from '../server/themeSynthesis.ts';

const OWNED: Provenance = { kind: 'project-owned', modificationStatus: 'unmodified' };

function frame(
  id: string,
  frameIndex: number,
  group = 'walk',
  provenance: Provenance = OWNED,
  width = 32,
  height = 32,
): AssetRecord {
  return {
    id,
    kind: 'source',
    displayName: `${id}.png`,
    relativePath: `.sw2d/source-assets/${id}.png`,
    mime: 'image/png',
    width,
    height,
    byteSize: 128,
    sha256: id.padEnd(64, '0').slice(0, 64),
    roleAssignments: [],
    provenance,
    group,
    frameIndex,
  };
}

function blueprint(playerAssetId: string): BlueprintDocument {
  return {
    version: 1,
    roleAssignments: [{ role: 'player', assetId: playerAssetId, coverage: 'assigned' }],
    palette: ['#65d0a8', '#e05fa0'],
  };
}

describe('frame-group theme synthesis', () => {
  it('turns the assigned asset group into one deterministic player animation', () => {
    const assets: AssetsDocument = {
      version: 1,
      assets: [frame('src_c', 3), frame('src_a', 1), frame('src_b', 2)],
    };

    const result = buildTheme({ gameId: 'animated-game', assets, blueprint: blueprint('src_b') });
    const animation = result.theme.animations?.find((candidate) => candidate.role === 'player');

    expect(animation).toBeDefined();
    expect(animation!.frameRate).toBe(8);
    expect(animation!.repeat).toBe(-1);
    expect(animation!.frames.map((item) => item.url)).toEqual([
      'assets/workbench/src_a.png',
      'assets/workbench/src_b.png',
      'assets/workbench/src_c.png',
    ]);
    expect(new Set(animation!.frames.map((item) => item.key)).size).toBe(3);
    expect(result.copiedFiles).toEqual(['src_a.png', 'src_b.png', 'src_c.png']);

    const staticPlayer = result.theme.assets.find((descriptor) => descriptor.role === 'player');
    expect(staticPlayer?.spec.kind).toBe('image');
    expect(staticPlayer?.key).toContain('src_b'.padEnd(64, '0').slice(0, 12));
  });

  it('leaves an ungrouped or one-frame role static', () => {
    const assets: AssetsDocument = { version: 1, assets: [frame('src_only', 1, 'solo')] };
    const result = buildTheme({ gameId: 'static-game', assets, blueprint: blueprint('src_only') });
    expect(result.theme.animations).toBeUndefined();
  });

  it('keeps a name-group static when any shippable frame changes dimensions', () => {
    const assets: AssetsDocument = {
      version: 1,
      assets: [frame('src_a', 1), frame('src_b', 2, 'walk', OWNED, 64, 32), frame('src_c', 3)],
    };
    const result = buildTheme({ gameId: 'mixed-size-game', assets, blueprint: blueprint('src_a') });
    expect(result.theme.animations).toBeUndefined();
    expect(result.copiedFiles).toEqual(['src_a.png']);
  });

  it('never ships a reference-only sibling merely because it shares the group', () => {
    const referenceOnly: Provenance = { kind: 'reference-only', modificationStatus: 'unmodified' };
    const assets: AssetsDocument = {
      version: 1,
      assets: [frame('src_a', 1), frame('src_ref', 2, 'walk', referenceOnly), frame('src_c', 3)],
    };
    const result = buildTheme({ gameId: 'safe-animation', assets, blueprint: blueprint('src_a') });
    const animation = result.theme.animations?.[0];
    expect(animation?.frames).toHaveLength(2);
    expect(animation?.frames.some((item) => item.url.includes('src_ref'))).toBe(false);
    expect(result.skippedReferenceOnly).toContain('src_ref.png');
  });
});
