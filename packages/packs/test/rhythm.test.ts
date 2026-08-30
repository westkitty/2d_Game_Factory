import { describe, expect, it } from 'vitest';
import type {
  AudioTransport,
  GameContext,
  ReactionService,
  RhythmDocument,
  RhythmService,
  TransportState,
} from '@sw2d/contracts';
import { createFakeGameContext } from './testSupport.ts';
import {
  rhythmPack,
  RhythmServiceImpl,
  ReactionServiceImpl,
  MissingRhythmDocumentError,
  UnknownChartError,
} from '../src/rhythm/rhythmPack.ts';

/**
 * A transport driven by hand. Same contract as the browser one, with the clock
 * supplied instead of sampled - which is exactly what makes these assertions
 * exact rather than timing-dependent.
 */
class TestTransport implements AudioTransport {
  state: TransportState = 'idle';
  #timeMs = 0;

  currentTimeMs(): number {
    return this.#timeMs;
  }
  advance(deltaMs: number): void {
    if (this.state === 'playing') this.#timeMs += deltaMs;
  }
  seek(timeMs: number): void {
    this.#timeMs = timeMs;
  }
  start(): void {
    this.#timeMs = 0;
    this.state = 'playing';
  }
  pause(): void {
    if (this.state === 'playing') this.state = 'paused';
  }
  resume(): void {
    if (this.state === 'paused') this.state = 'playing';
  }
  stop(): void {
    this.state = 'stopped';
  }
  dispose(): void {
    this.state = 'stopped';
  }
}

const WINDOWS = { perfectMs: 40, goodMs: 90, missMs: 160 };

const DOC: RhythmDocument = {
  schemaVersion: 1,
  charts: [
    {
      schemaVersion: 1,
      id: 'demo',
      audioRole: 'music.demo',
      bpm: 120,
      offsetMs: 0,
      judgementWindows: WINDOWS,
      notes: [
        { id: 'n1', timeMs: 1000, action: 'CONFIRM' },
        { id: 'n2', timeMs: 2000, action: 'CONFIRM' },
        { id: 'n3', timeMs: 3000, action: 'CONFIRM' },
        { id: 'n4', timeMs: 4000, action: 'PRIMARY_ACTION', lane: 'right' },
      ],
    },
    {
      schemaVersion: 1,
      id: 'second',
      audioRole: 'music.other',
      bpm: 100,
      offsetMs: 250,
      judgementWindows: WINDOWS,
      notes: [{ id: 's1', beat: 2, action: 'JUMP' }],
    },
  ],
};

function build(doc: RhythmDocument = DOC): { service: RhythmServiceImpl; transport: TestTransport } {
  const transport = new TestTransport();
  return { service: new RhythmServiceImpl(doc, transport), transport };
}

/** Play to an exact chart position and press there. */
function pressAt(
  service: RhythmServiceImpl,
  transport: TestTransport,
  timeMs: number,
  action: Parameters<RhythmService['press']>[0] = 'CONFIRM',
  lane?: string,
) {
  transport.seek(timeMs);
  return service.press(action, lane);
}

function createContext(doc?: RhythmDocument, transport?: AudioTransport): GameContext {
  const base = createFakeGameContext();
  const data: Record<string, { schemaId: string; valid: true; value: unknown }> = {};
  if (doc) data['rhythm'] = { schemaId: 'rhythm', valid: true, value: doc };
  const context = { ...base, content: { ...base.content, data } };
  if (transport) context.capabilities.provide('audio.transport', transport);
  return context;
}

describe('rhythmPack installation', () => {
  it('provides both Phase 17 capabilities and releases them on dispose', () => {
    const context = createContext(DOC, new TestTransport());
    const installed = rhythmPack.install(context, {});
    expect(context.capabilities.has('arcade.rhythm')).toBe(true);
    expect(context.capabilities.has('arcade.reaction')).toBe(true);
    expect(installed.id).toBe('sw2d.rhythm');
    installed.dispose();
    expect(context.capabilities.has('arcade.rhythm')).toBe(false);
    expect(context.capabilities.has('arcade.reaction')).toBe(false);
  });

  it('requires the content document and a transport', () => {
    expect(() => rhythmPack.install(createContext(undefined, new TestTransport()), {})).toThrow(
      MissingRhythmDocumentError,
    );
    // No transport means no clock to judge against - a construction error, not a
    // silent no-op that would judge every note against zero.
    expect(() => rhythmPack.install(createContext(DOC), {})).toThrow(/audio.transport/);
  });

  it('loads the first chart by default, or the configured one', () => {
    const first = createContext(DOC, new TestTransport());
    rhythmPack.install(first, {});
    expect(first.capabilities.require<RhythmService>('arcade.rhythm').chart()?.id).toBe('demo');

    const chosen = createContext(DOC, new TestTransport());
    rhythmPack.install(chosen, { defaultChartId: 'second' });
    expect(chosen.capabilities.require<RhythmService>('arcade.rhythm').chart()?.id).toBe('second');
  });

  it('rejects a malformed document at install time', () => {
    const bad: RhythmDocument = {
      schemaVersion: 1,
      charts: [{ ...DOC.charts[0]!, judgementWindows: { perfectMs: 200, goodMs: 50, missMs: 60 } }],
    };
    expect(() => rhythmPack.install(createContext(bad, new TestTransport()), {})).toThrow(/perfect <= good <= miss/);
  });
});

