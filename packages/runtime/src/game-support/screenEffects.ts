/**
 * Screen effects service for visual feedback.
 *
 * Provides screen shake, flash effects, and other visual feedback mechanisms
 * that enhance game feel. Effects are time-based and automatically decay.
 *
 * This is renderer-agnostic - it produces effect state that the game's
 * rendering layer can read and apply.
 */

export interface ScreenEffect {
  readonly type: 'shake' | 'flash' | 'slowmo' | 'zoom';
  readonly intensity: number;
  readonly durationMs: number;
  elapsedMs: number;
  readonly color?: string;
}

export interface ScreenEffectsService {
  /** Get the current active effects. */
  readonly activeEffects: readonly ScreenEffect[];

  /** Trigger a screen shake. */
  shake(intensity: number, durationMs: number): void;

  /** Trigger a screen flash. */
  flash(color: string, durationMs: number): void;

  /** Trigger slow motion. */
  slowMotion(factor: number, durationMs: number): void;

  /** Trigger a zoom pulse. */
  zoomPulse(intensity: number, durationMs: number): void;

  /** Advance all effects by delta time. */
  update(deltaMs: number): void;

  /** Clear all active effects. */
  clear(): void;

  /** Check if any effects are active. */
  readonly hasActiveEffects: boolean;

  /** Get the current shake offset (x, y). */
  getShakeOffset(): { x: number; y: number };

  /** Get the current time scale (1.0 = normal, <1.0 = slow). */
  readonly timeScale: number;
}

/**
 * Creates a screen effects service.
 *
 * Pure and deterministic - effects decay based on supplied delta time,
 * not wall clock time.
 */
export function createScreenEffectsService(): ScreenEffectsService {
  const effects: ScreenEffect[] = [];

  function shake(intensity: number, durationMs: number): void {
    effects.push({
      type: 'shake',
      intensity: Math.max(0, intensity),
      durationMs: Math.max(0, durationMs),
      elapsedMs: 0,
    });
  }

  function flash(color: string, durationMs: number): void {
    effects.push({
      type: 'flash',
      intensity: 1.0,
      durationMs: Math.max(0, durationMs),
      elapsedMs: 0,
      color,
    });
  }

  function slowMotion(factor: number, durationMs: number): void {
    effects.push({
      type: 'slowmo',
      intensity: Math.max(0, Math.min(1, factor)),
      durationMs: Math.max(0, durationMs),
      elapsedMs: 0,
    });
  }

  function zoomPulse(intensity: number, durationMs: number): void {
    effects.push({
      type: 'zoom',
      intensity: Math.max(0, intensity),
      durationMs: Math.max(0, durationMs),
      elapsedMs: 0,
    });
  }

  function update(deltaMs: number): void {
    for (const effect of effects) {
      effect.elapsedMs += deltaMs;
    }
    // Remove expired effects
    for (let i = effects.length - 1; i >= 0; i--) {
      if (effects[i]!.elapsedMs >= effects[i]!.durationMs) {
        effects.splice(i, 1);
      }
    }
  }

  function clear(): void {
    effects.length = 0;
  }

  function getShakeOffset(): { x: number; y: number } {
    let totalX = 0;
    let totalY = 0;

    for (const effect of effects) {
      if (effect.type !== 'shake') continue;
      const progress = effect.elapsedMs / effect.durationMs;
      const decay = 1 - progress;
      const currentIntensity = effect.intensity * decay;

      // Simple pseudo-random shake using sine waves
      const time = effect.elapsedMs * 0.05;
      totalX += Math.sin(time * 13.7) * currentIntensity;
      totalY += Math.cos(time * 17.3) * currentIntensity;
    }

    return { x: totalX, y: totalY };
  }

  function getTimeScale(): number {
    let scale = 1.0;

    for (const effect of effects) {
      if (effect.type !== 'slowmo') continue;
      const progress = effect.elapsedMs / effect.durationMs;
      const decay = 1 - progress;
      const currentFactor = effect.intensity * decay;
      scale = Math.min(scale, currentFactor);
    }

    return scale;
  }

  return {
    get activeEffects() {
      return effects;
    },
    shake,
    flash,
    slowMotion,
    zoomPulse,
    update,
    clear,
    get hasActiveEffects() {
      return effects.length > 0;
    },
    getShakeOffset,
    get timeScale() {
      return getTimeScale();
    },
  };
}
