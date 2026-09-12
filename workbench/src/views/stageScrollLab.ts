/**
 * Stage-scroll authoring surface (Category-C Wave 8 / ADR-0035).
 *
 * A compact read-only view of `content/stage-scroll.json`. Renders a quiet
 * "no stage" line when the catalog is the inert empty document every
 * generated game ships. Calls `POST /api/stage-scroll/inspect`.
 */

import { el, replace } from '../dom.ts';
import * as api from '../api.ts';

interface InspectResult {
  present: boolean;
  mode: string;
  length: number;
  speed: number;
  hazardCount: number;
}

export function renderStageScrollLab(host: HTMLElement, gameId: string): () => void {
  const body = el('div', { class: 'pane__body', style: { 'font-size': '12px' } });
  replace(host, el('h3', { class: 'section-title', text: 'Stage scroll' }), body);
  let disposed = false;

  async function refresh(): Promise<void> {
    try {
      const r = await api.post<InspectResult>('/stage-scroll/inspect', { gameId });
      if (disposed) return;
      if (!r.present) {
        replace(body, el('div', { class: 'faint', text: 'No stage in content/stage-scroll.json (inert).' }));
        return;
      }
      replace(
        body,
        el(
          'div',
          { class: 'faint', text: `${r.mode} · length ${r.length} · speed ${r.speed} · hazards ${r.hazardCount}` },
        ),
      );
    } catch {
      if (disposed) return;
      replace(body, el('div', { class: 'faint', text: 'No content/stage-scroll.json.' }));
    }
  }

  void refresh();
  return () => {
    disposed = true;
  };
}