describe('chart judgement', () => {
  it('judges nothing before the chart starts', () => {
    const { service, transport } = build();
    transport.seek(1000);
    expect(service.press('CONFIRM')).toMatchObject({ kind: 'none' });
    expect(service.score().perfect).toBe(0);
  });

  it('awards perfect, good and miss by delta', () => {
    const { service, transport } = build();
    service.start();

    expect(pressAt(service, transport, 1000)).toMatchObject({
      kind: 'judged',
      result: { noteId: 'n1', judgement: 'perfect', deltaMs: 0 },
    });
    // 60ms late: outside perfect (40), inside good (90).
    expect(pressAt(service, transport, 2060)).toMatchObject({
      kind: 'judged',
      result: { noteId: 'n2', judgement: 'good', deltaMs: 60 },
    });
    // 120ms early: outside good, inside the miss window - a judged miss.
    expect(pressAt(service, transport, 2880)).toMatchObject({
      kind: 'judged',
      result: { noteId: 'n3', judgement: 'miss', deltaMs: -120 },
    });

    const score = service.score();
    expect(score).toMatchObject({ perfect: 1, good: 1, miss: 1, score: 150 });
    expect(score.accuracy).toBeCloseTo(2 / 3, 4);
  });

  it('judges nothing when no note is in range, and consumes no note', () => {
    const { service, transport } = build();
    service.start();
    expect(pressAt(service, transport, 1500)).toMatchObject({ kind: 'none' });
    expect(service.state().notesRemaining).toBe(4);
    // The note is still there to be hit properly.
    expect(pressAt(service, transport, 1000)).toMatchObject({ kind: 'judged', result: { judgement: 'perfect' } });
  });

  it('never judges the same note twice', () => {
    const { service, transport } = build();
    service.start();
    expect(pressAt(service, transport, 1000)).toMatchObject({ kind: 'judged', result: { noteId: 'n1' } });
    // A second press at the same instant finds nothing: n1 is spent, and n2 is
    // 1000ms away - far outside the miss window.
    expect(pressAt(service, transport, 1000)).toMatchObject({ kind: 'none' });
    expect(service.judged().filter((j) => j.noteId === 'n1')).toHaveLength(1);
    expect(service.score().perfect).toBe(1);
  });

  it('picks the nearest eligible note, not the first', () => {
    const doc: RhythmDocument = {
      schemaVersion: 1,
      charts: [
        {
          ...DOC.charts[0]!,
          notes: [
            { id: 'early', timeMs: 1000, action: 'CONFIRM' },
            { id: 'late', timeMs: 1100, action: 'CONFIRM' },
          ],
        },
      ],
    };
    const { service, transport } = build(doc);
    service.start();
    // 1080 is 80ms from 'early' and 20ms from 'late'.
    expect(pressAt(service, transport, 1080)).toMatchObject({ kind: 'judged', result: { noteId: 'late' } });
  });

  it('matches on the action, so a wrong button hits nothing', () => {
    const { service, transport } = build();
    service.start();
    expect(pressAt(service, transport, 1000, 'JUMP')).toMatchObject({ kind: 'none' });
    expect(service.state().notesRemaining).toBe(4);
  });

  it('respects lanes when the input names one', () => {
    const { service, transport } = build();
    service.start();
    expect(pressAt(service, transport, 4000, 'PRIMARY_ACTION', 'left')).toMatchObject({ kind: 'none' });
    expect(pressAt(service, transport, 4000, 'PRIMARY_ACTION', 'right')).toMatchObject({
      kind: 'judged',
      result: { noteId: 'n4', lane: 'right' },
    });
  });
});

