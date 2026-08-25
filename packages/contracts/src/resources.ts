/**
 * Resource governance records.
 *
 * Mirrors resource-policy.json's per-category record shape
 * (MASTER_PROJECT.md section 20) as a typed, schema-validatable document
 * instead of policy that only exists in prose. A record describes one
 * resource's provenance; it does not itself grant approval - validation
 * against resource-policy.json's accepted licenses is what does that.
 */

export const RESOURCE_CATEGORIES = ['code', 'visual', 'audio', 'font'] as const;
export type ResourceCategory = (typeof RESOURCE_CATEGORIES)[number];

export const RESOURCE_SOURCE_KINDS = ['project-owned', 'third-party'] as const;
export type ResourceSourceKind = (typeof RESOURCE_SOURCE_KINDS)[number];

export const RESOURCE_STATUSES = ['approved', 'pending', 'rejected'] as const;
export type ResourceStatus = (typeof RESOURCE_STATUSES)[number];

export interface ResourceRecord {
  readonly id: string;
  readonly category: ResourceCategory;
  readonly sourceKind: ResourceSourceKind;
  /** Required for 'third-party'; omitted (project-owned/generated) records have none. */
  readonly originalSource?: string;
  /** SPDX-style identifier, or 'project-owned' for locally authored/generated content. */
  readonly license: string;
  readonly attributionRequired: boolean;
  readonly modificationStatus: 'unmodified' | 'modified' | 'generated';
  /** Path relative to the repository root. Every approved record must resolve to a real local file or a generator module. */
  readonly localPath: string;
  readonly status: ResourceStatus;
}

export interface ResourceManifest {
  readonly manifestVersion: number;
  readonly updated: string;
  readonly category: ResourceCategory;
  readonly records: readonly ResourceRecord[];
}
