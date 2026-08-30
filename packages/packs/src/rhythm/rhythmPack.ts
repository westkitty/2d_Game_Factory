import type {
  ActionId,
  AudioTransport,
  EventBus,
  GameContext,
  InstalledSystemPack,
  JudgedNote,
  Judgement,
  ReactionConfig,
  ReactionRoundResult,
  ReactionService,
  ReactionState,
  ReactionSummary,
  RhythmChart,
  RhythmChartStatus,
  RhythmDocument,
  RhythmInputOutcome,
  RhythmNote,
  RhythmScore,
  RhythmService,
  RhythmState,
  SystemPackDefinition,
} from '@sw2d/contracts';
import {
  RHYTHM_JUDGEMENT_POINTS,
  classifyDelta,
  clampCalibration,
  createRng,
  noteTimeMs,
  reactionWaitMs,
  validateRhythmDocument,
} from '@sw2d/contracts';
import { registerSchema } from '@sw2d/schemas';
import { CAPABILITY_IDS, PACK_IDS } from '../ids.ts';
import rhythmConfigSchema from '../../schemas/rhythm-config.schema.json' with { type: 'json' };

export const RHYTHM_CONFIG_SCHEMA_ID = rhythmConfigSchema.$id;
registerSchema(rhythmConfigSchema);

/** How far ahead `state().upcoming` reports notes, in milliseconds of chart time. */
const LOOKAHEAD_MS = 2000;

export interface RhythmConfig {
  /** Chart loaded at install. Defaults to the first in the document. */
  readonly defaultChartId?: string;
  readonly reaction?: ReactionConfig;
}

export class MissingRhythmDocumentError extends Error {
  constructor() {
    super(
      'sw2d.rhythm requires a "rhythm" content document. Author content/rhythm.json ' +
        '(urn:sw2d:schema:content-rhythm:v1).',
    );
    this.name = 'MissingRhythmDocumentError';
  }
}

export class UnknownChartError extends Error {
  constructor(chartId: string) {
    super(`Unknown chart: "${chartId}".`);
    this.name = 'UnknownChartError';
  }
}

interface LiveNote {
  readonly note: RhythmNote;
  readonly timeMs: number;
  judged: boolean;
}

/**
 * Chart judgement against a transport position.
 *
 * The service owns two guarantees a caller cannot be trusted with:
 *
 * 1. **A note is judged at most once, ever.** Not "the caller should not press
 *    twice" - the note carries a `judged` flag and every path checks it.
 * 2. **The transport is the only clock.** `press()` takes no timestamp; it reads
 *    the transport itself, so a caller cannot judge against a stale or invented
 *    time. Calibration shifts that reading by a bounded amount and nothing else.
 */
export class RhythmServiceImpl implements RhythmService {
  readonly #transport: AudioTransport;
  readonly #events: EventBus | undefined;
  readonly #charts = new Map<string, RhythmChart>();

  #chart: RhythmChart | undefined;
  #notes: LiveNote[] = [];
  #judged: JudgedNote[] = [];
  #status: RhythmChartStatus = 'idle';
  #calibrationMs: number;
  #combo = 0;
  #maxCombo = 0;
  #counts: Record<Judgement, number> = { perfect: 0, good: 0, miss: 0 };
  #points = 0;

  constructor(doc: RhythmDocument, transport: AudioTransport, events?: EventBus, defaultChartId?: string) {
    validateRhythmDocument(doc);
    this.#transport = transport;
    this.#events = events;
    this.#calibrationMs = clampCalibration(doc.calibrationMs ?? 0);
    for (const chart of doc.charts) this.#charts.set(chart.id, chart);

    const initial = defaultChartId ?? doc.charts[0]?.id;
    if (initial !== undefined) this.load(initial);
  }

  // --- Chart -------------------------------------------------------------

  load(chartId: string): void {
    const chart = this.#charts.get(chartId);
    if (!chart) throw new UnknownChartError(chartId);
    this.#chart = chart;
    this.#rebuildNotes();
    this.#resetScore();
    this.#status = 'idle';
  }

  chart(): RhythmChart | undefined {
    return this.#chart;
  }