describe('combo and expiry', () => {
  it('builds a combo on hits and breaks it on a miss', () => {
    const { service, transport } = build();
    service.start();
    pressAt(service, transport, 1000);
    pressAt(service, transport, 2000);
    expect(service.score()).toMatchObject({ combo: 2, maxCombo: 2 });

    pressAt(service, transport, 2880); // judged miss on n3
    expect(service.score()).toMatchObject({ combo: 0, maxCombo: 2 });

    pressAt(service, transport, 4000, 'PRIMARY_ACTION', 'right');
    expect(service.score()).toMatchObject({ combo: 1, maxCombo: 2 });
  });

  it('expires a note once its miss window has closed, exactly once', () => {
    const { service, transport } = build();
    service.start();

    transport.seek(1000 + WINDOWS.missMs); // still hittable at the edge
    expect(service.tick()).toEqual([]);

    transport.seek(1000 + WINDOWS.missMs + 1);
    const expired = service.tick();
    expect(expired).toHaveLength(1);
    expect(expired[0]).toMatchObject({ noteId: 'n1', judgement: 'miss' });

    // Ticking again does not re-expire it.
    expect(service.tick()).toEqual([]);
    expect(service.score().miss).toBe(1);
    expect(service.judged().filter((j) => j.noteId === 'n1')).toHaveLength(1);
  });

  it('finishes the chart once every note is judged', () => {
    const { service, transport } = build();
    service.start();
    transport.seek(10000);
    const expired = service.tick();
    expect(expired).toHaveLength(4);
    expect(service.status()).toBe('finished');
    expect(service.state().notesRemaining).toBe(0);
  });
});

describe('pause and resume', () => {
  it('judges nothing while paused, and does not duplicate or skip on resume', () => {
    const { service, transport } = build();
    service.start();
    pressAt(service, transport, 1000);
    expect(service.score().perfect).toBe(1);

    service.pause();
    expect(service.status()).toBe('paused');
    // A press while paused judges nothing - otherwise a pause would let a player
    // farm notes at a frozen transport time.
    transport.seek(2000);
    expect(service.press('CONFIRM')).toMatchObject({ kind: 'none' });
    // Bookkeeping is frozen too: nothing expires while paused.
    transport.seek(9000);
    expect(service.tick()).toEqual([]);
    expect(service.score().miss).toBe(0);

    service.resume();
    expect(service.status()).toBe('playing');
    // The notes the pause protected are still there and still judgeable.
    transport.seek(2000);
    expect(service.press('CONFIRM')).toMatchObject({ kind: 'judged', result: { noteId: 'n2' } });
    expect(service.judged()).toHaveLength(2);
  });

  it('a real transport does not advance while paused', () => {
    const { service, transport } = build();
    service.start();
    transport.advance(500);
    expect(service.state().timeMs).toBe(500);
    service.pause();
    transport.advance(5000);
    expect(service.state().timeMs).toBe(500);
    service.resume();
    transport.advance(100);
    expect(service.state().timeMs).toBe(600);
  });
});

describe('calibration', () => {
  it('shifts judgement by a bounded amount', () => {
    const { service, transport } = build();
    service.start();
    // A player who consistently reads 60ms late calibrates by -60, turning a
    // 60ms-late press back into a perfect.
    service.setCalibrationMs(-60);
    expect(service.calibrationMs()).toBe(-60);
    expect(pressAt(service, transport, 1060)).toMatchObject({
      kind: 'judged',
      result: { judgement: 'perfect', deltaMs: 0 },
    });
  });

  it('cannot be pushed past the bound', () => {
    const { service } = build();
    service.setCalibrationMs(100000);
    expect(service.calibrationMs()).toBe(200);
    service.setCalibrationMs(-100000);
    expect(service.calibrationMs()).toBe(-200);
  });

  it('takes its default from the document', () => {
    const { service } = build({ ...DOC, calibrationMs: 25 });
    expect(service.calibrationMs()).toBe(25);
  });
});

describe('lookahead and reset', () => {
  it('reports upcoming notes inside the lookahead window only', () => {
    const { service, transport } = build();
    service.start();
    transport.seek(900);
    const upcoming = service.state().upcoming;
    // n1 (1000) and n2 (2000) are within 2000ms; n3 (3000) is not.
    expect(upcoming.map((note) => note.noteId)).toEqual(['n1', 'n2']);
  });

  it('drops a judged note from the upcoming list', () => {
    const { service, transport } = build();
    service.start();
    pressAt(service, transport, 1000);
    transport.seek(900);
    expect(service.state().upcoming.map((note) => note.noteId)).toEqual(['n2']);
  });

  it('start() re-arms a chart that was already played', () => {
    const { service, transport } = build();
    service.start();
    pressAt(service, transport, 1000);
    expect(service.score().perfect).toBe(1);

    service.start();
    expect(service.score()).toMatchObject({ perfect: 0, miss: 0, combo: 0, score: 0 });
    expect(service.state().notesRemaining).toBe(4);
  });

  it('reset() clears the score and parks the chart', () => {
    const { service, transport } = build();
    service.start();
    pressAt(service, transport, 1000);
    service.reset();
    expect(service.status()).toBe('idle');
    expect(service.score().score).toBe(0);
    expect(service.judged()).toEqual([]);
  });

  it('load() switches charts and rejects an unknown id', () => {
    const { service } = build();
    service.load('second');
    expect(service.chart()?.id).toBe('second');
    // Beat 2 at 100bpm with a 250ms offset resolves to 250 + 1200.
    expect(service.state().notesTotal).toBe(1);
    expect(() => service.load('nope')).toThrow(UnknownChartError);
  });
});

