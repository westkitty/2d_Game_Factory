import type {
  NormalizedLevel,
  NormalizedLevelObject,
  NormalizedSolid,
  NormalizedTileLayerSummary,
  TiledPropertyValue,
} from '@sw2d/contracts';
import { TiledMapStructureError, UnknownTiledObjectClassError, UnsupportedTiledFeatureError } from './errors.ts';
import { OBJECT_CLASS_CATALOG, OBJECT_CLASS_IDS, validateObjectProperties } from './objectClasses.ts';

/**
 * Tiled JSON -> NormalizedLevel.
 *
 * Supported subset (see docs/architecture/adr/0014-content-pipeline-and-entity-registry.md
 * for the full list): orthogonal, finite maps; `tilelayer` (recorded as
 * dimensions/metadata only - Phase 6 does not render tile-image layers, see
 * the ADR) and `objectgroup` layers; objects with a numeric id, an x/y/width/
 * height rectangle, a `class` (or legacy `type`) naming a catalog class, and
 * string/number/boolean custom properties.
 *
 * Rejected explicitly, with a named error rather than a silent skip or a
 * garbled result: any other orientation, infinite maps, any layer type other
 * than the two above (group layers, image layers, chunked/infinite tile
 * data).
 */

export interface NormalizeTiledMapOptions {
  /**
   * true (default): an object whose class is not in the catalog throws
   * UnknownTiledObjectClassError. false: it is skipped with a console
   * warning instead - MASTER_PROJECT.md section 35's "fail or warn according
   * to configured strictness".
   */
  readonly strict?: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requirePositiveNumber(mapId: string, record: Record<string, unknown>, key: string): number {
  const value = record[key];
  if (typeof value !== 'number' || !(value > 0)) {
    throw new TiledMapStructureError(mapId, `"${key}" must be a positive number`);
  }
  return value;
}

function requireNumber(mapId: string, objectId: number, record: Record<string, unknown>, key: string): number {
  const value = record[key];
  if (typeof value !== 'number') {
    throw new TiledMapStructureError(mapId, `object ${objectId} is missing numeric "${key}"`);
  }
  return value;
}

function optionalNumber(record: Record<string, unknown>, key: string, fallback: number): number {
  const value = record[key];
  return typeof value === 'number' ? value : fallback;
}

function normalizeProperties(
  mapId: string,
  objectId: number,
  raw: unknown,
): Readonly<Record<string, TiledPropertyValue>> {
  if (raw === undefined) return {};
  if (!Array.isArray(raw)) {
    throw new TiledMapStructureError(mapId, `object ${objectId} "properties" must be an array`);
  }
  const result: Record<string, TiledPropertyValue> = {};
  for (const entry of raw) {
    if (!isRecord(entry) || typeof entry.name !== 'string') {
      throw new TiledMapStructureError(mapId, `object ${objectId} has a malformed property entry`);
    }
    const value = entry.value;
    if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') {
      throw new TiledMapStructureError(mapId, `object ${objectId} property "${entry.name}" has an unsupported value type`);
    }
    result[entry.name] = value;
  }
  return result;
}

function normalizeObject(mapId: string, raw: unknown, strict: boolean): NormalizedLevelObject | undefined {
  if (!isRecord(raw)) throw new TiledMapStructureError(mapId, 'each object must be a JSON object');

  const id = raw.id;
  if (typeof id !== 'number') throw new TiledMapStructureError(mapId, 'an object is missing a numeric "id"');

  const className =
    typeof raw.class === 'string' && raw.class.length > 0
      ? raw.class
      : typeof raw.type === 'string' && raw.type.length > 0
        ? raw.type
        : undefined;
  if (!className) throw new TiledMapStructureError(mapId, `object ${id} has no "class" or "type"`);

  const definition = OBJECT_CLASS_CATALOG.get(className);
  if (!definition) {
    if (!strict) {
      console.warn(
        `[sw2d] content-pipeline: map "${mapId}" object ${id} has unknown class "${className}" - skipped (non-strict mode)`,
      );
      return undefined;
    }
    throw new UnknownTiledObjectClassError(mapId, id, className, OBJECT_CLASS_IDS);
  }

  const x = requireNumber(mapId, id, raw, 'x');
  const y = requireNumber(mapId, id, raw, 'y');
  // Tiled point-tool objects (PlayerSpawn, Checkpoint, ...) legitimately omit width/height.
  const width = optionalNumber(raw, 'width', 0);
  const height = optionalNumber(raw, 'height', 0);
  const name = typeof raw.name === 'string' ? raw.name : '';

  const properties = normalizeProperties(mapId, id, raw.properties);
  validateObjectProperties(mapId, id, definition, properties);

  return { id, class: className, name, x, y, width, height, properties };
}

export function normalizeTiledMap(mapId: string, raw: unknown, options: NormalizeTiledMapOptions = {}): NormalizedLevel {
  const strict = options.strict ?? true;
  if (!isRecord(raw)) throw new TiledMapStructureError(mapId, 'must be a JSON object');

  if (raw.orientation !== 'orthogonal') {
    throw new UnsupportedTiledFeatureError(mapId, `orientation "${String(raw.orientation)}" (only "orthogonal" is supported)`);
  }
  if (raw.infinite === true) {
    throw new UnsupportedTiledFeatureError(mapId, 'infinite maps (chunked tile data)');
  }

  const mapWidth = requirePositiveNumber(mapId, raw, 'width');
  const mapHeight = requirePositiveNumber(mapId, raw, 'height');
  const tileWidth = requirePositiveNumber(mapId, raw, 'tilewidth');
  const tileHeight = requirePositiveNumber(mapId, raw, 'tileheight');

  if (!Array.isArray(raw.layers)) throw new TiledMapStructureError(mapId, '"layers" must be an array');

  const tileLayers: NormalizedTileLayerSummary[] = [];
  const solids: NormalizedSolid[] = [];
  const objects: NormalizedLevelObject[] = [];

  for (const rawLayer of raw.layers) {
    if (!isRecord(rawLayer)) throw new TiledMapStructureError(mapId, 'each layer must be a JSON object');
    const layerName = typeof rawLayer.name === 'string' ? rawLayer.name : '(unnamed)';

    if (rawLayer.type === 'tilelayer') {
      const widthInTiles = requirePositiveNumber(mapId, rawLayer, 'width');
      const heightInTiles = requirePositiveNumber(mapId, rawLayer, 'height');
      tileLayers.push({ name: layerName, widthInTiles, heightInTiles });
      continue;
    }

    if (rawLayer.type === 'objectgroup') {
      const rawObjects = rawLayer.objects;
      if (!Array.isArray(rawObjects)) {
        throw new TiledMapStructureError(mapId, `object layer "${layerName}" is missing "objects"`);
      }
      for (const rawObject of rawObjects) {
        const normalized = normalizeObject(mapId, rawObject, strict);
        if (!normalized) continue;
        if (normalized.class === 'Solid') {
          solids.push({ x: normalized.x, y: normalized.y, width: normalized.width, height: normalized.height });
        } else {
          objects.push(normalized);
        }
      }
      continue;
    }

    throw new UnsupportedTiledFeatureError(
      mapId,
      `layer "${layerName}" has type "${String(rawLayer.type)}" (only "tilelayer" and "objectgroup" are supported - ` +
        'group and image layers are not)',
    );
  }

  return {
    schemaVersion: 1,
    id: mapId,
    mapWidth,
    mapHeight,
    tileWidth,
    tileHeight,
    tileLayers,
    solids,
    objects,
  };
}
