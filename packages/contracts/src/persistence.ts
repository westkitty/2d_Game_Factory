/**
 * Local-first persistence.
 *
 * No account, no cloud, no network. Saves are namespaced by game id so two
 * generated games hosted on the same origin can never cross-load each other's
 * data, and every stored record carries a schemaVersion.
 */

export interface VersionedRecord {
  readonly schemaVersion: number;
}

/** Minimal storage abstraction. Implementations must never throw on a blocked store. */
export interface StorageDriver {
  readonly available: boolean;
  read(key: string): string | null;
  write(key: string, value: string): void;
  remove(key: string): void;
}

export interface SaveSlotOptions<T extends VersionedRecord> {
  readonly currentVersion: number;
  readonly createDefault: () => T;
  /**
   * Upgrade a stored record from an older schema version.
   * Return null to reject the record; the slot then falls back to defaults.
   * Omitting migrate means any version mismatch is an explicit invalidation.
   */
  readonly migrate?: (stored: unknown, fromVersion: number) => T | null;
}

export type SaveLoadOutcome = 'default' | 'loaded' | 'migrated' | 'invalid' | 'unavailable';

export interface SaveLoadResult<T extends VersionedRecord> {
  readonly value: T;
  readonly outcome: SaveLoadOutcome;
}

export interface SaveStore {
  /** Stable game id. Every key this store touches is prefixed with it. */
  readonly namespace: string;
  load<T extends VersionedRecord>(slot: string, options: SaveSlotOptions<T>): SaveLoadResult<T>;
  save<T extends VersionedRecord>(slot: string, value: T): void;
  clear(slot: string): void;
}

export type TouchControlsMode = 'auto' | 'on' | 'off';

/** Baseline settings every generated game inherits. Presets may hide rows, not remove the model. */
export interface GameSettings extends VersionedRecord {
  readonly masterVolume: number;
  readonly musicVolume: number;
  readonly sfxVolume: number;
  readonly muted: boolean;
  readonly reducedMotion: boolean;
  /** 0..1 multiplier. 0 disables shake entirely. */
  readonly screenShake: number;
  readonly highContrast: boolean;
  readonly touchControls: TouchControlsMode;
}

export interface SettingsStore {
  get(): GameSettings;
  patch(partial: Partial<Omit<GameSettings, 'schemaVersion'>>): GameSettings;
  reset(): GameSettings;
  /** How the persisted settings resolved at boot. Reported in the debug snapshot. */
  readonly loadOutcome: SaveLoadOutcome;
}
