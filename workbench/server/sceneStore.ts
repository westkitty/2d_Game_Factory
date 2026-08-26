/**
 * The Scene Composer's host half.
 *
 * The Composer edits `content/levels/<id>.json` - the same Tiled-shaped
 * document a generated game already ships and already loads. There is no
 * workbench-private level format, which is what failure condition F09/F10 and
 * acceptance W18 are about: a project edited here stays editable in Tiled, in
 * a text editor, or by the CLI's `add-level`.
 *
 * Every save is normalised through @sw2d/content-pipeline and validated
 * through @sw2d/schemas *before* the file is replaced. An edit that would not
 * load is refused, not persisted - a generated game imports its level at
 * module load, so an invalid document does not fail validation later, it
 * stops the game booting.
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { OBJECT_CLASS_CATALOG, OBJECT_CLASS_IDS, normalizeTiledMap } from '@sw2d/content-pipeline';
import { validateDocumentOrThrow } from '@sw2d/schemas';
import type { NormalizedLevel } from '@sw2d/contracts';
import { writeJsonAtomic } from './atomicJson.ts';
import { gameRoot, resolveContained } from './paths.ts';
import { SecurityError } from './security.ts';

const LEVEL_ID_PATTERN = /^[a-z][a-z0-9-]*$/;

export function assertValidLevelId(value: unknown): string {
  if (typeof value !== 'string' || value.length > 64 || !LEVEL_ID_PATTERN.test(value)) {
    throw new SecurityError(400, `Invalid level id ${JSON.stringify(value)}.`);
  }
  return value;
}

function levelPath(gameId: string, levelId: string): string {
  return resolveContained(gameRoot(gameId), 'content', 'levels', `${assertValidLevelId(levelId)}.json`);
}

export function listLevels(gameId: string): readonly string[] {
  const dir = resolveContained(gameRoot(gameId), 'content', 'levels');
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => name.endsWith('.json'))
    .map((name) => name.slice(0, -'.json'.length))
    .filter((id) => LEVEL_ID_PATTERN.test(id))
    .sort();
}

// ---------------------------------------------------------------------------
// The editable scene document
// ---------------------------------------------------------------------------

export interface SceneObject {
  readonly id: number;
  readonly class: string;
  readonly name: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly properties: Readonly<Record<string, string | number | boolean>>;
  /** Which object layer it belongs to - `Solids` or `Entities` in every generated level. */
  readonly layer: string;
}

export interface SceneDocument {
  readonly levelId: string;
  readonly mapWidth: number;
  readonly mapHeight: number;
  readonly tileWidth: number;
  readonly tileHeight: number;
  readonly layers: readonly string[];
  readonly objects: readonly SceneObject[];
}

interface RawTiledProperty {
  readonly name: string;
  readonly type: string;
  readonly value: string | number | boolean;
}

interface RawTiledObject {
  readonly id: number;
  readonly class?: string;
  readonly type?: string;
  readonly name?: string;
  readonly x: number;
  readonly y: number;
  readonly width?: number;
  readonly height?: number;
  readonly properties?: readonly RawTiledProperty[];
}

interface RawTiledLayer {
  readonly type: string;
  readonly name: string;
  readonly width?: number;
  readonly height?: number;
  readonly objects?: readonly RawTiledObject[];
}

interface RawTiledMap {
  readonly width: number;
  readonly height: number;
  readonly tilewidth: number;
  readonly tileheight: number;
  readonly layers: readonly RawTiledLayer[];
}

function readRaw(gameId: string, levelId: string): RawTiledMap {
  const filePath = levelPath(gameId, levelId);
  if (!existsSync(filePath)) throw new SecurityError(404, `No level "${levelId}" in this project.`);
  return JSON.parse(readFileSync(filePath, 'utf8')) as RawTiledMap;
}

