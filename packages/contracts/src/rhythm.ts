/**
 * Rhythm, beat & precision timing (post-ten program Phase 17).
 *
 * Two capabilities:
 *
 * - `arcade.rhythm` judges semantic input against an authored chart, on a
 *   **transport** clock rather than a wall clock.
 * - `arcade.reaction` runs the small, seeded state machine a reaction test needs
 *   (wait, stimulus, response, false start), on simulation time.
 *
 * ## Why a transport, and why it is the only authority
 *
 * `Date.now()` and `performance.now()` both measure the wrong thing for music.
 * They drift against the audio hardware's own clock, they keep running while a
 * tab is throttled, and they know nothing about a pause. A note judged against
 * them is judged against something the player cannot hear.
 *
 * So the chart is judged against `AudioTransport.currentTimeMs()` - the position
 * of the music itself. The browser implementation reads `AudioContext.currentTime`;
 * a test injects a deterministic transport and steps it by hand. Nothing in this
 * file, and nothing in the judge, ever reads a clock directly.
 *
 * Scheduling callbacks (`setTimeout`, `setInterval`, a lookahead scheduler) may
 * *trigger* work early, but the transport position remains the authority for
 * what time it is. A callback that fires late must not shift the chart.
 */

import type { ActionId } from './actions.ts';
import type { Disposable } from './disposable.ts';
import type { SeededRng } from './generation.ts';

export const RHYTHM_CAPABILITY_ID = 'arcade.rhythm';
export const REACTION_CAPABILITY_ID = 'arcade.reaction';

// --- Transport -----------------------------------------------------------

export type TransportState = 'idle' | 'playing' | 'paused' | 'stopped';

/**
 * A playback position, renderer- and browser-neutral.
 *
 * Implementations must report a position that does not advance while paused and
 * does not jump backwards, so a judged note can never be re-judged by a rewind.
 */
export interface AudioTransport extends Disposable {
  readonly state: TransportState;
  /** Milliseconds since playback began, excluding paused time. */
  currentTimeMs(): number;
  start(): void;
  pause(): void;
  resume(): void;
  stop(): void;
}

// --- Chart ---------------------------------------------------------------

export interface JudgementWindows {
  readonly perfectMs: number;
  readonly goodMs: number;
  /** Beyond this a note is missed outright; input this far away judges nothing. */
  readonly missMs: number;
}

/**
 * One note. Position is authored either in absolute milliseconds or in beats;
 * beats are converted deterministically against the chart's `bpm` and `offsetMs`.
 */
export interface RhythmNote {
  readonly id: string;
  readonly timeMs?: number;
  readonly beat?: number;
  /** The semantic action that hits this note. Never a key code. */
  readonly action: ActionId;
  /** Optional lane, for charts that place several notes at the same instant. */
  readonly lane?: string;
  /** Reserved for held notes. Present in the model; not yet judged as a hold. */
  readonly holdMs?: number;
}

export interface RhythmChart {
  readonly schemaVersion: 1;
  readonly id: string;
  /** Semantic role of the music track this chart is written against. */
  readonly audioRole: string;
  readonly bpm: number;
  /** Shifts every beat-authored note. Does not affect `timeMs` notes. */
  readonly offsetMs: number;
  readonly judgementWindows: JudgementWindows;
  readonly notes: readonly RhythmNote[];
}

export interface RhythmDocument {
  readonly schemaVersion: 1;
  readonly charts: readonly RhythmChart[];
  /**
   * Player-facing calibration, in milliseconds, added to every input timestamp.
   * Positive means "this player reads as late, compensate".
   */
  readonly calibrationMs?: number;
}

/** Milliseconds per beat at a given tempo. */
export function msPerBeat(bpm: number): number {
  return 60000 / bpm;
}

/**
 * Absolute chart time for a note. A `timeMs` note is taken literally; a `beat`
 * note is converted against tempo and offset. A note with both is a content
 * error the validator rejects, so this never has to guess.
 */
export function noteTimeMs(note: RhythmNote, bpm: number, offsetMs: number): number {
  if (note.timeMs !== undefined) return note.timeMs;
  return offsetMs + (note.beat ?? 0) * msPerBeat(bpm);
}

// --- Judgement -----------------------------------------------------------

export type Judgement = 'perfect' | 'good' | 'miss';

