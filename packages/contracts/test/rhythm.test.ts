import { describe, expect, it } from 'vitest';
import {
  InvalidRhythmChartError,
  MAX_CALIBRATION_MS,
  REACTION_CAPABILITY_ID,
  RHYTHM_CAPABILITY_ID,
  RHYTHM_JUDGEMENT_POINTS,
  clampCalibration,
  classifyDelta,
  createRng,
  msPerBeat,
  noteTimeMs,
  reactionWaitMs,
  validateRhythmDocument,
  type RhythmDocument,
} from '../src/index.ts';

const WINDOWS = { perfectMs: 40, goodMs: 90, missMs: 160 };

const DOC: RhythmDocument = {
  schemaVersion: 1,
  charts: [
    {
      schemaVersion: 1,
      id: 'demo',
      audioRole: 'music.demo',
      bpm: 120,
      offsetMs: 500,
      judgementWindows: WINDOWS,
      notes: [
        { id: 'n1', beat: 0, action: 'CONFIRM' },
        { id: 'n2', beat: 1, action: 'CONFIRM' },
        { id: 'n3', timeMs: 4000, action: 'PRIMARY_ACTION', lane: 'right' },
      ],
    },
  ],
};

describe('rhythm contract', () => {
  it('publishes both Phase 17 capability ids', () => {
    expect(RHYTHM_CAPABILITY_ID).toBe('arcade.rhythm');
    expect(REACTION_CAPABILITY_ID).toBe('arcade.reaction');
  });

  it('fixes judgement points so a chart cannot inflate its own score', () => {
    expect(RHYTHM_JUDGEMENT_POINTS).toEqual({ perfect: 100, good: 50, miss: 0 });
  });
});

describe('beat conversion', () => {
  it('converts tempo to milliseconds per beat', () => {
    expect(msPerBeat(120)).toBe(500);
    expect(msPerBeat(60)).toBe(1000);
    expect(msPerBeat(180)).toBeCloseTo(333.3333, 4);
  });

  it('resolves a beat note against tempo and offset, deterministically', () => {
    const chart = DOC.charts[0]!;
    expect(noteTimeMs(chart.notes[0]!, chart.bpm, chart.offsetMs)).toBe(500); // offset + 0 beats
    expect(noteTimeMs(chart.notes[1]!, chart.bpm, chart.offsetMs)).toBe(1000); // offset + 1 beat
  });

  it('takes a timeMs note literally, ignoring the offset', () => {
    const chart = DOC.charts[0]!;
    expect(noteTimeMs(chart.notes[2]!, chart.bpm, chart.offsetMs)).toBe(4000);
  });
});

describe('classifyDelta', () => {
  it('classifies at and inside each window boundary', () => {
    expect(classifyDelta(0, WINDOWS)).toBe('perfect');
    expect(classifyDelta(40, WINDOWS)).toBe('perfect'); // exactly at the perfect edge
    expect(classifyDelta(-40, WINDOWS)).toBe('perfect');
    expect(classifyDelta(40.01, WINDOWS)).toBe('good');
    expect(classifyDelta(90, WINDOWS)).toBe('good'); // exactly at the good edge
    expect(classifyDelta(90.01, WINDOWS)).toBe('miss');
    expect(classifyDelta(160, WINDOWS)).toBe('miss'); // exactly at the miss edge
  });

  it('returns null beyond the miss window - nothing to judge', () => {
    expect(classifyDelta(160.01, WINDOWS)).toBeNull();
    expect(classifyDelta(-500, WINDOWS)).toBeNull();
  });

  it('is symmetric: early and late judge the same', () => {
    for (const delta of [10, 45, 100, 155]) {
      expect(classifyDelta(delta, WINDOWS)).toBe(classifyDelta(-delta, WINDOWS));
    }
  });
});

describe('clampCalibration', () => {
  it('bounds calibration so it shifts judgement rather than rewriting the chart', () => {
    expect(clampCalibration(0)).toBe(0);
    expect(clampCalibration(50)).toBe(50);
    expect(clampCalibration(MAX_CALIBRATION_MS + 1000)).toBe(MAX_CALIBRATION_MS);
    expect(clampCalibration(-MAX_CALIBRATION_MS - 1000)).toBe(-MAX_CALIBRATION_MS);
    expect(clampCalibration(Number.NaN)).toBe(0);
  });
});

