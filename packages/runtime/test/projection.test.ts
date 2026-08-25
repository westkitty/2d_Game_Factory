import { describe, expect, it } from 'vitest';
import { EventBusImpl } from '../src/core/EventBusImpl.ts';
import { AccessibilityStateImpl } from '../src/accessibility/AccessibilityStateImpl.ts';
import { AssetCatalogImpl } from '../src/content/AssetCatalogImpl.ts';
import { MemoryStorageDriver } from '../src/persistence/LocalStorageDriver.ts';
import { SaveStoreImpl } from '../src/persistence/SaveStoreImpl.ts';
import { SettingsStoreImpl } from '../src/persistence/SettingsStoreImpl.ts';

function settingsStore() {
  return new SettingsStoreImpl(
    new SaveStoreImpl('game', new MemoryStorageDriver()),
    new EventBusImpl(),
  );
}

const desktop = { coarsePointer: false, prefersReducedMotion: false };
const phone = { coarsePointer: true, prefersReducedMotion: false };

describe('AccessibilityStateImpl', () => {
  it('tracks settings changes live rather than snapshotting them', () => {
    const settings = settingsStore();
    const state = new AccessibilityStateImpl(settings, desktop);
    expect(state.reducedMotion).toBe(false);

    settings.patch({ reducedMotion: true });

    expect(state.reducedMotion).toBe(true);
  });

  it('honours an OS reduced-motion preference even when the setting is off', () => {
    const state = new AccessibilityStateImpl(settingsStore(), {
      coarsePointer: false,
      prefersReducedMotion: true,
    });

    expect(state.reducedMotion).toBe(true);
  });

  it('forces shake to zero whenever motion is reduced', () => {
    const settings = settingsStore();
    const state = new AccessibilityStateImpl(settings, desktop);
    settings.patch({ screenShake: 1, reducedMotion: true });

    expect(state.screenShakeScale).toBe(0);
  });

  it('shows touch controls on a coarse pointer under the auto policy', () => {
    expect(new AccessibilityStateImpl(settingsStore(), phone).touchControlsVisible).toBe(true);
    expect(new AccessibilityStateImpl(settingsStore(), desktop).touchControlsVisible).toBe(false);
  });

  it('lets an explicit setting override the auto policy in both directions', () => {
    const onDesktop = settingsStore();
    onDesktop.patch({ touchControls: 'on' });
    expect(new AccessibilityStateImpl(onDesktop, desktop).touchControlsVisible).toBe(true);

    const offPhone = settingsStore();
    offPhone.patch({ touchControls: 'off' });
    expect(new AccessibilityStateImpl(offPhone, phone).touchControlsVisible).toBe(false);
  });

  it('reports audio disabled when muted or at zero master volume', () => {
    const settings = settingsStore();
    const state = new AccessibilityStateImpl(settings, desktop);
    expect(state.audioEnabled).toBe(true);

    settings.patch({ muted: true });
    expect(state.audioEnabled).toBe(false);

    settings.patch({ muted: false, masterVolume: 0 });
    expect(state.audioEnabled).toBe(false);
  });
});

describe('AssetCatalogImpl', () => {
  const catalog = new AssetCatalogImpl([
    { role: 'player', key: 'placeholder/player', spec: { kind: 'generated', width: 8, height: 8, fill: '#fff' } },
  ]);

  it('resolves a semantic role to a texture key', () => {
    expect(catalog.resolve('player')).toBe('placeholder/player');
  });

  it('names the missing role and what the bundle does supply', () => {
    expect(() => catalog.resolve('enemy')).toThrow(/"enemy"/);
    expect(() => catalog.resolve('enemy')).toThrow(/player/);
  });
});
