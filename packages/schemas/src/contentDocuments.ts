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
  items: { schemaName: 'item-catalog' },
  weapons: { schemaName: 'weapon-catalog' },
  encounters: { schemaName: 'encounter-catalog' },
  puzzles: { schemaName: 'puzzle-rules' },
  generation: { schemaName: 'generation' },
  'world-graph': { schemaName: 'world-graph' },
  vehicles: { schemaName: 'vehicle-catalog' },
  races: { schemaName: 'race-catalog' },
  perception: { schemaName: 'perception-catalog' },
  climbing: { schemaName: 'climbing-config' },
  runs: { schemaName: 'runs' },
  'strategy-actions': { schemaName: 'strategy-actions' },
  players: { schemaName: 'player-roster' },
  'ball-paddle': { schemaName: 'ball-paddle' },
};

export type ContentDocumentName = keyof typeof CONTENT_DOCUMENTS;

/**
 * Document names under this prefix validate against 'level-document' without
 * an entry per level id. Levels are ordinary game content (content/levels/**
 * in the protected-boundary table) - authoring a new one must not require
 * editing this package.
 */
const LEVEL_DOCUMENT_PREFIX = 'levels/';

function schemaNameFor(documentName: string): SchemaName | undefined {
  if (documentName.startsWith(LEVEL_DOCUMENT_PREFIX)) return 'level-document';
  return CONTENT_DOCUMENTS[documentName]?.schemaName;
}

export class UnknownContentDocumentError extends Error {
  constructor(documentName: string, known: readonly string[]) {
    super(
      `Content document "${documentName}" has no registered schema. ` +
        `Known content documents: ${known.length > 0 ? known.join(', ') : '(none)'}, ` +
        `or a name starting with "${LEVEL_DOCUMENT_PREFIX}".`,
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
    const schemaName = schemaNameFor(documentName);
    if (!schemaName) {
      throw new UnknownContentDocumentError(documentName, Object.keys(CONTENT_DOCUMENTS));
    }
    const validation = validateDocument(schemaName, documentName, raw);
    if (!validation.valid) {
      throw new SchemaValidationError(documentName, schemaIdFor(schemaName), validation.errors);
    }
    result[documentName] = {
      schemaId: schemaIdFor(schemaName),
      valid: true,
      value: validation.value,
    };
  }
  return result;
}
