/**
 * Visual timing windows (Category-C capability program, Wave 10).
 *
 * Renderer-neutral reaction-test and beat-window state. Two bounded modes
 * (not two engines):
 *   - `reaction` — one-shot deterministic delays; too-early is a miss;
 *     latency inside `windowMs` is a hit.
 *   - `rhythm`   — periodic visual beats (offset + period); hit inside the
 *     window, miss when the window closes without a press.
 *
 * Not a music-beat / audio-synchronization system. Not folded into
 * `sw2d.arcade` (elapsed/score only).
 */

export const TIMING_CAPABILITY_ID = 'arcade.timing';

export type TimingMode = 'reaction' | 'rhythm';
export type TimingOutcome = 'playing' | 'complete' | 'failed';
export type TimingPhase = 'wait' | 'go' | 'complete' | 'failed';

export interface TimingReactionDef {
  readonly delaysMs: readonly number[];
  readonly maxWaitMs: number;
}

export interface TimingRhythmDef {
  readonly periodMs: number;
  readonly offsetMs: number;
  readonly beats: number;
}

/** The validated `content/timing.json` document. */
export interface TimingCatalog {
  readonly schemaVersion: number;
  readonly mode: TimingMode;
  readonly windowMs: number;
  readonly hitsToWin: number;
  readonly missesToFail: number;
  readonly reaction?: TimingReactionDef;
  readonly rhythm?: TimingRhythmDef;
}

export interface TimingService {
  mode(): TimingMode;
  /** False when hitsToWin is 0 or the mode's schedule is empty. */
  active(): boolean;
  tick(deltaMs: number): void;
  hit(): void;
  phase(): TimingPhase;
  windowOpen(): boolean;
  elapsedMs(): number;
  hits(): number;
  misses(): number;
  lastResult(): string | null;
  lastLatencyMs(): number | null;
  nextBeatInMs(): number | null;
  cueIndex(): number;
  outcome(): TimingOutcome;
  reset(): void;
}