export interface JudgedNote {
  readonly noteId: string;
  readonly action: ActionId;
  readonly lane: string | null;
  readonly judgement: Judgement;
  /** Input time minus note time. Negative is early, positive is late. */
  readonly deltaMs: number;
  /** Chart time at which the judgement was made. */
  readonly atMs: number;
}

/** What an input produced. `'none'` means nothing was in range; no note was consumed. */
export type RhythmInputOutcome =
  | { readonly kind: 'judged'; readonly result: JudgedNote }
  | { readonly kind: 'none'; readonly atMs: number };

export interface RhythmScore {
  readonly perfect: number;
  readonly good: number;
  readonly miss: number;
  readonly combo: number;
  readonly maxCombo: number;
  readonly score: number;
  /** Judged notes hit (perfect or good) over notes judged so far, 0..1. */
  readonly accuracy: number;
}

export type RhythmChartStatus = 'idle' | 'playing' | 'paused' | 'finished';

export interface RhythmState {
  readonly chartId: string | null;
  readonly status: RhythmChartStatus;
  readonly timeMs: number;
  readonly score: RhythmScore;
  readonly notesTotal: number;
  readonly notesJudged: number;
  readonly notesRemaining: number;
  /** Notes whose time is within the lookahead window, for a renderer to draw. */
  readonly upcoming: readonly { readonly noteId: string; readonly action: ActionId; readonly lane: string | null; readonly timeMs: number }[];
}

/** Points awarded per judgement. Fixed so a chart cannot inflate its own score. */
export const RHYTHM_JUDGEMENT_POINTS: Readonly<Record<Judgement, number>> = {
  perfect: 100,
  good: 50,
  miss: 0,
};

export interface RhythmService {
  load(chartId: string): void;
  chart(): RhythmChart | undefined;
  state(): RhythmState;
  status(): RhythmChartStatus;

  start(): void;
  pause(): void;
  resume(): void;
  stop(): void;

  /**
   * Judge a semantic press at the current transport position.
   *
   * Picks the nearest unjudged note matching the action (and lane, when the
   * input names one) inside the miss window. A note is judged at most once,
   * ever - the service, not the caller, owns that guarantee.
   */
  press(action: ActionId, lane?: string): RhythmInputOutcome;

  /**
   * Advance chart bookkeeping: expire notes whose miss window has closed and
   * refresh the upcoming list. Returns what expired this call.
   */
  tick(): readonly JudgedNote[];

  score(): RhythmScore;
  /** Every judgement so far, in the order it was made. */
  judged(): readonly JudgedNote[];
  /** Bounded player calibration offset, added to every input timestamp. */
  calibrationMs(): number;
  setCalibrationMs(value: number): void;
  reset(): void;
}

// --- Reaction ------------------------------------------------------------

export type ReactionPhase = 'ready' | 'wait' | 'stimulus' | 'response' | 'false-start' | 'result' | 'summary';

export interface ReactionRoundResult {
  readonly round: number;
  readonly falseStart: boolean;
  /** Null for a false start - there was no stimulus to react to. */
  readonly reactionMs: number | null;
}

export interface ReactionSummary {
  readonly rounds: number;
  readonly completed: number;
  readonly falseStarts: number;
  readonly bestMs: number | null;
  readonly averageMs: number | null;
  readonly results: readonly ReactionRoundResult[];
}

export interface ReactionConfig {
  readonly rounds: number;
  readonly minWaitMs: number;
  readonly maxWaitMs: number;
  /** Seeds the wait draw. Never `Math.random`. */
  readonly seed: number;
  /** A response slower than this ends the round as a miss. Omit for no limit. */
  readonly timeoutMs?: number;
}

export interface ReactionState {
  readonly phase: ReactionPhase;
  readonly round: number;
  readonly rounds: number;
  /** Simulation ms elapsed inside the current phase. */
  readonly phaseElapsedMs: number;
  /** The drawn wait for this round, so a test can assert the seed drove it. */
  readonly waitMs: number;
  readonly lastResult: ReactionRoundResult | null;
  readonly summary: ReactionSummary;
}

export interface ReactionService {
  state(): ReactionState;
  phase(): ReactionPhase;
  /** Begin the run. Moves `ready` -> `wait` and draws this round's wait. */
  begin(): void;
  /** Advance simulation time. Drives wait expiry, stimulus and response timeout. */
  update(deltaMs: number): void;
  /** A semantic press. During `wait` this is a false start; after the stimulus it is the response. */
  respond(): ReactionRoundResult | null;
  /** Move from a finished round to the next, or to the summary. */
  next(): void;
  summary(): ReactionSummary;
  reset(): void;
}