describe('reactionWaitMs', () => {
  const config = { rounds: 3, minWaitMs: 800, maxWaitMs: 2000, seed: 4242 };

  it('is deterministic for a given seed and round', () => {
    expect(reactionWaitMs(config, 1, createRng)).toBe(reactionWaitMs(config, 1, createRng));
  });

  it('varies between rounds so a player cannot learn the wait', () => {
    expect(reactionWaitMs(config, 1, createRng)).not.toBe(reactionWaitMs(config, 2, createRng));
  });

  it('stays inside the authored bounds', () => {
    for (let round = 1; round <= 40; round++) {
      const wait = reactionWaitMs(config, round, createRng);
      expect(wait).toBeGreaterThanOrEqual(config.minWaitMs);
      expect(wait).toBeLessThanOrEqual(config.maxWaitMs);
    }
  });

  it('returns the fixed wait when the bounds coincide', () => {
    expect(reactionWaitMs({ ...config, minWaitMs: 900, maxWaitMs: 900 }, 1, createRng)).toBe(900);
  });

  it('changes with the seed', () => {
    expect(reactionWaitMs(config, 1, createRng)).not.toBe(reactionWaitMs({ ...config, seed: 99 }, 1, createRng));
  });
});

describe('validateRhythmDocument', () => {
  it('accepts a well-formed document', () => {
    expect(() => validateRhythmDocument(DOC)).not.toThrow();
  });

  it('requires at least one chart', () => {
    expect(() => validateRhythmDocument({ schemaVersion: 1, charts: [] })).toThrow(InvalidRhythmChartError);
  });

  it('rejects duplicate chart and note ids', () => {
    expect(() => validateRhythmDocument({ ...DOC, charts: [DOC.charts[0]!, DOC.charts[0]!] })).toThrow(
      /Duplicate chart id/,
    );
    expect(() =>
      validateRhythmDocument({
        ...DOC,
        charts: [{ ...DOC.charts[0]!, notes: [DOC.charts[0]!.notes[0]!, DOC.charts[0]!.notes[0]!] }],
      }),
    ).toThrow(/duplicate note id/);
  });

  it('rejects windows that are not ordered perfect <= good <= miss', () => {
    expect(() =>
      validateRhythmDocument({
        ...DOC,
        charts: [{ ...DOC.charts[0]!, judgementWindows: { perfectMs: 100, goodMs: 50, missMs: 160 } }],
      }),
    ).toThrow(/perfect <= good <= miss/);
    expect(() =>
      validateRhythmDocument({
        ...DOC,
        charts: [{ ...DOC.charts[0]!, judgementWindows: { perfectMs: 40, goodMs: 200, missMs: 160 } }],
      }),
    ).toThrow(/perfect <= good <= miss/);
  });

  it('requires exactly one of timeMs or beat per note', () => {
    expect(() =>
      validateRhythmDocument({
        ...DOC,
        charts: [{ ...DOC.charts[0]!, notes: [{ id: 'x', action: 'CONFIRM' }] }],
      }),
    ).toThrow(/exactly one of timeMs or beat/);
    expect(() =>
      validateRhythmDocument({
        ...DOC,
        charts: [{ ...DOC.charts[0]!, notes: [{ id: 'x', action: 'CONFIRM', timeMs: 100, beat: 1 }] }],
      }),
    ).toThrow(/exactly one of timeMs or beat/);
  });

  it('rejects a non-positive tempo and a note that resolves before zero', () => {
    expect(() => validateRhythmDocument({ ...DOC, charts: [{ ...DOC.charts[0]!, bpm: 0 }] })).toThrow(/bpm/);
    expect(() =>
      validateRhythmDocument({
        ...DOC,
        charts: [{ ...DOC.charts[0]!, offsetMs: -5000, notes: [{ id: 'x', beat: 0, action: 'CONFIRM' }] }],
      }),
    ).toThrow(/not a valid time/);
  });

  it('rejects calibration beyond the bound and a non-positive hold', () => {
    expect(() => validateRhythmDocument({ ...DOC, calibrationMs: 5000 })).toThrow(/calibrationMs/);
    expect(() =>
      validateRhythmDocument({
        ...DOC,
        charts: [{ ...DOC.charts[0]!, notes: [{ id: 'x', beat: 0, action: 'CONFIRM', holdMs: 0 }] }],
      }),
    ).toThrow(/holdMs/);
  });
});
