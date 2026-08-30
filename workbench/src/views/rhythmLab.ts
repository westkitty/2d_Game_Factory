/**
 * Rhythm chart authoring surface (post-ten program Phase 17).
 *
 * Tunes tempo, the chart offset, the three judgement windows and the calibration
 * default. Notes are **reported, not edited**: placing notes against a waveform
 * is a DAW's job, and a numeric note grid here would be a poor imitation of a
 * tool that already exists. What the panel does supply is the thing a creator
 * cannot easily compute by hand - every note's resolved absolute time, so a
 * beat-authored chart can be checked against the music it was written for.
 *
 * Calls `POST /api/beatmap/inspect` and `POST /api/beatmap/update`.
 */

import { el, replace } from '../dom.ts';
import * as api from '../api.ts';

interface ChartSummary {
  id: string;
  audioRole: string;
  bpm: number;
  offsetMs: number;
  noteCount: number;
  perfectMs: number;
  goodMs: number;
  missMs: number;
  resolvedTimesMs: number[];
  durationMs: number;
}

interface RhythmDocumentModel {
  schemaVersion: 1;
  calibrationMs?: number;
  charts: {
    schemaVersion: 1;
    id: string;
    audioRole: string;
    bpm: number;
    offsetMs: number;
    judgementWindows: { perfectMs: number; goodMs: number; missMs: number };
    notes: unknown[];
  }[];
}

interface InspectResult {
  document: RhythmDocumentModel;
  calibrationMs: number;
  charts: ChartSummary[];
}

function field(label: string, value: number, attrs: Record<string, string>): {
  row: HTMLElement;
  input: HTMLInputElement;
} {
  const input = el('input', {
    attrs: { type: 'number', value: String(value), ...attrs },
    style: { width: '80px', padding: '2px 4px', 'font-size': '12px' },
  }) as HTMLInputElement;
  const row = el(
    'div',
    { style: { display: 'flex', 'align-items': 'center', gap: '6px', 'margin-bottom': '4px' } },
    el('span', { style: { 'min-width': '170px' }, text: label }),
    input,
  );
  return { row, input };
}

export function renderRhythmLab(host: HTMLElement, gameId: string): () => void {
  const body = el('div', { class: 'pane__body', style: { 'font-size': '12px' } });
  replace(host, el('h3', { class: 'section-title', text: 'Rhythm Charts' }), body);
  let disposed = false;

  async function refresh(): Promise<void> {
    try {
      const result = await api.post<InspectResult>('/beatmap/inspect', { gameId });
      if (disposed) return;
      const doc = result.document;

      const calibration = field('Calibration (ms)', result.calibrationMs, { min: '-200', max: '200', step: '5' });
      const status = el('span', { class: 'faint', style: { 'margin-left': '8px', 'font-size': '11px' } });
      const saveBtn = el('button', { class: 'btn btn--sm', text: 'Save' });

      const chartInputs = result.charts.map((chart, index) => {
        const bpm = field('BPM', chart.bpm, { min: '1', step: '1' });
        const offset = field('Offset (ms)', chart.offsetMs, { step: '10' });
        const perfect = field('Perfect window (ms)', chart.perfectMs, { min: '1', step: '5' });
        const good = field('Good window (ms)', chart.goodMs, { min: '1', step: '5' });
        const miss = field('Miss window (ms)', chart.missMs, { min: '1', step: '5' });

        const preview = chart.resolvedTimesMs.slice(0, 8).map((time) => Math.round(time)).join(', ');
        const block = el(
          'div',
          {
            style: {
              'border-bottom': '1px solid var(--color-border, #333)',
              'padding-bottom': '8px',
              'margin-bottom': '8px',
            },
          },
          el('div', { style: { 'font-weight': 'bold' }, text: `${chart.id} (${chart.audioRole})` }),
          el('div', {
            class: 'faint',
            text: `${chart.noteCount} note(s), last at ${Math.round(chart.durationMs)}ms`,
          }),
          bpm.row,
          offset.row,
          perfect.row,
          good.row,
          miss.row,
          el('div', {
            class: 'faint',
            text: `Resolved note times: ${preview}${chart.resolvedTimesMs.length > 8 ? ', ...' : ''}`,
          }),
        );
        return { index, block, bpm, offset, perfect, good, miss };
      });

      saveBtn.addEventListener('click', async () => {
        const next: RhythmDocumentModel = {
          ...doc,
          calibrationMs: Number.parseFloat(calibration.input.value),
          charts: doc.charts.map((chart, index) => {
            const inputs = chartInputs[index];
            if (!inputs) return chart;
            return {
              ...chart,
              bpm: Number.parseFloat(inputs.bpm.input.value),
              offsetMs: Number.parseFloat(inputs.offset.input.value),
              judgementWindows: {
                perfectMs: Number.parseFloat(inputs.perfect.input.value),
                goodMs: Number.parseFloat(inputs.good.input.value),
                missMs: Number.parseFloat(inputs.miss.input.value),
              },
            };
          }),
        };

        saveBtn.disabled = true;
        status.textContent = 'Saving...';
        try {
          await api.post('/beatmap/update', { gameId, document: next });
          status.textContent = 'Saved!';
          setTimeout(() => {
            status.textContent = '';
          }, 2000);
          void refresh();
        } catch (error) {
          status.textContent = `Error: ${error instanceof Error ? error.message : String(error)}`;
        } finally {
          saveBtn.disabled = false;
        }
      });

      replace(
        body,
        el('div', {
          class: 'faint',
          style: { 'margin-bottom': '8px' },
          text: 'Windows must satisfy perfect <= good <= miss. Notes are authored in content/rhythm.json; their resolved times are shown here so a beat-authored chart can be checked.',
        }),
        calibration.row,
        ...chartInputs.map((entry) => entry.block),
        el('div', { style: { 'margin-top': '8px' } }, saveBtn, status),
      );
    } catch {
      if (disposed) return;
      replace(body, el('div', { class: 'faint', text: 'No content/rhythm.json in project.' }));
    }
  }

  void refresh();
  return () => {
    disposed = true;
  };
}
