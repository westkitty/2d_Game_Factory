import { describe, expect, it } from 'vitest';
import type { NormalizedLevelObject } from '@sw2d/contracts';
import { DuplicateEntityFactoryError, type EntityRegistry, entityRegistryPack } from '../src/index.ts';
import { createFakeGameContext } from './testSupport.ts';

function levelObject(overrides: Partial<NormalizedLevelObject> = {}): NormalizedLevelObject {
  return { id: 1, class: 'Collectible', name: '', x: 10, y: 20, width: 16, height: 16, properties: {}, ...overrides };
}

describe('entityRegistryPack', () => {
  it('installs and publishes the world.entities capability', () => {
    const context = createFakeGameContext();
    const installed = entityRegistryPack.install(context, undefined);

    expect(context.capabilities.has('world.entities')).toBe(true);
    expect(installed.id).toBe('sw2d.world-entities');
  });

  it('dispatches a normalized object to the factory registered for its class', () => {
    const context = createFakeGameContext();
    entityRegistryPack.install(context, undefined);
    const registry = context.capabilities.require<EntityRegistry>('world.entities');

    const seen: NormalizedLevelObject[] = [];
    registry.register('Collectible', (object) => {
      seen.push(object);
      return 'spawned';
    });

    const result = registry.dispatch(levelObject(), context);
    expect(result).toBe('spawned');
    expect(seen).toEqual([levelObject()]);
  });

  it('dispatching an object with no registered factory returns undefined, not an error', () => {
    const context = createFakeGameContext();
    entityRegistryPack.install(context, undefined);
    const registry = context.capabilities.require<EntityRegistry>('world.entities');

    expect(() => registry.dispatch(levelObject({ class: 'CameraZone' }), context)).not.toThrow();
    expect(registry.dispatch(levelObject({ class: 'CameraZone' }), context)).toBeUndefined();
  });

  it('rejects a duplicate registration for the same class', () => {
    const context = createFakeGameContext();
    entityRegistryPack.install(context, undefined);
    const registry = context.capabilities.require<EntityRegistry>('world.entities');

    registry.register('Hazard', () => undefined);
    expect(() => registry.register('Hazard', () => undefined)).toThrow(DuplicateEntityFactoryError);
  });

  it('list() and has() reflect registered classes only', () => {
    const context = createFakeGameContext();
    entityRegistryPack.install(context, undefined);
    const registry = context.capabilities.require<EntityRegistry>('world.entities');

    expect(registry.has('Exit')).toBe(false);
    registry.register('Exit', () => undefined);
    expect(registry.has('Exit')).toBe(true);
    expect(registry.list()).toEqual(['Exit']);
  });

  it('withdraws the capability on dispose', () => {
    const context = createFakeGameContext();
    const installed = entityRegistryPack.install(context, undefined);

    installed.dispose();

    expect(context.capabilities.has('world.entities')).toBe(false);
  });
});
