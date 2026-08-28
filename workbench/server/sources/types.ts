/**
 * Normalized vocabulary for authoring-time free-sprite sourcing.
 *
 * A `SourceCandidate` is one coherent pack a provider can offer. It is
 * deliberately provider-agnostic: the rest of the workflow (requirement
 * matching, audition, coherent reskin, the local vault) never learns which
 * site a pack came from beyond its `providerId` and its recorded provenance.
 *
 * Rights are data, never inference. `license` is an SPDX id compared against
 * `resource-policy.json`; `verification` records the outcome of that check and
 * how fresh the evidence is. "free" is never treated as "licensed".
 */

import type { WorkbenchAssetRole } from '../../shared/types.ts';

/** Outcome of comparing a candidate's recorded licence against `resource-policy.json`. */
export type RightsStatus =
  | 'verified' // acceptable licence, evidence recorded, no attribution obligation outstanding
  | 'attribution-required' // acceptable licence but the pack must be credited when it ships
  | 'stale-verification' // was verified, but the recorded evidence is older than the freshness window
  | 'unsupported-license' // licence is not on the policy's accepted list
  | 'unknown'; // no usable licence evidence at all

export interface RightsEvidence {
  /** SPDX identifier, e.g. `CC0-1.0`, `CC-BY-4.0`. */
  readonly license: string;
  /** Human licence name for display. */
  readonly licenseName: string;
  /** URL of the page/statement the licence claim is taken from. */
  readonly evidenceUrl: string;
  readonly attributionRequired: boolean;
  /** Credit line to reproduce when attribution is required. */
  readonly attributionText?: string;
  /** ISO date the licence evidence was recorded/last checked. */
  readonly verifiedAt: string;
  readonly status: RightsStatus;
}

export type CameraPerspective = 'top-down' | 'side' | 'isometric' | 'mixed';

/** Nominal tile/frame size a pack is authored at, when the provider states one. */
export interface NominalTileSize {
  readonly width: number;
  readonly height: number;
}

export interface SourceCandidate {
  readonly providerId: string;
  readonly packId: string;
  readonly title: string;
  readonly creator: string;
  /** Human-facing page describing the pack. */
  readonly sourcePage: string;
  /**
   * The exact URL bytes are fetched from. Never taken from a request; always a
   * provider-owned constant. Present so the UI can show provenance, not so a
   * caller can substitute it.
   */
  readonly acquisitionUrl: string;
  readonly rights: RightsEvidence;
  /** Raster formats the pack ships. `svg` is recorded but never used as a sprite source. */
  readonly rasterFormats: readonly ('png' | 'jpeg' | 'webp')[];
  readonly containsSvgAlongsidePng: boolean;
  readonly tags: readonly string[];
  readonly camera?: CameraPerspective;
  readonly tileSize?: NominalTileSize;
  readonly pixelArt: boolean;
  readonly hasAnimationFrames: boolean;
  readonly fileCount?: number;
  readonly downloadBytesEstimate?: number;
  /**
   * Provider's own hint of how strongly each semantic role is covered, 0..1.
   * Advisory input to Phase C matching; never authoritative on its own.
   */
  readonly roleHints: Partial<Record<WorkbenchAssetRole, number>>;
}

/** What the home/workspace surface shows before a provider is queried in depth. */
export interface SourceProviderInfo {
  readonly id: string;
  readonly title: string;
  readonly homepage: string;
  readonly licenseSummary: string;
  /** Whether the provider's allowlisted host is reachable right now. */
  readonly online: boolean;
  readonly candidateCount: number;
}

/** Result of acquiring a pack into a project's staging area, ready for the canonical import plan. */
export interface AcquisitionResult {
  readonly providerId: string;
  readonly packId: string;
  readonly batchId: string;
  readonly staged: number;
  readonly ignored: number;
  /** True when every usable image in the archive was SVG - the pack is unsuitable for this workflow. */
  readonly svgOnly: boolean;
  readonly sha256: string;
  readonly byteSize: number;
  /** The provenance record the canonical import commit should carry for this pack. */
  readonly provenance: {
    readonly kind: 'third-party-known';
    readonly originalSource: string;
    readonly license: string;
    readonly attributionRequired: boolean;
    readonly modificationStatus: 'unmodified';
  };
}
