/**
 * RELEASE_MANIFEST.json - the deterministic, nonvolatile fact sheet `pack`
 * writes into every release candidate (Phase 11 section 5). No timestamps,
 * random ids, or absolute machine paths - the same determinism bar the
 * generator itself holds, so packing the same source twice produces a
 * byte-identical manifest (and therefore an identical SHA256SUMS entry for
 * the manifest itself).
 */

export interface ReleaseManifestInput {
  readonly gameId: string;
  readonly presetId: string;
  readonly factoryVersion: string;
  readonly packagingMode: string;
  readonly fileInventory: readonly string[];
  readonly projectLicenseStatus: string;
  readonly resourceGovernance: {
    readonly manifestValid: boolean;
    readonly recordCount: number;
    readonly allApproved: boolean;
  };
}

export function buildReleaseManifest(input: ReleaseManifestInput): Record<string, unknown> {
  return {
    formatVersion: 1,
    gameId: input.gameId,
    presetId: input.presetId,
    factoryVersion: input.factoryVersion,
    packagingMode: input.packagingMode,
    fileInventory: [...input.fileInventory].sort(),
    projectLicenseStatus: input.projectLicenseStatus,
    resourceGovernance: input.resourceGovernance,
  };
}
