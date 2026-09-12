/**
 * Local-play authoring surface (Category-C Wave 7 / ADR-0034).
 *
 * A compact read-only view of `content/local-play.json`. Renders a quiet
 * "no seats" line when the catalog is the inert empty document every
 * generated game ships. Calls `POST /api/local-play/inspect`.
 */

import { el, replace } from '../dom.ts';
import * as api from '../api.ts';

interface InspectResult {
  present: boolean;
  mode: string;
  playerCount: number;
  turns: number | null;
}

export function renderLocalPlayLab(host: HTMLElement, gameId: string): () => void {
  const body = el('div', { class: 'pane__body', style: { 'font-size': '12px' } });
  replace(host, el('h3', { class: 'section-title', text: 'Local play' }), body);
  let disposed = false;

  async function refresh(): Promise<void> {
    try {
      const r = await api.post<InspectResult>('/local-play/inspect', { gameId });
      if (disposed) return;
      if (!r.present) {
        replace(body, el('div', { class: 'faint', text: 'No seats in content/local-play.json (inert).' }));
        return;
      }
      replace(
        body,
        el(
          'div',
          { class: 'faint', text: `${r.mode} · seats ${r.playerCount}${r.turns !== null ? ` · ${r.turns} turns` : ''}` },
        ),
      );
    } catch {
      if (disposed) return;
      replace(body, el('div', { class: 'faint', text: 'No content/local-play.json.' }));
    }
  }

  void refresh();
  return () => {
    disposed = true;
  };
}