// --- Validation ----------------------------------------------------------

export class InvalidRhythmChartError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidRhythmChartError';
  }
}

/**
 * Semantic checks the JSON schema cannot express: window ordering, unique ids,
 * exactly one of `timeMs`/`beat` per note, and non-negative resolved times.
 */
export function validateRhythmDocument(doc: RhythmDocument): void {
  if (doc.charts.length === 0) {
    throw new InvalidRhythmChartError('At least one chart is required.');
  }
  if (doc.calibrationMs !== undefined && Math.abs(doc.calibrationMs) > MAX_CALIBRATION_MS) {
    throw new InvalidRhythmChartError(
      `calibrationMs must be within +/-${MAX_CALIBRATION_MS}ms (got ${String(doc.calibrationMs)}).`,
    );
  }

  const chartIds = new Set<string>();
  for (const chart of doc.charts) {
    if (chartIds.has(chart.id)) throw new InvalidRhythmChartError(`Duplicate chart id: "${chart.id}".`);
    chartIds.add(chart.id);

    if (!(chart.bpm > 0)) {
      throw new InvalidRhythmChartError(`Chart "${chart.id}": bpm must be > 0 (got ${String(chart.bpm)}).`);
    }
    const windows = chart.judgementWindows;
    for (const [name, value] of [
      ['perfectMs', windows.perfectMs],
      ['goodMs', windows.goodMs],
      ['missMs', windows.missMs],
    ] as const) {
      if (!(value > 0)) {
        throw new InvalidRhythmChartError(`Chart "${chart.id}": judgementWindows.${name} must be > 0.`);
      }
    }
    if (!(windows.perfectMs <= windows.goodMs && windows.goodMs <= windows.missMs)) {
      throw new InvalidRhythmChartError(
        `Chart "${chart.id}": judgement windows must satisfy perfect <= good <= miss ` +
          `(got ${windows.perfectMs}, ${windows.goodMs}, ${windows.missMs}).`,
      );
    }

    const noteIds = new Set<string>();
    for (const note of chart.notes) {
      if (noteIds.has(note.id)) {
        throw new InvalidRhythmChartError(`Chart "${chart.id}": duplicate note id "${note.id}".`);
      }
      noteIds.add(note.id);
      const hasTime = note.timeMs !== undefined;
      const hasBeat = note.beat !== undefined;
      if (hasTime === hasBeat) {
        throw new InvalidRhythmChartError(
          `Chart "${chart.id}", note "${note.id}": author exactly one of timeMs or beat.`,
        );
      }
      const resolved = noteTimeMs(note, chart.bpm, chart.offsetMs);
      if (!Number.isFinite(resolved) || resolved < 0) {
        throw new InvalidRhythmChartError(
          `Chart "${chart.id}", note "${note.id}": resolves to ${String(resolved)}ms, which is not a valid time.`,
        );
      }
      if (note.holdMs !== undefined && !(note.holdMs > 0)) {
        throw new InvalidRhythmChartError(`Chart "${chart.id}", note "${note.id}": holdMs must be > 0.`);
      }
    }
  }
}

/** Player calibration is bounded: it shifts judgement, it does not rewrite the chart. */
export const MAX_CALIBRATION_MS = 200;

export function clampCalibration(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return value < -MAX_CALIBRATION_MS ? -MAX_CALIBRATION_MS : value > MAX_CALIBRATION_MS ? MAX_CALIBRATION_MS : value;
}

/**
 * Classify a timing delta. Pure, and exported because a UI drawing a hit bar
 * must use the same thresholds the judge does rather than a re-derived pair.
 */
export function classifyDelta(deltaMs: number, windows: JudgementWindows): Judgement | null {
  const magnitude = Math.abs(deltaMs);
  if (magnitude <= windows.perfectMs) return 'perfect';
  if (magnitude <= windows.goodMs) return 'good';
  if (magnitude <= windows.missMs) return 'miss';
  return null;
}

/** The deterministic wait draw for one reaction round. Never `Math.random`. */
export function reactionWaitMs(config: ReactionConfig, round: number, rngFactory: (seed: unknown) => SeededRng): number {
  const span = Math.max(0, config.maxWaitMs - config.minWaitMs);
  if (span === 0) return config.minWaitMs;
  const rng = rngFactory((config.seed + round * 0x9e3779b9) >>> 0);
  return config.minWaitMs + rng.nextFloat() * span;
}
