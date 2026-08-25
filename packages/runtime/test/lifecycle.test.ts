import { describe, expect, it, vi } from 'vitest';
import { CapabilityRegistryImpl } from '../src/core/CapabilityRegistryImpl.ts';
import { DisposableBagImpl } from '../src/core/DisposableBagImpl.ts';
import { EventBusImpl } from '../src/core/EventBusImpl.ts';

describe('DisposableBagImpl', () => {
  it('disposes in reverse registration order', () => {
    const order: string[] = [];
    const bag = new DisposableBagImpl('test');
    bag.addFn(() => order.push('first'));
    bag.addFn(() => order.push('second'));
    bag.addFn(() => order.push('third'));

    bag.dispose();

    expect(order).toEqual(['third', 'second', 'first']);
  });

  it('runs each teardown exactly once even when disposed twice', () => {
    const teardown = vi.fn();
    const bag = new DisposableBagImpl('test');
    bag.addFn(teardown);

    bag.dispose();
    bag.dispose();

    expect(teardown).toHaveBeenCalledTimes(1);
    expect(bag.size).toBe(0);
    expect(bag.disposed).toBe(true);
  });

  it('drops a handle from the bag when it is disposed individually', () => {
    const bag = new DisposableBagImpl('test');
    const handle = bag.addFn(() => undefined);
    expect(bag.size).toBe(1);

    handle.dispose();

    expect(bag.size).toBe(0);
  });

  it('disposes immediately when adding to an already-disposed bag', () => {
    const bag = new DisposableBagImpl('test');
    bag.dispose();
    const teardown = vi.fn();

    bag.addFn(teardown);

    expect(teardown).toHaveBeenCalledTimes(1);
  });

  it('keeps tearing down after one teardown throws', () => {
    const later = vi.fn();
    const bag = new DisposableBagImpl('test');
    bag.addFn(later);
    bag.addFn(() => {
      throw new Error('boom');
    });
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    bag.dispose();

    expect(later).toHaveBeenCalledTimes(1);
  });
});

describe('EventBusImpl', () => {
  it('reports live listener counts and drops them on dispose', () => {
    const bus = new EventBusImpl();
    const handle = bus.on('pause:changed', () => undefined);

    expect(bus.listenerCounts()['pause:changed']).toBe(1);

    handle.dispose();

    expect(bus.listenerCounts()['pause:changed']).toBeUndefined();
    expect(bus.totalListeners).toBe(0);
  });

  it('delivers payloads to every subscriber', () => {
    const bus = new EventBusImpl();
    const seen: boolean[] = [];
    bus.on('pause:changed', (payload) => seen.push(payload.paused));
    bus.on('pause:changed', (payload) => seen.push(payload.paused));

    bus.emit('pause:changed', { paused: true });

    expect(seen).toEqual([true, true]);
  });

  it('isolates a throwing handler from the others', () => {
    const bus = new EventBusImpl();
    const good = vi.fn();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    bus.on('pause:changed', () => {
      throw new Error('handler failed');
    });
    bus.on('pause:changed', good);

    bus.emit('pause:changed', { paused: false });

    expect(good).toHaveBeenCalledTimes(1);
  });
});

describe('CapabilityRegistryImpl', () => {
  it('rejects duplicate capability ids', () => {
    const registry = new CapabilityRegistryImpl();
    registry.provide('world.grid', {});

    expect(() => registry.provide('world.grid', {})).toThrow(/already provided/);
  });

  it('names the missing capability and what is available', () => {
    const registry = new CapabilityRegistryImpl();
    registry.provide('world.grid', {});

    expect(() => registry.require('combat.health')).toThrow(/combat\.health/);
    expect(() => registry.require('combat.health')).toThrow(/world\.grid/);
  });

  it('withdraws a capability when its handle is disposed', () => {
    const registry = new CapabilityRegistryImpl();
    const handle = registry.provide('world.grid', { cells: 4 });

    expect(registry.get<{ cells: number }>('world.grid')?.cells).toBe(4);

    handle.dispose();

    expect(registry.has('world.grid')).toBe(false);
  });
});
