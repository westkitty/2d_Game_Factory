/**
 * Located, readable errors for Tiled ingestion. Every error names the map id
 * and, where relevant, the exact layer/object/property at fault - the same
 * error-quality bar @sw2d/schemas holds for JSON Schema validation
 * (MASTER_PROJECT.md section 35: "malformed level -> identify object/class/property").
 */

export class UnsupportedTiledFeatureError extends Error {
  constructor(mapId: string, feature: string) {
    super(`Tiled map "${mapId}" uses an unsupported feature: ${feature}.`);
    this.name = 'UnsupportedTiledFeatureError';
  }
}

export class UnknownTiledObjectClassError extends Error {
  constructor(mapId: string, objectId: number, className: string, known: readonly string[]) {
    super(
      `Tiled map "${mapId}" object ${objectId} has unknown class "${className}". ` +
        `Known semantic object classes: ${known.join(', ')}.`,
    );
    this.name = 'UnknownTiledObjectClassError';
  }
}

export class TiledObjectPropertyError extends Error {
  constructor(mapId: string, objectId: number, className: string, message: string) {
    super(`Tiled map "${mapId}" object ${objectId} (${className}): ${message}.`);
    this.name = 'TiledObjectPropertyError';
  }
}

export class TiledMapStructureError extends Error {
  constructor(mapId: string, message: string) {
    super(`Tiled map "${mapId}" is malformed: ${message}.`);
    this.name = 'TiledMapStructureError';
  }
}
