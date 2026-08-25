/**
 * Raw Tiled JSON types - the shape Tiled itself exports, not this factory's
 * own domain model. Deliberately narrow: only the fields `normalizeTiledMap`
 * actually reads. See docs/architecture/adr/0014-content-pipeline-and-entity-registry.md
 * for the exact supported subset and what is explicitly rejected.
 */

export type TiledPropertyType = 'string' | 'int' | 'float' | 'bool';

export interface TiledProperty {
  readonly name: string;
  readonly type: TiledPropertyType;
  readonly value: string | number | boolean;
}

export interface TiledObject {
  readonly id: number;
  /** Tiled's object "Class" field. Older Tiled JSON exports name the same field "type". */
  readonly type?: string;
  readonly class?: string;
  readonly name?: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly properties?: readonly TiledProperty[];
}

export interface TiledObjectGroupLayer {
  readonly type: 'objectgroup';
  readonly name: string;
  readonly objects: readonly TiledObject[];
}

export interface TiledTileLayer {
  readonly type: 'tilelayer';
  readonly name: string;
  readonly width: number;
  readonly height: number;
  readonly data?: readonly number[];
}

export type TiledLayer = TiledTileLayer | TiledObjectGroupLayer;

export interface TiledMap {
  readonly type: 'map';
  readonly orientation: string;
  readonly infinite?: boolean;
  readonly width: number;
  readonly height: number;
  readonly tilewidth: number;
  readonly tileheight: number;
  readonly layers: readonly TiledLayer[];
}
