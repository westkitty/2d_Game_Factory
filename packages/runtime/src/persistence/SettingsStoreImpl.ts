import type { EventBus, GameSettings, SaveLoadOutcome, SaveStore, SettingsStore } from '@sw2d/contracts';

export const SETTINGS_SCHEMA_VERSION = 1;
export const SETTINGS_SLOT = 'settings';

export const FACTORY_DEFAULT_SETTINGS: GameSettings = {
  schemaVersion: SETTINGS_SCHEMA_VERSION,
  masterVolume: 0.8,
  musicVolume: 0.6,
  sfxVolume: 0.8,
  muted: false,
  reducedMotion: false,
  screenShake: 1,
  highContrast: false,
  touchControls: 'auto',
};

const clamp01 = (value: number): number => (value < 0 ? 0 : value > 1 ? 1 : value);

/** Coerce anything loaded from storage into a valid settings record. */
export function normaliseSettings(input: Partial<GameSettings>): GameSettings {
  const merged = { ...FACTORY_DEFAULT_SETTINGS, ...input };
  return {
    schemaVersion: SETTINGS_SCHEMA_VERSION,
    masterVolume: clamp01(Number(merged.masterVolume) || 0),
    musicVolume: clamp01(Number(merged.musicVolume) || 0),
    sfxVolume: clamp01(Number(merged.sfxVolume) || 0),
    muted: Boolean(merged.muted),
    reducedMotion: Boolean(merged.reducedMotion),
    screenShake: clamp01(Number(merged.screenShake) || 0),
    highContrast: Boolean(merged.highContrast),
    touchControls:
      merged.touchControls === 'on' || merged.touchControls === 'off'
        ? merged.touchControls
        : 'auto',
  };
}

/**
 * Persisted settings with change notification.
 *
 * Settings are the single source of truth for volume and accessibility; the
 * accessibility projection and the audio bus both derive from here rather than
 * keeping their own copies.
 */
export class SettingsStoreImpl implements SettingsStore {
  readonly #saves: SaveStore;
  readonly #events: EventBus;
  readonly #defaults: GameSettings;
  #value: GameSettings;
  readonly loadOutcome: SaveLoadOutcome;

  constructor(
    saves: SaveStore,
    events: EventBus,
    defaults: Partial<Omit<GameSettings, 'schemaVersion'>> = {},
  ) {
    this.#saves = saves;
    this.#events = events;
    this.#defaults = normaliseSettings(defaults as Partial<GameSettings>);
    const result = saves.load<GameSettings>(SETTINGS_SLOT, {
      currentVersion: SETTINGS_SCHEMA_VERSION,
      createDefault: () => this.#defaults,
    });
    this.#value = normaliseSettings(result.value);
    this.loadOutcome = result.outcome;
  }

  get(): GameSettings {
    return this.#value;
  }

  patch(partial: Partial<Omit<GameSettings, 'schemaVersion'>>): GameSettings {
    this.#value = normaliseSettings({ ...this.#value, ...partial });
    this.#saves.save(SETTINGS_SLOT, this.#value);
    this.#events.emit('settings:changed', { reason: 'patch' });
    return this.#value;
  }

  reset(): GameSettings {
    this.#value = this.#defaults;
    this.#saves.save(SETTINGS_SLOT, this.#value);
    this.#events.emit('settings:changed', { reason: 'reset' });
    return this.#value;
  }
}