/** Flattens the raw Tiled document into the flat, layer-tagged object list the editor manipulates. */
export function loadScene(gameId: string, levelId: string): SceneDocument {
  const raw = readRaw(gameId, levelId);
  const objects: SceneObject[] = [];
  const layers: string[] = [];

  for (const layer of raw.layers) {
    if (layer.type !== 'objectgroup') continue;
    layers.push(layer.name);
    for (const object of layer.objects ?? []) {
      const properties: Record<string, string | number | boolean> = {};
      for (const property of object.properties ?? []) properties[property.name] = property.value;
      objects.push({
        id: object.id,
        class: object.class ?? object.type ?? 'Solid',
        name: object.name ?? '',
        x: object.x,
        y: object.y,
        width: object.width ?? 0,
        height: object.height ?? 0,
        properties,
        layer: layer.name,
      });
    }
  }

  return {
    levelId,
    mapWidth: raw.width,
    mapHeight: raw.height,
    tileWidth: raw.tilewidth,
    tileHeight: raw.tileheight,
    layers,
    objects,
  };
}

/** Tiled's property type tag for a JS value. `int` for whole numbers, matching what the generator writes and what Tiled itself emits. */
function propertyType(value: string | number | boolean): string {
  if (typeof value === 'boolean') return 'bool';
  if (typeof value === 'number') return Number.isInteger(value) ? 'int' : 'float';
  return 'string';
}

function toRaw(scene: SceneDocument, original: RawTiledMap): RawTiledMap {
  const byLayer = new Map<string, RawTiledObject[]>();
  for (const layerName of scene.layers) byLayer.set(layerName, []);

  for (const object of scene.objects) {
    const bucket = byLayer.get(object.layer) ?? byLayer.get(scene.layers[0] ?? 'Entities');
    if (!bucket) continue;
    const properties = Object.entries(object.properties).map(([name, value]) => ({ name, type: propertyType(value), value }));
    bucket.push({
      id: object.id,
      class: object.class,
      name: object.name,
      x: Math.round(object.x * 100) / 100,
      y: Math.round(object.y * 100) / 100,
      width: Math.round(object.width * 100) / 100,
      height: Math.round(object.height * 100) / 100,
      ...(properties.length > 0 ? { properties } : { properties: [] }),
    });
  }

  return {
    ...original,
    width: scene.mapWidth,
    height: scene.mapHeight,
    tilewidth: scene.tileWidth,
    tileheight: scene.tileHeight,
    // Tile layers are passed through untouched: the Composer edits objects,
    // and silently rewriting a tile layer it does not understand would be a
    // good way to destroy hand-authored content.
    layers: original.layers.map((layer) => {
      if (layer.type !== 'objectgroup') return layer;
      return { ...layer, objects: byLayer.get(layer.name) ?? [] };
    }),
  };
}

export interface SaveSceneResult {
  readonly scene: SceneDocument;
  readonly normalized: NormalizedLevel;
  readonly objectCount: number;
}

export class SceneValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SceneValidationError';
  }
}

/**
 * Validates, then writes.
 *
 * Three gates, in order: object ids must be unique (they are what selection,
 * undo and role references hang off), the pipeline must be able to normalise
 * the document, and the normalised result must pass the level-document
 * schema. Only then is the file replaced, atomically.
 */
export function saveScene(gameId: string, scene: SceneDocument): SaveSceneResult {
  const original = readRaw(gameId, scene.levelId);

  const seen = new Set<number>();
  for (const object of scene.objects) {
    if (!Number.isInteger(object.id)) throw new SceneValidationError(`Object id ${String(object.id)} is not an integer.`);
    if (seen.has(object.id)) throw new SceneValidationError(`Duplicate object id ${object.id}. Ids must be unique within a level.`);
    seen.add(object.id);
    if (!OBJECT_CLASS_CATALOG.has(object.class)) {
      throw new SceneValidationError(`Unknown object class "${object.class}". Supported classes: ${OBJECT_CLASS_IDS.join(', ')}.`);
    }
  }

  const raw = toRaw(scene, original);

  let normalized: NormalizedLevel;
  try {
    normalized = normalizeTiledMap(scene.levelId, raw);
  } catch (error) {
    throw new SceneValidationError(error instanceof Error ? error.message : String(error));
  }
  validateDocumentOrThrow<NormalizedLevel>('level-document', `games/${gameId}/content/levels/${scene.levelId}.json`, normalized);

  writeJsonAtomic(levelPath(gameId, scene.levelId), raw);
  return { scene: loadScene(gameId, scene.levelId), normalized, objectCount: scene.objects.length };
}

