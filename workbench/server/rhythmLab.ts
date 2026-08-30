/**
 * Rhythm chart authoring surface (post-ten program Phase 17).
 *
 * Reads and updates `content/rhythm.json`. The editable fields are the ones a
 * creator actually tunes: tempo, the chart offset, the three judgement windows,
 * and the document-level calibration default.
 *
 * **Notes are reported, not edited here.** Placing notes against a waveform is a
 * digital-audio-workstation job; this is a game factory. A chart's notes are
 * authored in `content/rhythm.json` directly, and a numeric note grid in the
 * Workbench would be a poor imitation of a tool that already exists elsewhere.
 * What the panel does give is the thing a creator cannot easily compute by hand:
 * every note's resolved absolute time, so a beat-authored chart can be checked
 * against the music.
 *
 * Validates against urn:sw2d:schema:content-rhythm:v1 and then against the
 * contract's semantic gate, and writes atomically with path containment checks.
 */

import { existsSync, readFileSync } from 'node:fs';
import type { RhythmDocument } from '@sw2d/contracts';
import { noteTimeMs, validateRhythmDocument } from '@sw2d/contracts';
import { validateContentBundleData, validateDocumentOrThrow } from '@sw2d/schemas';
import { gameRoot, resolveContained } from './paths.ts';
import { writeJsonAtomic } from './atomicJson.ts';
import { SecurityError } from './security.ts';

export interface RhythmChartSummary {
  readonly id: string;
  readonly audioRole: string;
  readonly bpm: number;
  readonly offsetMs: number;
  readonly noteCount: number;
  readonly perfectMs: number;
  readonly goodMs: number;
  readonly missMs: number;
  /** Every note's resolved absolute time - what beat authoring actually produced. */
  readonly resolvedTimesMs: readonly number[];
  readonly durationMs: number;
}

export interface RhythmInspectResult {
  readonly document: RhythmDocument;
  readonly calibrationMs: number;
  readonly charts: readonly RhythmChartSummary[];
}

export interface RhythmUpdateResult {
  readonly ok: boolean;
  readonly document: RhythmDocument;
}

function loadDocument(gameId: string): RhythmDocument {
  const full = resolveContained(gameRoot(gameId), 'content', 'rhythm.json');
  if (!existsSync(full)) {
    throw new SecurityError(404, `No content/rhythm.json in "${gameId}".`);
  }
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(full, 'utf8'));
  } catch {
    throw new SecurityError(400, `content/rhythm.json in "${gameId}" is not valid JSON.`);
  }
  const validated = validateContentBundleData({ rhythm: raw }).rhythm!.value as RhythmDocument;
  validateRhythmDocument(validated);
  return validated;
}

export function inspectRhythm(gameId: string): RhythmInspectResult {
  const document = loadDocument(gameId);
  return {
    document,
    calibrationMs: document.calibrationMs ?? 0,
    charts: document.charts.map((chart) => {
      const times = chart.notes.map((note) => noteTimeMs(note, chart.bpm, chart.offsetMs)).sort((a, b) => a - b);
      return {
        id: chart.id,
        audioRole: chart.audioRole,
        bpm: chart.bpm,
        offsetMs: chart.offsetMs,
        noteCount: chart.notes.length,
        perfectMs: chart.judgementWindows.perfectMs,
        goodMs: chart.judgementWindows.goodMs,
        missMs: chart.judgementWindows.missMs,
        resolvedTimesMs: times,
        durationMs: times.length === 0 ? 0 : times[times.length - 1]!,
      };
    }),
  };
}

export function updateRhythm(gameId: string, payload: unknown): RhythmUpdateResult {
  if (typeof payload !== 'object' || payload === null) {
    throw new SecurityError(400, 'Rhythm update payload must be a RhythmDocument object.');
  }
  const validated = validateDocumentOrThrow('rhythm', 'content/rhythm.json', payload) as RhythmDocument;
  // The schema cannot express window ordering, or that a note authors exactly
  // one of timeMs / beat.
  try {
    validateRhythmDocument(validated);
  } catch (error) {
    throw new SecurityError(400, error instanceof Error ? error.message : String(error));
  }
  const target = resolveContained(gameRoot(gameId), 'content', 'rhythm.json');
  writeJsonAtomic(target, validated);
  return { ok: true, document: validated };
}
