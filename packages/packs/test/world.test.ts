import { describe, expect, it } from 'vitest';
import type { WorldService } from '../src/world/worldPack.ts';
import { worldPack } from '../src/world/worldPack.ts';
import { createFakeGameContext } from './testSupport.ts';

describe('worldPack', () => {
  it('installs and publishes the world capability', () => {
    const context = createFakeGameContext();
    const installed = worldPack.install(context, undefined);

    expect(context.capabilities.has('world')).toBe(true);
    expect(installed.id).toBe('sw2d.world');
  });

  it('sets and reads flags, emitting only on an actual change', () => {
    const context = createFakeGameContext();
    worldPack.install(context, undefined);
    const world = context.capabilities.require<WorldService>('world');

    const changes: unknown[] = [];
    context.events.on('world:flagChanged', (payload) => changes.push(payload));

    expect(world.hasFlag('door.unlocked')).toBe(false);
    world.setFlag('door.unlocked', true);
    expect(world.hasFlag('door.unlocked')).toBe(true);
    world.setFlag('door.unlocked', true); // no-op
    expect(changes).toEqual([{ flag: 'door.unlocked', value: true }]);
  });

  it('activates checkpoints and emits world:checkpointActivated', () => {
    const context = createFakeGameContext();
    worldPack.install(context, undefined);
    const world = context.capabilities.require<WorldService>('world');

    const activations: unknown[] = [];
    context.events.on('world:checkpointActivated', (payload) => activations.push(payload));

    expect(world.currentCheckpoint()).toBeNull();
    world.activateCheckpoint('level1.start');
    expect(world.currentCheckpoint()).toBe('level1.start');
    expect(activations).toEqual([{ checkpointId: 'level1.start' }]);
  });

  it('tracks zone-entered state independent of flags', () => {
    const context = createFakeGameContext();
    worldPack.install(context, undefined);
    const world = context.capabilities.require<WorldService>('world');

    expect(world.isZoneEntered('boss-arena')).toBe(false);
    world.setZoneEntered('boss-arena', true);
    expect(world.isZoneEntered('boss-arena')).toBe(true);
    world.setZoneEntered('boss-arena', false);
    expect(world.isZoneEntered('boss-arena')).toBe(false);
  });

  it('reset() clears flags, zones and the active checkpoint together', () => {
    const context = createFakeGameContext();
    worldPack.install(context, undefined);
    const world = context.capabilities.require<WorldService>('world');
    world.setFlag('seen-intro', true);
    world.setZoneEntered('zone-a', true);
    world.activateCheckpoint('cp1');

    world.reset();

    expect(world.flags()).toEqual([]);
    expect(world.isZoneEntered('zone-a')).toBe(false);
    expect(world.currentCheckpoint()).toBeNull();
  });

  it('withdraws the capability on dispose', () => {
    const context = createFakeGameContext();
    const installed = worldPack.install(context, undefined);

    installed.dispose();

    expect(context.capabilities.has('world')).toBe(false);
  });
});
