/**
 * @sw2d/content-pipeline - Tiled JSON ingestion/normalization, the semantic
 * object-class catalog, and theme resolution.
 *
 * Renderer-independent: no Phaser, no Ajv. Structural/semantic Tiled
 * validation and cross-field theme resolution live here by hand, the same
 * "JSON Schema cannot express this cleanly" reasoning @sw2d/schemas already
 * uses for validatePresetComposition. The *output* of normalizeTiledMap is
 * itself schema-validated by @sw2d/schemas (level-document.schema.json) at
 * the content boundary - this package does the transform, schemas does the
 * gate.
 */

export {
  TiledMapStructureError,
  TiledObjectPropertyError,
  UnknownTiledObjectClassError,
  UnsupportedTiledFeatureError,
} from './tiled/errors.ts';

export {
  OBJECT_CLASS_CATALOG,
  OBJECT_CLASS_IDS,
  validateObjectProperties,
  type ObjectClassDefinition,
  type PropertySpec,
  type PropertyType,
} from './tiled/objectClasses.ts';

export { normalizeTiledMap, type NormalizeTiledMapOptions } from './tiled/normalize.ts';

export type { TiledLayer, TiledMap, TiledObject, TiledObjectGroupLayer, TiledProperty, TiledTileLayer } from './tiled/types.ts';

export { resolveTheme, type ResolvedTheme } from './theme/resolveTheme.ts';
