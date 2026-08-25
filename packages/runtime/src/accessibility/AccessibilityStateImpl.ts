import type { AccessibilityState, SettingsStore } from '@sw2d/contracts';

export interface AccessibilityEnvironment {
  /** True when the primary pointer is coarse (phone/tablet). */
  readonly coarsePointer: boolean;
  /** True when the OS asks for reduced motion. */
  readonly prefersReducedMotion: boolean;
}

/** Read the environment through media queries, tolerating environments without them. */
export function readAccessibilityEnvironment(): AccessibilityEnvironment {
  const query = (value: string): boolean => {
    try {
      return globalThis.matchMedia?.(value).matches ?? false;
    } catch {
      return false;
    }
  };
  return {
    coarsePointer: query('(pointer: coarse)'),
    prefersReducedMotion: query('(prefers-reduced-motion: reduce)'),
  };
}

/**
 * Live read-only projection of settings plus device capability.
 *
 * Deliberately derived rather than stored: there is exactly one place a game can
 * change accessibility (settings), so a theme or preset can hide a row without
 * being able to desynchronise the state.
 */
export class AccessibilityStateImpl implements AccessibilityState {
  readonly #settings: SettingsStore;
  #environment: AccessibilityEnvironment;

  constructor(settings: SettingsStore, environment = readAccessibilityEnvironment()) {
    this.#settings = settings;
    this.#environment = environment;
  }

  /** Re-read media queries, e.g. after the OS preference changes. */
  refreshEnvironment(environment = readAccessibilityEnvironment()): void {
    this.#environment = environment;
  }

  get reducedMotion(): boolean {
    return this.#settings.get().reducedMotion || this.#environment.prefersReducedMotion;
  }

  get screenShakeScale(): number {
    return this.reducedMotion ? 0 : this.#settings.get().screenShake;
  }

  get highContrast(): boolean {
    return this.#settings.get().highContrast;
  }

  get coarsePointer(): boolean {
    return this.#environment.coarsePointer;
  }

  get touchControlsVisible(): boolean {
    const mode = this.#settings.get().touchControls;
    if (mode === 'on') return true;
    if (mode === 'off') return false;
    return this.#environment.coarsePointer;
  }

  get audioEnabled(): boolean {
    const settings = this.#settings.get();
    return !settings.muted && settings.masterVolume > 0;
  }

  /** Plain snapshot for the debug API and for serialisation. */
  toJSON(): AccessibilityState {
    return {
      reducedMotion: this.reducedMotion,
      screenShakeScale: this.screenShakeScale,
      highContrast: this.highContrast,
      coarsePointer: this.coarsePointer,
      touchControlsVisible: this.touchControlsVisible,
      audioEnabled: this.audioEnabled,
    };
  }
}
