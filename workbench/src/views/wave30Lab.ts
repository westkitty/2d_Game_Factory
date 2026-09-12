/**
 * Wave-30 authoring surface (Category-C / ADR-0057).
 *
 * Compact read of the six leftover catalogs. Calls `POST /api/wave30/inspect`.
 */

import { el, replace } from '../dom.ts';
import * as api from '../api.ts';

interface InspectResult {
  wall: { present: boolean; mode: string; walls: number };
  territory: { present: boolean; mode: string; zones: number };
  pinball: { present: boolean; mode: string; bumpers: number };
  camera: { present: boolean; mode: string; shotsToWin: number };
  codex: { present: boolean; mode: string; entries: number };
  targeting: { present: boolean; mode: string; actors: number };
}

function line(label: string, row: { present: boolean; mode: string }): string {
  return row.present ? `${label} ${row.mode}` : `${label} inert`;
}

export function renderWave30Lab(host: HTMLElement, gameId: string): () => void {
  const body = el('div', { class: 'pane__body', style: { 'font-size': '12px' } });
  replace(host, el('h3', { class: 'section-title', text: 'Wave 30 leftovers' }), body);
  let disposed = false;

  async function refresh(): Promise<void> {
    try {
      const r = await api.post<InspectResult>('/wave30/inspect', { gameId });
      if (disposed) return;
      replace(
        body,
        el(
          'div',
          { class: 'faint', text: [line('wall', r.wall), line('territory', r.territory), line('pinball', r.pinball), line('camera', r.camera), line('codex', r.codex), line('targeting', r.targeting)].join(' · ') },
        ),
      );
    } catch {
      if (disposed) return;
      replace(body, el('div', { class: 'faint', text: 'No Wave-30 catalogs.' }));
    }
  }

  void refresh();
  return () => {
    disposed = true;
  };
}
