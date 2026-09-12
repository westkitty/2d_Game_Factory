/**
 * Timing authoring surface (Category-C Wave 10 / ADR-0037).
 *
 * A compact read-only view of `content/timing.json`. Renders a quiet
 * "no timing" line when the catalog is the inert empty document every
 * generated game ships. Calls `POST /api/timing/inspect`.
 */

import { el, replace } from '../dom.ts';
import * as api from '../api.ts';

interface InspectResult {
  present: boolean;
  mode: string;
  windowMs: number;
  hitsToWin: number;
  missesToFail: number;
}

export function renderTimingLab(host: HTMLElement, gameId: string): () => void {
  const body = el('div', { class: 'pane__body', style: { 'font-size': '12px' } });
  replace(host, el('h3', { class: 'section-title', text: 'Timing' }), body);
  let disposed = false;

  async function refresh(): Promise<void> {
    try {
      const r = await api.post<InspectResult>('/timing/inspect', { gameId });
      if (disposed) return;
      if (!r.present) {
        replace(body, el('div', { class: 'faint', text: 'No timing in content/timing.json (inert).' }));
        return;
      }
      replace(
        body,
        el(
          'div',
          { class: 'faint', text: `${r.mode} · window ${r.windowMs}ms · win ${r.hitsToWin} · fail ${r.missesToFail}` },
        ),
      );
    } catch {
      if (disposed) return;
      replace(body, el('div', { class: 'faint', text: 'No content/timing.json.' }));
    }
  }

  void refresh();
  return () => {
    disposed = true;
  };
}
