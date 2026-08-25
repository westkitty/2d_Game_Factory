import type {
  SaveLoadResult,
  SaveSlotOptions,
  SaveStore,
  StorageDriver,
  VersionedRecord,
} from '@sw2d/contracts';

/**
 * Namespaced, versioned, corruption-tolerant local saves.
 *
 * Keys are `sw2d:<gameId>:<slot>`, so two generated games served from the same
 * origin can never read each other's data. A record whose schemaVersion does not
 * match is migrated, or explicitly invalidated - never silently reinterpreted.
 */
export class SaveStoreImpl implements SaveStore {
  readonly namespace: string;
  readonly #driver: StorageDriver;

  constructor(namespace: string, driver: StorageDriver) {
    this.namespace = namespace;
    this.#driver = driver;
  }

  #key(slot: string): string {
    return `sw2d:${this.namespace}:${slot}`;
  }

  load<T extends VersionedRecord>(slot: string, options: SaveSlotOptions<T>): SaveLoadResult<T> {
    if (!this.#driver.available) {
      return { value: options.createDefault(), outcome: 'unavailable' };
    }

    const raw = this.#driver.read(this.#key(slot));
    if (raw === null) return { value: options.createDefault(), outcome: 'default' };

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      console.warn(`[sw2d] save slot "${slot}" is not valid JSON; falling back to defaults`);
      this.#driver.remove(this.#key(slot));
      return { value: options.createDefault(), outcome: 'invalid' };
    }

    if (typeof parsed !== 'object' || parsed === null) {
      this.#driver.remove(this.#key(slot));
      return { value: options.createDefault(), outcome: 'invalid' };
    }

    const storedVersion = (parsed as Partial<VersionedRecord>).schemaVersion;
    if (storedVersion === options.currentVersion) {
      return { value: parsed as T, outcome: 'loaded' };
    }

    if (typeof storedVersion === 'number' && options.migrate) {
      const migrated = options.migrate(parsed, storedVersion);
      if (migrated) {
        this.save(slot, migrated);
        return { value: migrated, outcome: 'migrated' };
      }
    }

    console.warn(
      `[sw2d] save slot "${slot}" has schemaVersion ${String(storedVersion)}, expected ` +
        `${options.currentVersion}; discarding.`,
    );
    this.#driver.remove(this.#key(slot));
    return { value: options.createDefault(), outcome: 'invalid' };
  }

  save<T extends VersionedRecord>(slot: string, value: T): void {
    this.#driver.write(this.#key(slot), JSON.stringify(value));
  }

  clear(slot: string): void {
    this.#driver.remove(this.#key(slot));
  }
}
