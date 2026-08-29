import Ajv, { type ErrorObject, type ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';

import actionBindingsSchema from '../schemas/action-bindings.schema.json' with { type: 'json' };
import systemPackSelectionSchema from '../schemas/system-pack-selection.schema.json' with { type: 'json' };
import gameDefinitionSchema from '../schemas/game-definition.schema.json' with { type: 'json' };
import presetDefinitionSchema from '../schemas/preset-definition.schema.json' with { type: 'json' };
import gameSettingsSchema from '../schemas/game-settings.schema.json' with { type: 'json' };
import tuningSchema from '../schemas/tuning.schema.json' with { type: 'json' };
import assetDescriptorSchema from '../schemas/asset-descriptor.schema.json' with { type: 'json' };
import uiCopySchema from '../schemas/ui-copy.schema.json' with { type: 'json' };
import contentAssetsSchema from '../schemas/content-assets.schema.json' with { type: 'json' };
import themeManifestSchema from '../schemas/theme-manifest.schema.json' with { type: 'json' };
import resourceRecordSchema from '../schemas/resource-record.schema.json' with { type: 'json' };
import resourceManifestSchema from '../schemas/resource-manifest.schema.json' with { type: 'json' };
import levelDocumentSchema from '../schemas/level-document.schema.json' with { type: 'json' };
import itemCatalogSchema from '../schemas/item-catalog.schema.json' with { type: 'json' };
import weaponCatalogSchema from '../schemas/weapon-catalog.schema.json' with { type: 'json' };
import encounterCatalogSchema from '../schemas/encounter-catalog.schema.json' with { type: 'json' };
import puzzleRulesSchema from '../schemas/puzzle-rules.schema.json' with { type: 'json' };
import generationSchema from '../schemas/generation.schema.json' with { type: 'json' };
import worldGraphSchema from '../schemas/world-graph.schema.json' with { type: 'json' };
import vehicleCatalogSchema from '../schemas/vehicle-catalog.schema.json' with { type: 'json' };
import raceCatalogSchema from '../schemas/race-catalog.schema.json' with { type: 'json' };
import perceptionCatalogSchema from '../schemas/perception-catalog.schema.json' with { type: 'json' };
import climbingConfigSchema from '../schemas/climbing-config.schema.json' with { type: 'json' };
import runsSchema from '../schemas/runs.schema.json' with { type: 'json' };
import strategyActionsSchema from '../schemas/strategy-actions.schema.json' with { type: 'json' };

/**
 * Ajv-based validation for every schema this package owns.
 *
 * One Ajv instance for the whole package: schemas that $ref each other (e.g.
 * GameDefinition -> ActionBindings) must share a registry, and compiling twice
 * per process would silently double memory and hide "same schema id added
 * twice" mistakes that are cheap to catch here.
 */

export type SchemaName =
  | 'action-bindings'
  | 'system-pack-selection'
  | 'game-definition'
  | 'preset-definition'
  | 'game-settings'
  | 'tuning'
  | 'asset-descriptor'
  | 'ui-copy'
  | 'content-assets'
  | 'theme-manifest'
  | 'resource-record'
  | 'resource-manifest'
  | 'level-document'
  | 'item-catalog'
  | 'weapon-catalog'
  | 'encounter-catalog'
  | 'puzzle-rules'
  | 'generation'
  | 'world-graph'
  | 'vehicle-catalog'
  | 'race-catalog'
  | 'perception-catalog'
  | 'climbing-config'
  | 'runs'
  | 'strategy-actions';

export const SCHEMA_NAMES: readonly SchemaName[] = [
  'action-bindings',
  'system-pack-selection',
  'game-definition',
  'preset-definition',
  'game-settings',
  'tuning',
  'asset-descriptor',
  'ui-copy',
  'content-assets',
  'theme-manifest',
  'resource-record',
  'resource-manifest',
  'level-document',
  'item-catalog',
  'weapon-catalog',
  'encounter-catalog',
  'puzzle-rules',
  'generation',
  'world-graph',
  'vehicle-catalog',
  'race-catalog',
  'perception-catalog',
  'climbing-config',
  'runs',
  'strategy-actions',
];

/** One located problem: which document, where in it, and what is wrong. */
export interface ValidationIssue {
  readonly documentId: string;
  readonly instancePath: string;
  readonly message: string;
}

export interface ValidationResult<T = unknown> {
  readonly valid: boolean;
  readonly errors: readonly ValidationIssue[];
  readonly value: T | undefined;
}

export interface SchemaDocument {
  readonly $id: string;
  readonly [key: string]: unknown;
}

const ajv = new Ajv({ allErrors: true, strict: true });
addFormats(ajv);

const SCHEMA_DOCUMENTS: Readonly<Record<SchemaName, SchemaDocument>> = {
  'action-bindings': actionBindingsSchema,
  'system-pack-selection': systemPackSelectionSchema,
  'game-definition': gameDefinitionSchema,
  'preset-definition': presetDefinitionSchema,
  'game-settings': gameSettingsSchema,
  tuning: tuningSchema,
  'asset-descriptor': assetDescriptorSchema,
  'ui-copy': uiCopySchema,
  'content-assets': contentAssetsSchema,
  'theme-manifest': themeManifestSchema,
  'resource-record': resourceRecordSchema,
  'resource-manifest': resourceManifestSchema,
  'level-document': levelDocumentSchema,
  'item-catalog': itemCatalogSchema,
  'weapon-catalog': weaponCatalogSchema,
  'encounter-catalog': encounterCatalogSchema,
  'puzzle-rules': puzzleRulesSchema,
  generation: generationSchema,
  'world-graph': worldGraphSchema,
  'vehicle-catalog': vehicleCatalogSchema,
  'race-catalog': raceCatalogSchema,
  'perception-catalog': perceptionCatalogSchema,
  'climbing-config': climbingConfigSchema,
  runs: runsSchema,
  'strategy-actions': strategyActionsSchema,
};

// Registration order matters: a schema must be added before anything that
// $refs it by $id is compiled. Leaf schemas first, composites after.
for (const name of ['action-bindings', 'system-pack-selection', 'asset-descriptor', 'ui-copy', 'resource-record'] as const) {
  const schema = SCHEMA_DOCUMENTS[name];
  ajv.addSchema(schema, schema.$id);
}
for (const name of [
  'game-definition',
  'preset-definition',
  'game-settings',
  'tuning',
  'content-assets',
  'theme-manifest',
  'resource-manifest',
  'level-document',
  'item-catalog',
  'weapon-catalog',
  'encounter-catalog',
  'puzzle-rules',
  'generation',
  'world-graph',
  'vehicle-catalog',
  'race-catalog',
  'perception-catalog',
  'climbing-config',
  'runs',
  'strategy-actions',
] as const) {
  const schema = SCHEMA_DOCUMENTS[name];
  ajv.addSchema(schema, schema.$id);
}

const VALIDATORS: Readonly<Record<SchemaName, ValidateFunction>> = Object.fromEntries(
  SCHEMA_NAMES.map((name) => {
    const schema = SCHEMA_DOCUMENTS[name];
    const validate = ajv.getSchema(schema.$id);
    if (!validate) {
      throw new Error(`Schema "${name}" (${schema.$id}) failed to register with Ajv.`);
    }
    return [name, validate];
  }),
) as Record<SchemaName, ValidateFunction>;

export function schemaIdFor(name: SchemaName): string {
  return SCHEMA_DOCUMENTS[name].$id;
}

export function schemaDocumentFor(name: SchemaName): SchemaDocument {
  return SCHEMA_DOCUMENTS[name];
}

function toIssue(documentId: string, error: ErrorObject): ValidationIssue {
  const instancePath = error.instancePath.length > 0 ? error.instancePath : '/';
  return { documentId, instancePath, message: error.message ?? 'is invalid' };
}

/**
 * Validate `data` against a named schema. Never throws - callers that want
 * fail-fast behaviour should use `validateDocumentOrThrow`.
 *
 * Error quality bar: `/player/jumpVelocity must be number`, not
 * "invalid configuration". `instancePath` and `message` are kept separate so
 * callers can format them however a CLI, a test assertion or a UI needs.
 */
export function validateDocument<T = unknown>(
  schemaName: SchemaName,
  documentId: string,
  data: unknown,
): ValidationResult<T> {
  const validate = VALIDATORS[schemaName];
  const valid = validate(data);
  if (valid) {
    return { valid: true, errors: [], value: data as T };
  }
  const errors = (validate.errors ?? []).map((error) => toIssue(documentId, error));
  return { valid: false, errors, value: undefined };
}

export function formatIssue(issue: ValidationIssue): string {
  return `${issue.documentId}: ${issue.instancePath} ${issue.message}`;
}

/** Thrown by `validateDocumentOrThrow`. Carries the same located detail as ValidationIssue. */
export class SchemaValidationError extends Error {
  readonly documentId: string;
  readonly schemaId: string;
  readonly issues: readonly ValidationIssue[];

  constructor(documentId: string, schemaId: string, issues: readonly ValidationIssue[]) {
    super(
      `${documentId} failed schema validation against ${schemaId}:\n` +
        issues.map((issue) => `  - ${issue.instancePath} ${issue.message}`).join('\n'),
    );
    this.name = 'SchemaValidationError';
    this.documentId = documentId;
    this.schemaId = schemaId;
    this.issues = issues;
  }
}

/** Validate and reject malformed content immediately, with a located error. */
export function validateDocumentOrThrow<T = unknown>(
  schemaName: SchemaName,
  documentId: string,
  data: unknown,
): T {
  const result = validateDocument<T>(schemaName, documentId, data);
  if (!result.valid) {
    throw new SchemaValidationError(documentId, schemaIdFor(schemaName), result.errors);
  }
  return result.value as T;
}

export class UnregisteredSchemaError extends Error {
  constructor(schemaId: string) {
    super(`No schema is registered for id "${schemaId}". Call registerSchema() before validating against it.`);
    this.name = 'UnregisteredSchemaError';
  }
}

/**
 * Register an additional JSON Schema (identified by its own `$id`) into the
 * shared Ajv instance, for later validation by raw schema id via
 * `validateBySchemaId`.
 *
 * For packages that own schemas this one does not - e.g. `@sw2d/packs`' pack
 * config schemas - without each standing up a second Ajv instance. Idempotent:
 * registering the same `$id` twice (e.g. a module re-evaluated across test
 * files) is a no-op rather than an Ajv duplicate-schema error.
 */
export function registerSchema(schema: SchemaDocument): void {
  if (ajv.getSchema(schema.$id)) return;
  ajv.addSchema(schema, schema.$id);
}

/** Like `validateDocument`, but by a raw schema id rather than one of this package's fixed `SchemaName`s. */
export function validateBySchemaId<T = unknown>(
  schemaId: string,
  documentId: string,
  data: unknown,
): ValidationResult<T> {
  const validate = ajv.getSchema(schemaId);
  if (!validate) throw new UnregisteredSchemaError(schemaId);
  const valid = validate(data);
  if (valid) return { valid: true, errors: [], value: data as T };
  const errors = (validate.errors ?? []).map((error) => toIssue(documentId, error));
  return { valid: false, errors, value: undefined };
}

/** Like `validateDocumentOrThrow`, but by a raw schema id. */
export function validateBySchemaIdOrThrow<T = unknown>(schemaId: string, documentId: string, data: unknown): T {
  const result = validateBySchemaId<T>(schemaId, documentId, data);
  if (!result.valid) {
    throw new SchemaValidationError(documentId, schemaId, result.errors);
  }
  return result.value as T;
}