  status(): RhythmChartStatus {
    return this.#status;
  }

  #rebuildNotes(): void {
    const chart = this.#chart;
    this.#notes = chart
      ? chart.notes
          .map((note) => ({ note, timeMs: noteTimeMs(note, chart.bpm, chart.offsetMs), judged: false }))
          // Sorted by time so "nearest unjudged" is a scan, and so `upcoming`
          // reports in the order a renderer wants to draw them.
          .sort((a, b) => a.timeMs - b.timeMs || (a.note.id < b.note.id ? -1 : 1))
      : [];
  }

  #resetScore(): void {
    this.#judged = [];
    this.#combo = 0;
    this.#maxCombo = 0;
    this.#counts = { perfect: 0, good: 0, miss: 0 };
    this.#points = 0;
  }

  // --- Transport ---------------------------------------------------------

  start(): void {
    if (!this.#chart) return;
    this.#rebuildNotes();
    this.#resetScore();
    this.#transport.start();
    this.#status = 'playing';
  }

  pause(): void {
    if (this.#status !== 'playing') return;
    this.#transport.pause();
    this.#status = 'paused';
  }

  resume(): void {
    if (this.#status !== 'paused') return;
    this.#transport.resume();
    this.#status = 'playing';
  }

  stop(): void {
    this.#transport.stop();
    this.#status = 'finished';
  }

  #now(): number {
    return this.#transport.currentTimeMs();
  }

  // --- Judgement ---------------------------------------------------------

  press(action: ActionId, lane?: string): RhythmInputOutcome {
    const chart = this.#chart;
    // A press while paused or before the chart starts judges nothing. Without
    // this, a pause would let a player farm notes at a frozen transport time.
    if (!chart || this.#status !== 'playing') {
      return { kind: 'none', atMs: this.#now() };
    }

    const atMs = this.#now() + this.#calibrationMs;
    const windows = chart.judgementWindows;

    let best: LiveNote | undefined;
    let bestDelta = Number.POSITIVE_INFINITY;
    for (const live of this.#notes) {
      if (live.judged) continue;
      if (live.note.action !== action) continue;
      if (lane !== undefined && live.note.lane !== undefined && live.note.lane !== lane) continue;
      const delta = atMs - live.timeMs;
      const magnitude = Math.abs(delta);
      if (magnitude > windows.missMs) continue;
      // Strictly nearer wins; a tie keeps the earlier note, which is the one the
      // player is being asked to hit.
      if (magnitude < bestDelta) {
        best = live;
        bestDelta = magnitude;
      }
    }

    if (!best) return { kind: 'none', atMs };

    const delta = atMs - best.timeMs;
    const judgement = classifyDelta(delta, windows) ?? 'miss';
    const result = this.#commit(best, judgement, delta, atMs);
    return { kind: 'judged', result };
  }

  tick(): readonly JudgedNote[] {
    const chart = this.#chart;
    if (!chart || this.#status !== 'playing') return [];
    const atMs = this.#now();
    const expired: JudgedNote[] = [];

    for (const live of this.#notes) {
      if (live.judged) continue;
      // A note whose whole miss window is behind us can no longer be hit.
      if (atMs - live.timeMs <= chart.judgementWindows.missMs) continue;
      expired.push(this.#commit(live, 'miss', atMs - live.timeMs, atMs));
    }

    if (this.#notes.every((live) => live.judged)) this.#status = 'finished';
    return expired;
  }

  /** The single place a note transitions to judged. Guarantees "at most once". */
  #commit(live: LiveNote, judgement: Judgement, deltaMs: number, atMs: number): JudgedNote {
    live.judged = true;
    this.#counts[judgement] += 1;
    this.#points += RHYTHM_JUDGEMENT_POINTS[judgement];
    if (judgement === 'miss') {
      this.#combo = 0;
    } else {
      this.#combo += 1;
      if (this.#combo > this.#maxCombo) this.#maxCombo = this.#combo;
    }

    const result: JudgedNote = {
      noteId: live.note.id,
      action: live.note.action,
      lane: live.note.lane ?? null,
      judgement,
      deltaMs: Math.round(deltaMs * 100) / 100,
      atMs: Math.round(atMs * 100) / 100,
    };
    this.#judged.push(result);
    this.#events?.emit('rhythm:judged', {
      noteId: result.noteId,
      judgement,
      deltaMs: result.deltaMs,
      combo: this.#combo,
    });
    return result;
  }

  // --- Reads -------------------------------------------------------------

  score(): RhythmScore {
    const hits = this.#counts.perfect + this.#counts.good;
    const total = hits + this.#counts.miss;
    return {
      perfect: this.#counts.perfect,
      good: this.#counts.good,
      miss: this.#counts.miss,
      combo: this.#combo,
      maxCombo: this.#maxCombo,
      score: this.#points,
      accuracy: total === 0 ? 0 : Math.round((hits / total) * 10000) / 10000,
    };
  }

  judged(): readonly JudgedNote[] {
    return [...this.#judged];
  }

  state(): RhythmState {
    const atMs = this.#now();
    return {
      chartId: this.#chart?.id ?? null,
      status: this.#status,
      timeMs: Math.round(atMs * 100) / 100,
      score: this.score(),
      notesTotal: this.#notes.length,
      notesJudged: this.#notes.filter((live) => live.judged).length,
      notesRemaining: this.#notes.filter((live) => !live.judged).length,
      upcoming: this.#notes
        .filter((live) => !live.judged && live.timeMs >= atMs && live.timeMs <= atMs + LOOKAHEAD_MS)
        .map((live) => ({
          noteId: live.note.id,
          action: live.note.action,
          lane: live.note.lane ?? null,
          timeMs: live.timeMs,
        })),
    };
  }

  calibrationMs(): number {
    return this.#calibrationMs;
  }

  setCalibrationMs(value: number): void {
    this.#calibrationMs = clampCalibration(value);
  }

  reset(): void {
    this.#transport.stop();
    this.#rebuildNotes();
    this.#resetScore();
    this.#status = 'idle';
  }
}

// --- Reaction ------------------------------------------------------------

const DEFAULT_REACTION: ReactionConfig = { rounds: 3, minWaitMs: 800, maxWaitMs: 2000, seed: 1337, timeoutMs: 2000 };

/**
 * The reaction-test state machine.
 *
 * Runs on simulation time supplied by `update(deltaMs)`, never on a wall clock,
 * and draws each round's wait from the project's canonical seeded RNG - so a
 * seeded run replays identically and a test can assert the exact wait.
 */
export class ReactionServiceImpl implements ReactionService {
  readonly #config: ReactionConfig;
  readonly #events: EventBus | undefined;

  #phase: ReactionState['phase'] = 'ready';
  #round = 0;
  #phaseElapsedMs = 0;
  #waitMs = 0;
  #results: ReactionRoundResult[] = [];
  #lastResult: ReactionRoundResult | null = null;

  constructor(config: ReactionConfig = DEFAULT_REACTION, events?: EventBus) {
    this.#config = config;
    this.#events = events;
  }

  phase(): ReactionState['phase'] {
    return this.#phase;
  }

  begin(): void {
    if (this.#phase !== 'ready') return;
    this.#round = 1;
    this.#startWait();
  }

  #startWait(): void {
    this.#waitMs = reactionWaitMs(this.#config, this.#round, createRng);
    this.#phase = 'wait';
    this.#phaseElapsedMs = 0;
  }

  update(deltaMs: number): void {
    if (deltaMs <= 0) return;
    this.#phaseElapsedMs += deltaMs;

    if (this.#phase === 'wait' && this.#phaseElapsedMs >= this.#waitMs) {
      this.#phase = 'stimulus';
      this.#phaseElapsedMs = 0;
      this.#events?.emit('reaction:stimulus', { round: this.#round });
      return;
    }

    if (
      this.#phase === 'stimulus' &&
      this.#config.timeoutMs !== undefined &&
      this.#phaseElapsedMs >= this.#config.timeoutMs
    ) {
      // Too slow is a completed round with no time, not a false start.
      this.#finishRound({ round: this.#round, falseStart: false, reactionMs: null });
    }
  }

  respond(): ReactionRoundResult | null {
    if (this.#phase === 'wait') {
      this.#phase = 'false-start';
      return this.#finishRound({ round: this.#round, falseStart: true, reactionMs: null });
    }
    if (this.#phase === 'stimulus') {
      this.#phase = 'response';
      return this.#finishRound({
        round: this.#round,
        falseStart: false,
        reactionMs: Math.round(this.#phaseElapsedMs * 100) / 100,
      });
    }
    return null;
  }

  #finishRound(result: ReactionRoundResult): ReactionRoundResult {
    this.#results.push(result);
    this.#lastResult = result;
    this.#phase = 'result';
    this.#phaseElapsedMs = 0;
    this.#events?.emit('reaction:round', {
      round: result.round,
      falseStart: result.falseStart,
      reactionMs: result.reactionMs ?? -1,
    });
    return result;
  }

  next(): void {
    if (this.#phase !== 'result') return;
    if (this.#round >= this.#config.rounds) {
      this.#phase = 'summary';
      this.#phaseElapsedMs = 0;
      return;
    }
    this.#round += 1;
    this.#startWait();
  }

  summary(): ReactionSummary {
    const timed = this.#results.filter((r) => r.reactionMs !== null).map((r) => r.reactionMs!);
    return {
      rounds: this.#config.rounds,
      completed: this.#results.length,
      falseStarts: this.#results.filter((r) => r.falseStart).length,
      bestMs: timed.length === 0 ? null : Math.min(...timed),
      averageMs:
        timed.length === 0 ? null : Math.round((timed.reduce((a, b) => a + b, 0) / timed.length) * 100) / 100,
      results: [...this.#results],
    };
  }

  state(): ReactionState {
    return {
      phase: this.#phase,
      round: this.#round,
      rounds: this.#config.rounds,
      phaseElapsedMs: Math.round(this.#phaseElapsedMs * 100) / 100,
      waitMs: Math.round(this.#waitMs * 100) / 100,
      lastResult: this.#lastResult,
      summary: this.summary(),
    };
  }

  reset(): void {
    this.#phase = 'ready';
    this.#round = 0;
    this.#phaseElapsedMs = 0;
    this.#waitMs = 0;
    this.#results = [];
    this.#lastResult = null;
  }
}

export const rhythmPack: SystemPackDefinition<RhythmConfig, GameContext> = {
  id: PACK_IDS.rhythm,
  version: '0.1.0',
  provides: [CAPABILITY_IDS.rhythm, CAPABILITY_IDS.reaction],
  dependencies: [],
  configSchemaId: RHYTHM_CONFIG_SCHEMA_ID,

  install(context: GameContext, config: RhythmConfig): InstalledSystemPack {
    const doc = context.content.data['rhythm']?.value as RhythmDocument | undefined;
    if (!doc) throw new MissingRhythmDocumentError();

    // The transport is supplied by the game (the runtime's browser transport, or
    // a scripted one in QA). Without one the pack cannot judge anything, so a
    // missing transport is a construction error rather than a silent no-op.
    const transport = context.capabilities.require<AudioTransport>(CAPABILITY_IDS.audioTransport);

    const rhythm = new RhythmServiceImpl(doc, transport, context.events, config?.defaultChartId);
    const reaction = new ReactionServiceImpl(config?.reaction ?? DEFAULT_REACTION, context.events);

    const rhythmHandle = context.capabilities.provide(CAPABILITY_IDS.rhythm, rhythm);
    const reactionHandle = context.capabilities.provide(CAPABILITY_IDS.reaction, reaction);

    return {
      id: PACK_IDS.rhythm,
      update(deltaMs: number): void {
        // Chart bookkeeping runs on the transport's clock; the reaction machine
        // runs on simulation time. Two different clocks, deliberately.
        rhythm.tick();
        reaction.update(deltaMs);
      },
      dispose(): void {
        reactionHandle.dispose();
        rhythmHandle.dispose();
      },
    };
  },
};

export { DEFAULT_REACTION };
export type { ReactionService, RhythmService } from '@sw2d/contracts';
