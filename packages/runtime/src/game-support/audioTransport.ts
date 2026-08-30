import type { AudioTransport, TransportState } from '@sw2d/contracts';

/**
 * Playback position, as the audio hardware sees it (post-ten program Phase 17).
 *
 * This is the runtime half of the Phase 17 split: the contract says "judge
 * against the transport", and this is what a browser transport actually is.
 *
 * `AudioContext.currentTime` is used deliberately in preference to
 * `performance.now()`. The two drift apart - the audio clock is driven by the
 * output device, the page clock is not - and a note judged against the page
 * clock is judged against something the player cannot hear. The audio clock also
 * behaves correctly under tab throttling, where a page timer does not.
 *
 * Where Web Audio is unavailable the transport degrades to a monotonic
 * `performance.now()` fallback rather than throwing, and says so through
 * `usingAudioClock`. That is honest and playable, not silently equivalent: a
 * game can surface "timing may drift" if it cares.
 */
export class BrowserAudioTransport implements AudioTransport {
  readonly #context: AudioContext | null;
  #state: TransportState = 'idle';
  /** Transport-clock reading when the current playing span began. */
  #spanStart = 0;
  /** Milliseconds accumulated by spans that have already ended. */
  #accumulatedMs = 0;
  #disposed = false;

  constructor(context: AudioContext | null) {
    this.#context = context;
  }

  /** False when Web Audio was unavailable and the page clock is standing in. */
  get usingAudioClock(): boolean {
    return this.#context !== null;
  }

  get state(): TransportState {
    return this.#state;
  }

  /** The raw clock, in milliseconds. Monotonic; never read by gameplay directly. */
  #now(): number {
    if (this.#context) return this.#context.currentTime * 1000;
    return typeof performance !== 'undefined' ? performance.now() : 0;
  }

  currentTimeMs(): number {
    if (this.#state !== 'playing') return this.#accumulatedMs;
    // Clamp at zero: a clock that appeared to move backwards must never let a
    // judged note be re-judged by a rewind.
    const span = this.#now() - this.#spanStart;
    return this.#accumulatedMs + (span > 0 ? span : 0);
  }

  start(): void {
    if (this.#disposed) return;
    this.#accumulatedMs = 0;
    this.#spanStart = this.#now();
    this.#state = 'playing';
  }

  pause(): void {
    if (this.#disposed || this.#state !== 'playing') return;
    this.#accumulatedMs = this.currentTimeMs();
    this.#state = 'paused';
  }

  resume(): void {
    if (this.#disposed || this.#state !== 'paused') return;
    this.#spanStart = this.#now();
    this.#state = 'playing';
  }

  stop(): void {
    if (this.#disposed) return;
    this.#accumulatedMs = this.currentTimeMs();
    this.#state = 'stopped';
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#state = 'stopped';
  }
}

/**
 * A transport driven by hand.
 *
 * Not a mock of the browser one - the same contract, with the clock supplied
 * instead of sampled. Automated QA and unit tests advance it explicitly, which
 * is what makes a rhythm assertion exact rather than timing-dependent.
 */
export class ManualAudioTransport implements AudioTransport {
  #state: TransportState = 'idle';
  #timeMs = 0;
  #disposed = false;

  get state(): TransportState {
    return this.#state;
  }

  currentTimeMs(): number {
    return this.#timeMs;
  }

  /** Advance the transport. Ignored unless playing, exactly like real playback. */
  advance(deltaMs: number): void {
    if (this.#disposed || this.#state !== 'playing' || deltaMs <= 0) return;
    this.#timeMs += deltaMs;
  }

  /** Jump straight to a position. For setting up a case, not for gameplay. */
  seek(timeMs: number): void {
    if (this.#disposed) return;
    this.#timeMs = timeMs < 0 ? 0 : timeMs;
  }

  start(): void {
    if (this.#disposed) return;
    this.#timeMs = 0;
    this.#state = 'playing';
  }

  pause(): void {
    if (this.#disposed || this.#state !== 'playing') return;
    this.#state = 'paused';
  }

  resume(): void {
    if (this.#disposed || this.#state !== 'paused') return;
    this.#state = 'playing';
  }

  stop(): void {
    if (this.#disposed) return;
    this.#state = 'stopped';
  }

  dispose(): void {
    this.#disposed = true;
    this.#state = 'stopped';
  }
}

/**
 * Build the transport a generated game should use.
 *
 * Prefers the live `AudioContext` the audio bus already owns, so the chart is
 * judged against the same clock the music plays on rather than a second one.
 */
export function createAudioTransport(context: AudioContext | null | undefined): BrowserAudioTransport {
  return new BrowserAudioTransport(context ?? null);
}
