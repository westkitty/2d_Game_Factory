/**
 * A lightweight tween/animation system for generated games.
 *
 * Provides property animation with easing functions, chaining, and
 * callbacks. Pure math - no rendering dependency.
 *
 * Usage:
 * ```
 * const tweens = createTweenManager();
 * tweens.add({ target: sprite, props: { x: 100, y: 200 }, duration: 500, easing: 'easeOut' });
 * // In game loop:
 * tweens.update(deltaMs);
 * ```
 */

export type EasingFunction = (t: number) => number;

export const Easing = {
  linear: (t: number): number => t,
  easeIn: (t: number): number => t * t,
  easeOut: (t: number): number => t * (2 - t),
  easeInOut: (t: number): number => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t),
  easeInCubic: (t: number): number => t * t * t,
  easeOutCubic: (t: number): number => (--t) * t * t + 1,
  easeOutBounce: (t: number): number => {
    if (t < 1 / 2.75) return 7.5625 * t * t;
    if (t < 2 / 2.75) return 7.5625 * (t -= 1.5 / 2.75) * t + 0.75;
    if (t < 2.5 / 2.75) return 7.5625 * (t -= 2.25 / 2.75) * t + 0.9375;
    return 7.5625 * (t -= 2.625 / 2.75) * t + 0.984375;
  },
  easeOutElastic: (t: number): number => {
    if (t === 0 || t === 1) return t;
    return Math.pow(2, -10 * t) * Math.sin((t - 0.1) * 5 * Math.PI) + 1;
  },
} as const;

export interface TweenConfig {
  readonly duration: number;
  readonly easing?: keyof typeof Easing | EasingFunction;
  readonly delay?: number;
  readonly repeat?: number;
  readonly yoyo?: boolean;
  readonly onComplete?: () => void;
  readonly onUpdate?: (progress: number) => void;
}

export interface Tween {
  readonly id: number;
  isComplete: boolean;
  progress: number;
  update(deltaMs: number): void;
  stop(): void;
}

export interface TweenManager {
  /** Add a tween that animates numeric properties on a target. */
  add<T extends Record<string, number>>(
    target: T,
    props: Partial<Record<keyof T, number>>,
    config: TweenConfig,
  ): Tween;

  /** Update all active tweens. Call once per frame. */
  update(deltaMs: number): void;

  /** Stop all tweens. */
  stopAll(): void;

  /** Get the number of active tweens. */
  readonly count: number;
}

/**
 * Creates a tween manager.
 */
export function createTweenManager(): TweenManager {
  const tweens: InternalTween[] = [];
  let nextId = 1;

  interface InternalTween extends Tween {
    target: Record<string, number>;
    startValues: Record<string, number>;
    endValues: Record<string, number>;
    elapsed: number;
    duration: number;
    delay: number;
    easing: EasingFunction;
    repeat: number;
    repeatCount: number;
    yoyo: boolean;
    forward: boolean;
    onComplete: (() => void) | undefined;
    onUpdate: ((progress: number) => void) | undefined;
    stopped: boolean;
  }

  function add<T extends Record<string, number>>(
    target: T,
    props: Partial<Record<keyof T, number>>,
    config: TweenConfig,
  ): Tween {
    const startValues: Record<string, number> = {};
    const endValues: Record<string, number> = {};

    for (const key of Object.keys(props)) {
      const value = (props as Record<string, number | undefined>)[key];
      if (value !== undefined) {
        startValues[key] = (target as Record<string, number>)[key] ?? 0;
        endValues[key] = value;
      }
    }

    const easing = typeof config.easing === 'function'
      ? config.easing
      : config.easing ? Easing[config.easing] : Easing.linear;

    const tween = {
      id: nextId++,
      target: target as unknown as Record<string, number>,
      startValues,
      endValues,
      elapsed: 0,
      duration: config.duration,
      delay: config.delay ?? 0,
      easing,
      repeat: config.repeat ?? 0,
      repeatCount: 0,
      yoyo: config.yoyo ?? false,
      forward: true,
      onComplete: config.onComplete,
      onUpdate: config.onUpdate,
      stopped: false,
      isComplete: false,
      progress: 0,
      update(deltaMs: number): void {
        if (this.stopped || this.isComplete) return;

        if (this.delay > 0) {
          const consumed = Math.min(deltaMs, this.delay);
          this.delay -= consumed;
          deltaMs -= consumed;
          if (deltaMs <= 0) return;
        }

        this.elapsed += deltaMs;
        let t = Math.min(1, this.elapsed / this.duration);
        const easedT = this.easing(this.forward ? t : 1 - t);

        // Interpolate properties
        for (const key of Object.keys(this.endValues)) {
          const start = this.startValues[key]!;
          const end = this.endValues[key]!;
          this.target[key] = start + (end - start) * easedT;
        }

        this.progress = t;
        this.onUpdate?.(t);

        if (t >= 1) {
          if (this.yoyo) {
            this.forward = !this.forward;
            this.elapsed = 0;
          } else if (this.repeatCount < this.repeat) {
            this.repeatCount++;
            this.elapsed = 0;
          } else {
            this.isComplete = true;
            this.onComplete?.();
          }
        }
      },
      stop(): void {
        this.stopped = true;
        this.isComplete = true;
      },
    };

    tweens.push(tween);
    return tween;
  }

  function update(deltaMs: number): void {
    for (let i = tweens.length - 1; i >= 0; i--) {
      tweens[i]!.update(deltaMs);
      if (tweens[i]!.isComplete) {
        tweens.splice(i, 1);
      }
    }
  }

  function stopAll(): void {
    for (const tween of tweens) tween.stop();
    tweens.length = 0;
  }

  return {
    add,
    update,
    stopAll,
    get count() {
      return tweens.length;
    },
  };
}
