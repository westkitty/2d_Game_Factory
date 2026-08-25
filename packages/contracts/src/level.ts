/**
 * Normalized level data - the shape a Tiled JSON export is transformed into
 * before anything in the runtime or a game touches it.
 *
 * Contracts owns this shape for the same reason it owns AssetDescriptor and
 * ContentBundle: `@sw2d/content-pipeline` produces values of this type from
 * raw Tiled JSON, `@sw2d/schemas` validates the produced JSON against a
 * mirrored schema, and `@sw2d/packs`' entity registry consumes
 * NormalizedLevelObject - three packages that must agree on one shape
 * without any of them depending on the other two's implementation.
 *
 * This is deliberately not "a Tiled JSON type". Tiled's own JSON format (GIDs,
 * per-layer chunking, tileset firstgid arithmetic) is an authoring-tool detail
 * that stops at the content-pipeline boundary; nothing past that boundary
 * should need to know Tiled exists.
 */

/** A property value read off a Tiled object. Tiled's own property types, narrowed to what Phase 6 supports. */
export type TiledPropertyValue = string | number | boolean;

/**
 * One semantic object placed in the level - a Tiled object-layer entry whose
 * `type` field named a class the object-class catalog recognises.
 */
export interface NormalizedLevelObject {
  /** Tiled's own object id. Stable within one Tiled file, unique within the level. */
  readonly id: number;
  /** The semantic class name (Tiled's object `type`/`class` field), e.g. "PlayerSpawn". */
  readonly class: string;
  /** Tiled's optional free-text object name. Not an identifier; may be empty or duplicated. */
  readonly name: string;
  /** Top-left corner, in pixels, in the map's own coordinate space. */
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  /** Custom properties declared on the Tiled object, already type-narrowed. */
  readonly properties: Readonly<Record<string, TiledPropertyValue>>;
}

/** One axis-aligned solid rectangle, in map pixel space - the level's collidable/playable ground. */
export interface NormalizedSolid {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** Metadata about one Tiled tile layer. Phase 6 records dimensions; it does not render tile images (see docs/architecture). */
export interface NormalizedTileLayerSummary {
  readonly name: string;
  readonly widthInTiles: number;
  readonly heightInTiles: number;
}

/** The transformed, validated result of normalizing one Tiled JSON export. */
export interface NormalizedLevel {
  readonly schemaVersion: number;
  /** Stable level id, independent of the Tiled file name. */
  readonly id: string;
  readonly mapWidth: number;
  readonly mapHeight: number;
  readonly tileWidth: number;
  readonly tileHeight: number;
  readonly tileLayers: readonly NormalizedTileLayerSummary[];
  /** Collision/playable-ground geometry, sourced from "Solid"-classed objects. */
  readonly solids: readonly NormalizedSolid[];
  /** Every recognised semantic object on every object layer, in Tiled's own object order. */
  readonly objects: readonly NormalizedLevelObject[];
}
