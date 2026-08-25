import type { GameContext, InstalledSystemPack, NormalizedLevelObject, SystemPackDefinition } from '@sw2d/contracts';
import { CAPABILITY_IDS, PACK_IDS } from '../ids.ts';

/**
 * Entity registry: dispatches a normalized Tiled object to a registered
 * factory by its semantic class. A second world-family capability alongside
 * worldPack's `world.state` (ADR-0011) - this one owns "what do we do with a
 * level-authored object", not flag/checkpoint state.
 *
 * Deliberately renderer-independent, like every other @sw2d/packs core: the
 * registry only stores and calls functions of shape
 * `(object, context) => result`. A rendering factory typed against
 * SceneContext is supplied - and typed - by whichever scene-scoped code
 * registers it (see starter/src/game-specific/tiledLevelPack.ts), not by
 * this package, which stays Phaser-free.
 */

export type EntityFactory<TContext extends GameContext = GameContext, TResult = unknown> = (
  object: NormalizedLevelObject,
  context: TContext,
) => TResult;

export interface EntityRegistry<TContext extends GameContext = GameContext> {
  /** Duplicate registration for the same class id throws - one factory owns one class. */
  register(classId: string, factory: EntityFactory<TContext>): void;
  has(classId: string): boolean;
  list(): readonly string[];
  /**
   * Calls the registered factory for `object.class` and returns its result.
   * Returns `undefined`, without error, when no factory is registered - most
   * catalog classes have no real consumer yet, and that is expected, not a
   * fault (MASTER_PROJECT.md section 7). An *unknown* class (not in the
   * object-class catalog at all) never reaches here: normalizeTiledMap
   * already rejected it before a NormalizedLevelObject could exist.
   */
  dispatch(object: NormalizedLevelObject, context: TContext): unknown;
}

export class DuplicateEntityFactoryError extends Error {
  constructor(classId: string) {
    super(`An entity factory is already registered for class "${classId}".`);
    this.name = 'DuplicateEntityFactoryError';
  }
}

class EntityRegistryImpl implements EntityRegistry<GameContext> {
  readonly #factories = new Map<string, EntityFactory<GameContext>>();

  register(classId: string, factory: EntityFactory<GameContext>): void {
    if (this.#factories.has(classId)) throw new DuplicateEntityFactoryError(classId);
    this.#factories.set(classId, factory);
  }

  has(classId: string): boolean {
    return this.#factories.has(classId);
  }

  list(): readonly string[] {
    return [...this.#factories.keys()].sort();
  }

  dispatch(object: NormalizedLevelObject, context: GameContext): unknown {
    const factory = this.#factories.get(object.class);
    return factory ? factory(object, context) : undefined;
  }
}

export const entityRegistryPack: SystemPackDefinition<undefined, GameContext> = {
  id: PACK_IDS.worldEntities,
  version: '0.1.0',
  provides: [CAPABILITY_IDS.entities],
  dependencies: [],

  install(context: GameContext): InstalledSystemPack {
    const registry = new EntityRegistryImpl();
    const handle = context.capabilities.provide(CAPABILITY_IDS.entities, registry);

    return {
      id: PACK_IDS.worldEntities,
      dispose(): void {
        handle.dispose();
      },
    };
  },
};
