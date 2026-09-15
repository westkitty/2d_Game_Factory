/**
 * Save/load system for generated games.
 *
 * Provides a structured save/load API with versioning, slot management,
 * and serialization. Saves are stored in browser localStorage (or a custom
 * backend) and can be exported/imported as JSON.
 */

export interface SaveSlot {
  readonly id: string;
  readonly name: string;
  readonly timestamp: number;
  readonly playtimeMs: number;
  readonly version: number;
  readonly data: unknown;
}

export interface SaveStore {
  /** Save data to a slot. */
  save(slotId: string, name: string, data: unknown, playtimeMs: number): SaveSlot;

  /** Load data from a slot. Returns null if not found. */
  load(slotId: string): SaveSlot | null;

  /** Delete a save slot. */
  delete(slotId: string): boolean;

  /** List all save slots. */
  list(): readonly SaveSlot[];

  /** Check if a slot exists. */
  has(slotId: string): boolean;

  /** Export all saves as JSON. */
  exportAll(): string;

  /** Import saves from JSON. Merges with existing saves. */
  importAll(json: string): number;

  /** Clear all saves. */
  clearAll(): void;

  /** Get the number of save slots. */
  readonly count: number;
}

/**
 * Creates a save store with the given game ID and version.
 *
 * @param gameId Unique identifier for the game
 * @param version Save data schema version (for migration)
 * @param storage Custom storage backend (defaults to localStorage)
 */
export function createSaveStore(
  gameId: string,
  version = 1,
  storage?: { getItem(key: string): string | null; setItem(key: string, value: string): void; removeItem(key: string): void; readonly length: number; key(index: number): string | null },
): SaveStore {
  const prefix = `sw2d:save:${gameId}:`;
  const store = storage ?? createMemoryStorage();

  function getStore(): typeof store {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        return window.localStorage;
      }
    } catch {
      // Fall back to provided storage
    }
    return store;
  }

  function save(slotId: string, name: string, data: unknown, playtimeMs: number): SaveSlot {
    const slot: SaveSlot = {
      id: slotId,
      name,
      timestamp: Date.now(),
      playtimeMs,
      version,
      data,
    };
    getStore().setItem(`${prefix}${slotId}`, JSON.stringify(slot));
    return slot;
  }

  function load(slotId: string): SaveSlot | null {
    const raw = getStore().getItem(`${prefix}${slotId}`);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as SaveSlot;
    } catch {
      return null;
    }
  }

  function deleteSlot(slotId: string): boolean {
    const key = `${prefix}${slotId}`;
    const exists = getStore().getItem(key) !== null;
    getStore().removeItem(key);
    return exists;
  }

  function list(): readonly SaveSlot[] {
    const result: SaveSlot[] = [];
    const s = getStore();
    if ('length' in s && 'key' in s) {
      const storage = s as Storage;
      for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i);
        if (key && key.startsWith(prefix)) {
          try {
            const raw = storage.getItem(key);
            if (raw) result.push(JSON.parse(raw));
          } catch {
            // Skip corrupted saves
          }
        }
      }
    }
    return result.sort((a, b) => b.timestamp - a.timestamp);
  }

  function has(slotId: string): boolean {
    return getStore().getItem(`${prefix}${slotId}`) !== null;
  }

  function exportAll(): string {
    return JSON.stringify({ version, gameId, saves: list() }, null, 2);
  }

  function importAll(json: string): number {
    const parsed = JSON.parse(json) as { saves?: SaveSlot[] };
    if (!parsed.saves || !Array.isArray(parsed.saves)) return 0;
    let count = 0;
    for (const slot of parsed.saves) {
      if (slot.id && slot.data !== undefined) {
        getStore().setItem(`${prefix}${slot.id}`, JSON.stringify(slot));
        count++;
      }
    }
    return count;
  }

  function clearAll(): void {
    const s = getStore();
    if ('length' in s && 'key' in s) {
      const storage = s as Storage;
      const toRemove: string[] = [];
      for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i);
        if (key && key.startsWith(prefix)) toRemove.push(key);
      }
      for (const key of toRemove) storage.removeItem(key);
    }
  }

  return {
    save,
    load,
    delete: deleteSlot,
    list,
    has,
    exportAll,
    importAll,
    clearAll,
    get count() {
      return list().length;
    },
  };
}

function createMemoryStorage(): { getItem(key: string): string | null; setItem(key: string, value: string): void; removeItem(key: string): void; length: number; key(index: number): string | null } {
  const data = new Map<string, string>();
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => { data.set(key, value); },
    removeItem: (key) => { data.delete(key); },
    get length() { return data.size; },
    key: (index) => [...data.keys()][index] ?? null,
  };
}