// ---------------------------------------------------------------------------
// The palette of things a user can add
// ---------------------------------------------------------------------------

export interface ObjectClassOption {
  readonly id: string;
  readonly requiredProperties: readonly { readonly name: string; readonly type: string }[];
  readonly optionalProperties: readonly { readonly name: string; readonly type: string }[];
  readonly defaultWidth: number;
  readonly defaultHeight: number;
  readonly defaultLayer: string;
  /** A sensible starting value per required property, so adding an object never produces one that fails validation. */
  readonly defaultProperties: Readonly<Record<string, string | number | boolean>>;
}

const DEFAULT_SIZES: Readonly<Record<string, readonly [number, number]>> = {
  Solid: [120, 16],
  PlayerSpawn: [0, 0],
  Checkpoint: [24, 24],
  Collectible: [18, 18],
  Hazard: [60, 18],
  Exit: [26, 52],
  Enemy: [28, 28],
  Powerup: [22, 22],
  Spring: [28, 14],
  Updraft: [64, 96],
  DashPanel: [48, 16],
  Trigger: [48, 48],
  CameraZone: [160, 120],
  MusicZone: [160, 120],
  DialogueTrigger: [32, 32],
  BossTrigger: [48, 48],
  SpawnZone: [96, 96],
  Objective: [32, 32],
  Interactable: [28, 28],
};

/** A unique-enough default for an id-shaped required property, derived from the object id so two added objects never collide. */
function defaultPropertyValue(name: string, type: string, objectId: number): string | number | boolean {
  if (type === 'boolean') return false;
  if (type === 'number') return name === 'damage' ? 10 : name === 'value' ? 5 : 1;
  if (name.endsWith('Id') || name === 'track') return `${name.replace(/Id$/, '').toLowerCase() || 'item'}-${objectId}`;
  if (name === 'enemyType') return 'walker';
  if (name === 'powerupType') return 'speed';
  if (name === 'facing') return 'right';
  return `${name}-${objectId}`;
}

export function objectClassOptions(): readonly ObjectClassOption[] {
  return OBJECT_CLASS_IDS.map((id) => {
    const definition = OBJECT_CLASS_CATALOG.get(id)!;
    const [width, height] = DEFAULT_SIZES[id] ?? [32, 32];
    const defaults: Record<string, string | number | boolean> = {};
    for (const spec of definition.requiredProperties) defaults[spec.name] = defaultPropertyValue(spec.name, spec.type, 0);
    return {
      id,
      requiredProperties: definition.requiredProperties.map((spec) => ({ name: spec.name, type: spec.type })),
      optionalProperties: definition.optionalProperties.map((spec) => ({ name: spec.name, type: spec.type })),
      defaultWidth: width,
      defaultHeight: height,
      defaultLayer: id === 'Solid' ? 'Solids' : 'Entities',
      defaultProperties: defaults,
    };
  });
}

/** Builds a valid new object of `classId`, with an id one past the highest in use so it cannot collide. */
export function newObject(scene: SceneDocument, classId: string, x: number, y: number): SceneObject {
  const definition = OBJECT_CLASS_CATALOG.get(classId);
  if (!definition) throw new SceneValidationError(`Unknown object class "${classId}".`);
  const nextId = scene.objects.reduce((max, object) => Math.max(max, object.id), 0) + 1;
  const [width, height] = DEFAULT_SIZES[classId] ?? [32, 32];
  const properties: Record<string, string | number | boolean> = {};
  for (const spec of definition.requiredProperties) properties[spec.name] = defaultPropertyValue(spec.name, spec.type, nextId);
  return {
    id: nextId,
    class: classId,
    name: classId,
    x: Math.round(x),
    y: Math.round(y),
    width,
    height,
    properties,
    layer: classId === 'Solid' ? 'Solids' : 'Entities',
  };
}
