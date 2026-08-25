import type { ContentDocumentEnvelope } from '@sw2d/contracts';
import { SchemaValidationError, schemaIdFor, validateDocument, type SchemaName } from './validator.ts';

/**
 * The content-document registry.
 *
 * Closes the ContentBundle.data hole with a small explicit map from document
 * name to schema, not a universal plugin DSL. Adding a new document type is
 * adding one entry here plus one schema file - nothing speculative for
 * documents no preset produces yet.
 */

/** The one content document Phase 2 needs to prove the boundary: tuning.json. */
export interface TuningDocument {
  readonly schemaVersion: number;
  readonly player: {
    readonly moveSpeed: number;
    readonly jumpVelocity: number;
    readonly gravity: number;
  };
}

interface ContentDocumentRegistryEntry {
  readonly schemaName: SchemaName;
}

export const CONTENT_DOCUMENTS: Readonly<Record<string, ContentDocumentRegistryEntry>> = {
  tuning: { schemaName: 'tuning' },
};

export type ContentDocumentName = keyof typeof CONTENT_DOCUMENTS;

export class UnknownContentDocumentError extends Error {
  constructor(documentName: string, known: readonly string[]) {
    super(
      `Content document "${documentName}" has no registered schema. ` +
        `Known content documents: ${known.length > 0 ? known.join(', ') : '(none)'}.`,
    );
    this.name = 'UnknownContentDocumentError';
  }
}

/**
 * Validate every entry of a raw content-data map and return the typed
 * envelopes a ContentBundle carries. Throws on the first unknown document
 * name or schema failure - a ContentSource must not hand the runtime content
 * it cannot vouch for.
 */
export function validateContentBundleData(
  data: Readonly<Record<string, unknown>>,
): Readonly<Record<string, ContentDocumentEnvelope>> {
  const result: Record<string, ContentDocumentEnvelope> = {};
  for (const [documentName, raw] of Object.entries(data)) {
    const entry = CONTENT_DOCUMENTS[documentName];
    if (!entry) {
      throw new UnknownContentDocumentError(documentName, Object.keys(CONTENT_DOCUMENTS));
    }
    const validation = validateDocument(entry.schemaName, documentName, raw);
    if (!validation.valid) {
      throw new SchemaValidationError(documentName, schemaIdFor(entry.schemaName), validation.errors);
    }
    result[documentName] = {
      schemaId: schemaIdFor(entry.schemaName),
      valid: true,
      value: validation.value,
    };
  }
  return result;
}
