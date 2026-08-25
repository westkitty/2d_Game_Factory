import type { ResourceManifest } from '@sw2d/contracts';
import { SchemaValidationError, schemaIdFor, validateDocument } from './validator.ts';

/**
 * Resource governance validation.
 *
 * Per-record shape is an ordinary JSON Schema (resource-record.schema.json).
 * The rules below are the ones JSON Schema cannot express by itself - the
 * same "cross-field rule" split validatePresetComposition already uses for
 * preset composition: duplicate ids across a manifest, a third-party record
 * missing its source, and an *approved* record whose license or local path
 * does not satisfy resource-policy.json. Translates MASTER_PROJECT.md
 * section 20/21 from prose into something `npm run validate` actually runs.
 */

/** The subset of resource-policy.json this validator needs. Callers pass their own parsed policy - this package never reaches outside its own directory for config. */
export interface ResourcePolicy {
  readonly acceptableLicenses: readonly string[];
}

export interface ResourceGovernanceIssue {
  readonly recordId: string | undefined;
  readonly message: string;
}

export class ResourceGovernanceError extends Error {
  readonly manifestId: string;
  readonly issues: readonly ResourceGovernanceIssue[];

  constructor(manifestId: string, issues: readonly ResourceGovernanceIssue[]) {
    super(
      `${manifestId} failed resource governance:\n` +
        issues.map((issue) => `  - ${issue.recordId ?? '(manifest)'}: ${issue.message}`).join('\n'),
    );
    this.name = 'ResourceGovernanceError';
    this.manifestId = manifestId;
    this.issues = issues;
  }
}

/**
 * Validate one resource manifest's shape (Ajv) and its policy rules
 * (hand-written). Throws SchemaValidationError for a shape problem,
 * ResourceGovernanceError for a policy violation. Unverified provenance
 * means the resource does not enter production - resource-policy.json is the
 * authority this function enforces, not a suggestion.
 */
export function validateResourceManifest(manifestId: string, data: unknown, policy: ResourcePolicy): ResourceManifest {
  const shape = validateDocument<ResourceManifest>('resource-manifest', manifestId, data);
  if (!shape.valid) {
    throw new SchemaValidationError(manifestId, schemaIdFor('resource-manifest'), shape.errors);
  }
  const manifest = shape.value as ResourceManifest;

  const issues: ResourceGovernanceIssue[] = [];
  const seenIds = new Set<string>();

  for (const record of manifest.records) {
    if (seenIds.has(record.id)) {
      issues.push({ recordId: record.id, message: `duplicate resource id "${record.id}"` });
    }
    seenIds.add(record.id);

    if (record.sourceKind === 'third-party' && !record.originalSource) {
      issues.push({ recordId: record.id, message: 'third-party resource is missing originalSource' });
    }

    if (record.status === 'approved') {
      if (record.sourceKind === 'third-party' && !policy.acceptableLicenses.includes(record.license)) {
        issues.push({
          recordId: record.id,
          message: `license "${record.license}" is not in resource-policy.json's acceptableLicenses`,
        });
      }
      if (record.localPath.trim().length === 0) {
        issues.push({ recordId: record.id, message: 'approved resource has an empty localPath' });
      }
    }
  }

  if (issues.length > 0) {
    throw new ResourceGovernanceError(manifestId, issues);
  }
  return manifest;
}
