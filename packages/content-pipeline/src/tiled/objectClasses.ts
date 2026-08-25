import type { TiledPropertyValue } from '@sw2d/contracts';
import { TiledObjectPropertyError } from './errors.ts';

/**
 * The semantic object-class catalog.
 *
 * This is *validity*, not *behaviour*: a class listed here is a legal Tiled
 * object type that will normalize successfully. Whether anything in the
 * running game actually does something with it is the entity registry's
 * concern (@sw2d/packs' world.entities capability) - "not every class needs
 * full gameplay behaviour in Phase 6" (MASTER_PROJECT.md section 6).
 *
 * `Solid` is this factory's own addition, one class beyond the required
 * eighteen (MASTER_PROJECT.md section 13.1 permits system packs to register
 * additional classes). It is how Phase 6 represents collision/platform
 * geometry from an object layer, rather than Tiled's per-tile collision
 * metadata - see docs/architecture/adr/0014-content-pipeline-and-entity-registry.md
 * for why tile-collision metadata is explicitly out of scope this phase.
 */

export type PropertyType = 'string' | 'number' | 'boolean';

export interface PropertySpec {
  readonly name: string;
  readonly type: PropertyType;
}

export interface ObjectClassDefinition {
  readonly id: string;
  readonly requiredProperties: readonly PropertySpec[];
  readonly optionalProperties: readonly PropertySpec[];
}

function classDef(
  id: string,
  requiredProperties: readonly PropertySpec[] = [],
  optionalProperties: readonly PropertySpec[] = [],
): ObjectClassDefinition {
  return { id, requiredProperties, optionalProperties };
}

const CLASS_LIST: readonly ObjectClassDefinition[] = [
  classDef('PlayerSpawn', [], [{ name: 'facing', type: 'string' }]),
  classDef('Checkpoint', [{ name: 'checkpointId', type: 'string' }]),
  classDef('Exit', [{ name: 'exitId', type: 'string' }], [{ name: 'targetLevel', type: 'string' }]),
  classDef('Enemy', [{ name: 'enemyType', type: 'string' }], [{ name: 'patrolRange', type: 'number' }]),
  classDef('Hazard', [{ name: 'damage', type: 'number' }]),
  classDef('Collectible', [{ name: 'itemId', type: 'string' }], [{ name: 'value', type: 'number' }]),
  classDef('Powerup', [{ name: 'powerupType', type: 'string' }]),
  classDef('Spring', [{ name: 'force', type: 'number' }]),
  classDef('Updraft', [{ name: 'force', type: 'number' }]),
  classDef('DashPanel', [], [{ name: 'boostMultiplier', type: 'number' }]),
  classDef('Trigger', [{ name: 'triggerId', type: 'string' }]),
  classDef('CameraZone', [], [{ name: 'zoomLevel', type: 'number' }]),
  classDef('MusicZone', [{ name: 'track', type: 'string' }]),
  classDef('DialogueTrigger', [{ name: 'dialogueId', type: 'string' }]),
  classDef('BossTrigger', [{ name: 'bossId', type: 'string' }]),
  classDef('SpawnZone', [{ name: 'spawnGroup', type: 'string' }]),
  classDef('Objective', [{ name: 'objectiveId', type: 'string' }]),
  classDef('Interactable', [{ name: 'interactionId', type: 'string' }]),
  classDef('Solid'),
];

export const OBJECT_CLASS_CATALOG: ReadonlyMap<string, ObjectClassDefinition> = new Map(
  CLASS_LIST.map((definition) => [definition.id, definition]),
);

export const OBJECT_CLASS_IDS: readonly string[] = CLASS_LIST.map((definition) => definition.id);

function typeOfValue(value: TiledPropertyValue): PropertyType {
  if (typeof value === 'number') return 'number';
  if (typeof value === 'boolean') return 'boolean';
  return 'string';
}

/**
 * Check a normalized property bag against one class's required/optional
 * specs. Throws TiledObjectPropertyError naming the exact missing or
 * mistyped property - unknown extra properties are passed through unchanged
 * (a level author may attach editor-only metadata Tiled does not strip).
 */
export function validateObjectProperties(
  mapId: string,
  objectId: number,
  definition: ObjectClassDefinition,
  properties: Readonly<Record<string, TiledPropertyValue>>,
): void {
  for (const spec of definition.requiredProperties) {
    if (!(spec.name in properties)) {
      throw new TiledObjectPropertyError(mapId, objectId, definition.id, `missing required property "${spec.name}"`);
    }
    const actual = typeOfValue(properties[spec.name] as TiledPropertyValue);
    if (actual !== spec.type) {
      throw new TiledObjectPropertyError(
        mapId,
        objectId,
        definition.id,
        `property "${spec.name}" must be ${spec.type}, got ${actual}`,
      );
    }
  }
  for (const spec of definition.optionalProperties) {
    if (!(spec.name in properties)) continue;
    const actual = typeOfValue(properties[spec.name] as TiledPropertyValue);
    if (actual !== spec.type) {
      throw new TiledObjectPropertyError(
        mapId,
        objectId,
        definition.id,
        `property "${spec.name}" must be ${spec.type}, got ${actual}`,
      );
    }
  }
}
