import { describe, expect, it, vi } from 'vitest';
import type { GameSettings, VersionedRecord } from '@sw2d/contracts';
import { EventBusImpl } from '../src/core/EventBusImpl.ts';
import { MemoryStorageDriver } from '../src/persistence/LocalStorageDriver.ts';
import { SaveStoreImpl } from '../src/persistence/SaveStoreImpl.ts';
import {
  FACTORY_DEFAULT_SETTINGS,
  SETTINGS_SCHEMA_VERSION,
  SettingsStoreImpl,
  normaliseSettings,
} from '../src/persistence/SettingsStoreImpl.ts';

interface Progress extends VersionedRecord {
  readonly level: number;
}

const progressOptions = {
  currentVersion: 2,
  createDefault: (): Progress => ({ schemaVersion: 2, level: 1 }),
};

describe('SaveStoreImpl', () => {
  it('namespaces keys by game id so two games cannot cross-load', () => {
    const driver = new MemoryStorageDriver();
    const first = new SaveStoreImpl('game-a', driver);
    const second = new SaveStoreImpl('game-b', driver);

    first.save('progress', { schemaVersion: 2, level: 7 } satisfies Progress);

    expect(second.load<Progress>('progress', progressOptions).value.level).toBe(1);
    expect(first.load<Progress>('progress', progressOptions).value.level).toBe(7);
  });

  it('returns defaults for an empty slot', () => {
    const store = new SaveStoreImpl('game', new MemoryStorageDriver());

    expect(store.load<Progress>('progress', progressOptions).outcome).toBe('default');
  });

  it('recovers from corrupt JSON instead of throwing', () => {
    const driver = new MemoryStorageDriver();
    driver.write('sw2d:game:progress', '{not json');
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const store = new SaveStoreImpl('game', driver);

    const result = store.load<Progress>('progress', progressOptions);

    expect(result.outcome).toBe('invalid');
    expect(result.value.level).toBe(1);
    expect(driver.read('sw2d:game:progress')).toBeNull();
  });

  it('discards a record from an older schema when no migration exists', () => {
    const driver = new MemoryStorageDriver();
    driver.write('sw2d:game:progress', JSON.stringify({ schemaVersion: 1, level: 9 }));
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const store = new SaveStoreImpl('game', driver);

    const result = store.load<Progress>('progress', progressOptions);

    expect(result.outcome).toBe('invalid');
    expect(result.value.level).toBe(1);
  });

  it('migrates an older record and writes the upgraded version back', () => {
    const driver = new MemoryStorageDriver();
    driver.write('sw2d:game:progress', JSON.stringify({ schemaVersion: 1, stage: 4 }));
    const store = new SaveStoreImpl('game', driver);

    const result = store.load<Progress>('progress', {
      ...progressOptions,
      migrate: (stored) => ({ schemaVersion: 2, level: (stored as { stage: number }).stage }),
    });

    expect(result.outcome).toBe('migrated');
    expect(result.value.level).toBe(4);
    expect(JSON.parse(driver.read('sw2d:game:progress')!)).toEqual({ schemaVersion: 2, level: 4 });
  });

  it('reports unavailable storage without throwing', () => {
    const blocked = { available: false, read: () => null, write: () => undefined, remove: () => undefined };
    const store = new SaveStoreImpl('game', blocked);

    expect(store.load<Progress>('progress', progressOptions).outcome).toBe('unavailable');
  });
});

describe('normaliseSettings', () => {
  it('clamps volumes and shake into 0..1', () => {
    const settings = normaliseSettings({ masterVolume: 5, screenShake: -2 } as Partial<GameSettings>);

    expect(settings.masterVolume).toBe(1);
    expect(settings.screenShake).toBe(0);
  });

  it('falls back to auto for an unknown touch-control mode', () => {
    const settings = normaliseSettings({ touchControls: 'sometimes' } as unknown as Partial<GameSettings>);

    expect(settings.touchControls).toBe('auto');
  });

  it('always stamps the current schema version', () => {
    const settings = normaliseSettings({ schemaVersion: 99 } as Partial<GameSettings>);

    expect(settings.schemaVersion).toBe(SETTINGS_SCHEMA_VERSION);
  });
});

describe('SettingsStoreImpl', () => {
  it('persists a patch and reloads it on the next boot', () => {
    const driver = new MemoryStorageDriver();
    const events = new EventBusImpl();
    const first = new SettingsStoreImpl(new SaveStoreImpl('game', driver), events);

    first.patch({ reducedMotion: true, masterVolume: 0.25 });

    const second = new SettingsStoreImpl(new SaveStoreImpl('game', driver), events);
    expect(second.get().reducedMotion).toBe(true);
    expect(second.get().masterVolume).toBe(0.25);
    expect(second.loadOutcome).toBe('loaded');
  });

  it('emits settings:changed on patch and on reset', () => {
    const events = new EventBusImpl();
    const reasons: string[] = [];
    events.on('settings:changed', (payload) => reasons.push(payload.reason));
    const store = new SettingsStoreImpl(new SaveStoreImpl('game', new MemoryStorageDriver()), events);

    store.patch({ muted: true });
    store.reset();

    expect(reasons).toEqual(['patch', 'reset']);
  });

  it('resets to the game defaults, not the factory defaults', () => {
    const events = new EventBusImpl();
    const store = new SettingsStoreImpl(
      new SaveStoreImpl('game', new MemoryStorageDriver()),
      events,
      { masterVolume: 0.3 },
    );

    store.patch({ masterVolume: 1 });

    expect(store.reset().masterVolume).toBe(0.3);
    expect(FACTORY_DEFAULT_SETTINGS.masterVolume).toBe(0.8);
  });
});
