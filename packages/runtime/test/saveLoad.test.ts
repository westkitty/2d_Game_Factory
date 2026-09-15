/**
 * Tests for the save/load system.
 */

import { describe, it, expect } from 'vitest';
import { createSaveStore } from '../src/game-support/saveLoad.ts';

function createTestStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => { data.set(key, value); },
    removeItem: (key: string) => { data.delete(key); },
    get length() { return data.size; },
    key: (index: number) => [...data.keys()][index] ?? null,
  };
}

describe('createSaveStore', () => {
  it('starts empty', () => {
    const store = createSaveStore('test-game', 1, createTestStorage());
    expect(store.count).toBe(0);
    expect(store.list()).toHaveLength(0);
  });

  it('saves and loads data', () => {
    const store = createSaveStore('test-game', 1, createTestStorage());
    store.save('slot1', 'My Save', { level: 5, score: 1000 }, 60000);

    const loaded = store.load('slot1');
    expect(loaded).not.toBeNull();
    expect(loaded!.id).toBe('slot1');
    expect(loaded!.name).toBe('My Save');
    expect(loaded!.data).toEqual({ level: 5, score: 1000 });
    expect(loaded!.playtimeMs).toBe(60000);
    expect(loaded!.version).toBe(1);
  });

  it('returns null for missing slots', () => {
    const store = createSaveStore('test-game', 1, createTestStorage());
    expect(store.load('nonexistent')).toBeNull();
  });

  it('deletes slots', () => {
    const store = createSaveStore('test-game', 1, createTestStorage());
    store.save('slot1', 'Save', {}, 0);
    expect(store.has('slot1')).toBe(true);

    store.delete('slot1');
    expect(store.has('slot1')).toBe(false);
    expect(store.load('slot1')).toBeNull();
  });

  it('lists all saves sorted by timestamp', () => {
    const store = createSaveStore('test-game', 1, createTestStorage());
    // Mock Date.now to ensure distinct timestamps
    const originalNow = Date.now;
    let fakeTime = 1000;
    Date.now = () => { fakeTime += 1000; return fakeTime; };

    try {
      store.save('slot1', 'First', {}, 0);
      store.save('slot2', 'Second', {}, 1000);

      const list = store.list();
      expect(list).toHaveLength(2);
      // Most recent first - slot2 has a later timestamp
      expect(list[0]!.name).toBe('Second');
      expect(list[1]!.name).toBe('First');
    } finally {
      Date.now = originalNow;
    }
  });

  it('exports and imports saves', () => {
    const storage1 = createTestStorage();
    const storage2 = createTestStorage();
    const store1 = createSaveStore('test-game', 1, storage1);
    const store2 = createSaveStore('test-game', 1, storage2);

    store1.save('slot1', 'Save 1', { a: 1 }, 100);
    store1.save('slot2', 'Save 2', { b: 2 }, 200);

    const exported = store1.exportAll();
    const count = store2.importAll(exported);
    expect(count).toBe(2);
    expect(store2.count).toBe(2);
    expect(store2.load('slot1')!.data).toEqual({ a: 1 });
  });

  it('clears all saves', () => {
    const store = createSaveStore('test-game', 1, createTestStorage());
    store.save('slot1', 'Save 1', {}, 0);
    store.save('slot2', 'Save 2', {}, 0);
    expect(store.count).toBe(2);

    store.clearAll();
    expect(store.count).toBe(0);
  });
});
