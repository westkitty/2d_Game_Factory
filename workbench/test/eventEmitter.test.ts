/**
 * Tests for the event emitter.
 */

import { describe, it, expect, vi } from 'vitest';
import { createEventEmitter } from '../shared/eventEmitter.ts';

type TestEvents = {
  click: { x: number; y: number };
  resize: { width: number; height: number };
  message: string;
};

describe('createEventEmitter', () => {
  it('emits events to subscribers', () => {
    const emitter = createEventEmitter<TestEvents>();
    const handler = vi.fn();
    emitter.on('click', handler);
    emitter.emit('click', { x: 10, y: 20 });
    expect(handler).toHaveBeenCalledWith({ x: 10, y: 20 });
  });

  it('supports multiple subscribers', () => {
    const emitter = createEventEmitter<TestEvents>();
    const h1 = vi.fn();
    const h2 = vi.fn();
    emitter.on('click', h1);
    emitter.on('click', h2);
    emitter.emit('click', { x: 5, y: 5 });
    expect(h1).toHaveBeenCalled();
    expect(h2).toHaveBeenCalled();
  });

  it('disposer removes the listener', () => {
    const emitter = createEventEmitter<TestEvents>();
    const handler = vi.fn();
    const dispose = emitter.on('click', handler);
    dispose();
    emitter.emit('click', { x: 0, y: 0 });
    expect(handler).not.toHaveBeenCalled();
  });

  it('once fires only once', () => {
    const emitter = createEventEmitter<TestEvents>();
    const handler = vi.fn();
    emitter.once('message', handler);
    emitter.emit('message', 'hello');
    emitter.emit('message', 'world');
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith('hello');
  });

  it('off removes all listeners for an event', () => {
    const emitter = createEventEmitter<TestEvents>();
    const h1 = vi.fn();
    const h2 = vi.fn();
    emitter.on('click', h1);
    emitter.on('click', h2);
    emitter.off('click');
    emitter.emit('click', { x: 0, y: 0 });
    expect(h1).not.toHaveBeenCalled();
    expect(h2).not.toHaveBeenCalled();
  });

  it('off with no argument removes all listeners', () => {
    const emitter = createEventEmitter<TestEvents>();
    const h1 = vi.fn();
    const h2 = vi.fn();
    emitter.on('click', h1);
    emitter.on('message', h2);
    emitter.off();
    emitter.emit('click', { x: 0, y: 0 });
    emitter.emit('message', 'test');
    expect(h1).not.toHaveBeenCalled();
    expect(h2).not.toHaveBeenCalled();
  });

  it('listenerCount returns correct count', () => {
    const emitter = createEventEmitter<TestEvents>();
    expect(emitter.listenerCount('click')).toBe(0);
    const d1 = emitter.on('click', () => undefined);
    expect(emitter.listenerCount('click')).toBe(1);
    emitter.on('click', () => undefined);
    expect(emitter.listenerCount('click')).toBe(2);
    d1();
    expect(emitter.listenerCount('click')).toBe(1);
  });

  it('waitFor resolves on next emit', async () => {
    const emitter = createEventEmitter<TestEvents>();
    const promise = emitter.waitFor('message');
    emitter.emit('message', 'hello');
    const result = await promise;
    expect(result).toBe('hello');
  });

  it('waitFor rejects on timeout', async () => {
    const emitter = createEventEmitter<TestEvents>();
    const promise = emitter.waitFor('message', 50);
    await expect(promise).rejects.toThrow('Timeout');
  });

  it('handles errors in handlers gracefully', () => {
    const emitter = createEventEmitter<TestEvents>();
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const h1 = () => { throw new Error('boom'); };
    const h2 = vi.fn();
    emitter.on('click', h1);
    emitter.on('click', h2);
    emitter.emit('click', { x: 0, y: 0 });
    expect(h2).toHaveBeenCalled(); // h2 still runs despite h1 throwing
    errorSpy.mockRestore();
  });
});