describe('reaction state machine', () => {
  const config = { rounds: 2, minWaitMs: 500, maxWaitMs: 1500, seed: 7, timeoutMs: 1000 };

  it('draws a seeded wait and reaches the stimulus only after it elapses', () => {
    const service = new ReactionServiceImpl(config);
    expect(service.phase()).toBe('ready');
    service.begin();
    expect(service.phase()).toBe('wait');

    const wait = service.state().waitMs;
    expect(wait).toBeGreaterThanOrEqual(500);
    expect(wait).toBeLessThanOrEqual(1500);

    service.update(wait - 1);
    expect(service.phase()).toBe('wait');
    service.update(2);
    expect(service.phase()).toBe('stimulus');
  });

  it('is deterministic for a given seed', () => {
    const a = new ReactionServiceImpl(config);
    const b = new ReactionServiceImpl(config);
    a.begin();
    b.begin();
    expect(a.state().waitMs).toBe(b.state().waitMs);
  });

  it('records a false start for input before the stimulus', () => {
    const service = new ReactionServiceImpl(config);
    service.begin();
    service.update(100);
    const result = service.respond();
    expect(result).toMatchObject({ round: 1, falseStart: true, reactionMs: null });
    expect(service.phase()).toBe('result');
    expect(service.summary().falseStarts).toBe(1);
  });

  it('records the reaction interval for input after the stimulus', () => {
    const service = new ReactionServiceImpl(config);
    service.begin();
    service.update(service.state().waitMs + 1);
    expect(service.phase()).toBe('stimulus');
    service.update(180);
    const result = service.respond();
    expect(result).toMatchObject({ round: 1, falseStart: false });
    expect(result!.reactionMs).toBeCloseTo(180, 2);
  });

  it('ends a round as a timeout when the response is too slow', () => {
    const service = new ReactionServiceImpl(config);
    service.begin();
    service.update(service.state().waitMs + 1);
    service.update(config.timeoutMs + 1);
    expect(service.phase()).toBe('result');
    // Too slow is a completed round with no time, not a false start.
    expect(service.state().lastResult).toMatchObject({ falseStart: false, reactionMs: null });
  });

  it('advances rounds and then reaches the summary', () => {
    const service = new ReactionServiceImpl(config);
    service.begin();
    for (let round = 1; round <= config.rounds; round++) {
      service.update(service.state().waitMs + 1);
      service.update(120 + round);
      service.respond();
      expect(service.phase()).toBe('result');
      service.next();
    }
    expect(service.phase()).toBe('summary');

    const summary = service.summary();
    expect(summary.completed).toBe(2);
    expect(summary.falseStarts).toBe(0);
    expect(summary.bestMs).toBeCloseTo(121, 2);
    expect(summary.averageMs).toBeCloseTo(121.5, 2);
    expect(summary.results).toHaveLength(2);
  });

  it('ignores a response outside a live round, and next() outside a result', () => {
    const service = new ReactionServiceImpl(config);
    expect(service.respond()).toBeNull(); // still 'ready'
    service.next();
    expect(service.phase()).toBe('ready');
  });

  it('reset() returns to ready and clears the summary', () => {
    const service = new ReactionServiceImpl(config);
    service.begin();
    service.update(50);
    service.respond();
    expect(service.summary().completed).toBe(1);
    service.reset();
    expect(service.phase()).toBe('ready');
    expect(service.summary().completed).toBe(0);
    expect(service.summary().bestMs).toBeNull();
  });
});

describe('events on the bus', () => {
  it('emits the cross-system facts a HUD would react to', () => {
    const transport = new TestTransport();
    const context = createContext(DOC, transport);
    const installed = rhythmPack.install(context, { reaction: { rounds: 1, minWaitMs: 10, maxWaitMs: 10, seed: 1 } });
    const rhythm = context.capabilities.require<RhythmService>('arcade.rhythm');
    const reaction = context.capabilities.require<ReactionService>('arcade.reaction');

    const seen: string[] = [];
    context.events.on('rhythm:judged', (p) => seen.push(`judged:${p.judgement}`));
    context.events.on('reaction:stimulus', () => seen.push('stimulus'));
    context.events.on('reaction:round', () => seen.push('round'));

    rhythm.start();
    transport.seek(1000);
    rhythm.press('CONFIRM');

    reaction.begin();
    installed.update?.(20); // past the 10ms wait
    reaction.respond();

    expect(seen).toContain('judged:perfect');
    expect(seen).toContain('stimulus');
    expect(seen).toContain('round');
  });
});
