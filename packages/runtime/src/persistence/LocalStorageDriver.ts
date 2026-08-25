import type { StorageDriver } from '@sw2d/contracts';

/**
 * localStorage wrapper that never throws.
 *
 * Private browsing, blocked third-party storage and disk-full conditions all
 * make localStorage throw on access. A game must still boot in those cases, so
 * every operation degrades to a no-op and `available` reports the truth.
 */
export class LocalStorageDriver implements StorageDriver {
  readonly #storage: Storage | null;

  constructor(storage?: Storage) {
    this.#storage = storage ?? probeLocalStorage();
  }

  get available(): boolean {
    return this.#storage !== null;
  }

  read(key: string): string | null {
    try {
      return this.#storage?.getItem(key) ?? null;
    } catch {
      return null;
    }
  }

  write(key: string, value: string): void {
    try {
      this.#storage?.setItem(key, value);
    } catch (error) {
      console.warn(`[sw2d] could not persist "${key}"`, error);
    }
  }

  remove(key: string): void {
    try {
      this.#storage?.removeItem(key);
    } catch {
      /* ignore */
    }
  }
}

function probeLocalStorage(): Storage | null {
  try {
    const storage = globalThis.localStorage;
    const probeKey = '__sw2d_probe__';
    storage.setItem(probeKey, '1');
    storage.removeItem(probeKey);
    return storage;
  } catch {
    return null;
  }
}

/** In-memory driver for tests and for environments with no usable storage. */
export class MemoryStorageDriver implements StorageDriver {
  readonly available = true;
  readonly #map = new Map<string, string>();

  read(key: string): string | null {
    return this.#map.get(key) ?? null;
  }

  write(key: string, value: string): void {
    this.#map.set(key, value);
  }

  remove(key: string): void {
    this.#map.delete(key);
  }
}
