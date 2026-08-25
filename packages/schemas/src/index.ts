/**
 * @sw2d/schemas - JSON Schema definitions, Ajv validation and the
 * content-document registry for the SW2D game factory.
 *
 * Renderer-independent: no Phaser, no DOM. The CLI (Phase 8) and this package
 * itself must be able to validate content in plain Node.
 */
export {
  SCHEMA_NAMES,
  formatIssue,
  registerSchema,
  schemaDocumentFor,
  schemaIdFor,
  validateBySchemaId,
  validateBySchemaIdOrThrow,
  validateDocument,
  validateDocumentOrThrow,
  SchemaValidationError,
  UnregisteredSchemaError,
  type SchemaDocument,
  type SchemaName,
  type ValidationIssue,
  type ValidationResult,
} from './validator.ts';

export { packConfigValidator } from './packConfigValidator.ts';

export {
  CONTENT_DOCUMENTS,
  UnknownContentDocumentError,
  validateContentBundleData,
  type ContentDocumentName,
  type TuningDocument,
} from './contentDocuments.ts';

export {
  checkSystemPackSelections,
  validatePresetComposition,
  type PackSelectionCheckIssue,
} from './presetComposition.ts';

export {
  ResourceGovernanceError,
  validateResourceManifest,
  type ResourcePolicy,
  type ResourceGovernanceIssue,
} from './resourceGovernance.ts';
