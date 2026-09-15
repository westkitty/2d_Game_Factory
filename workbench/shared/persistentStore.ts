/**
 * A persistent key-value store backed by localStorage.
 *
 * Provides type-safe access to browser storage with automatic JSON
 * serialization, versioning, and namespace isolation per game.
 *
 * Falls back to an in-memory store when localStorage is unavailable
 * (private browsing, disabled storage, etc.).
 */

export interface PersistentStore {
  /** Get a value by key, or null if not set. */
  get<T>(key: string): T | null;

  /** Set a value by key. */
  set<T>(key: string, value: T): void;

  /** Remove a value by key. */
  remove(key: string): void;

  /** Check if a key exists. */
  has(key: string): boolean;

  /** Get all keys in the store. */
  keys(): readonly string[];

  /** Clear all values in the store. */
  clear(): void;

  /** Get the number of items in the store. */
  readonly size: number;
}

/**
 * Creates a persistent store with an optional namespace prefix.
 *
 * @param namespace Prefix for all keys (e.g., game ID)
 * @param version Schema version for migration support
 */
export function createPersistentStore(namespace = 'sw2d', version = 1): PersistentStore {
  const prefix = `${namespace}:v${version}:`;
  let memoryFallback: Map<string, string> | null = null;

  function getStorage(): Storage | null {
    try {
      const storage = window.localStorage;
      // Test that storage actually works (can throw in private browsing)
      storage.setItem('__sw2d_test__', '1');
      storage.removeItem('__sw2d_test__');
      return storage;
    } catch {
      return null;
    }
  }

  function fullKey(key: string): string {
    return `${prefix}${key}`;
  }

  function getStore(): Storage | Map<string, string> {
    const storage = getStorage();
    if (storage) return storage;
    if (!memoryFallback) memoryFallback = new Map();
    return memoryFallback;
  }

  function get<T>(key: string): T | null {
    const store = getStore();
    const raw = store instanceof Map ? store.get(fullKey(key)) : store.getItem(fullKey(key));
    if (raw === null || raw === undefined) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  function set<T>(key: string, value: T): void {
    const store = getStore();
    const raw = JSON.stringify(value);
    if (store instanceof Map) {
      store.set(fullKey(key), raw);
    } else {
      store.setItem(fullKey(key), raw);
    }
  }

  function remove(key: string): void {
    const store = getStore();
    if (store instanceof Map) {
      store.delete(fullKey(key));
    } else {
      store.removeItem(fullKey(key));
    }
  }

  function has(key: string): boolean {
    return get(key) !== null;
  }

  function keys(): readonly string[] {
    const store = getStore();
    const result: string[] = [];
    if (store instanceof Map) {
      for (const key of store.keys()) {
        if (key.startsWith(prefix)) result.push(key.slice(prefix.length));
      }
    } else {
      for (let i = 0; i < store.length; i++) {
        const key = store.key(i);
        if (key && key.startsWith(prefix)) result.push(key.slice(prefix.length));
      }
    }
    return result;
  }

  function clear(): void {
    const store = getStore();
    if (store instanceof Map) {
      for (const key of [...store.keys()]) {
        if (key.startsWith(prefix)) store.delete(key);
      }
    } else {
      const toRemove: string[] = [];
      for (let i = 0; i < store.length; i++) {
        const key = store.key(i);
        if (key && key.startsWith(prefix)) toRemove.push(key);
      }
      for (const key of toRemove) store.removeItem(key);
    }
  }

  return {
    get,
    set,
    remove,
    has,
    keys,
    clear,
    get size() {
      return keys().length;
    },
  };
}
