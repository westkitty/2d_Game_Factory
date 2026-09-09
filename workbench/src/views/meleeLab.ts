/**
 * Melee authoring surface (Category-C Wave 6 / ADR-0033).
 *
 * A compact read-only view of `content/melee.json`. Renders a quiet
 * "no fight" line when the catalog is the inert empty document every
 * generated game ships. Calls `POST /api/melee/inspect`.
 */

import { el, replace } from '../dom.ts';
import * as api from '../api.ts';

interface InspectResult {
  present: boolean;
  mode: string;
  foeCount: number;
  strikeRange: number;
  playerHealth: number;
}

export function renderMeleeLab(host: HTMLElement, gameId: string): () => void {
  const body = el('div', { class: 'pane__body', style: { 'font-size': '12px' } });
  replace(host, el('h3', { class: 'section-title', text: 'Melee' }), body);
  let disposed = false;

  async function refresh(): Promise<void> {
    try {
      const r = await api.post<InspectResult>('/melee/inspect', { gameId });
      if (disposed) return;
      if (!r.present) {
        replace(body, el('div', { class: 'faint', text: 'No fight in content/melee.json (inert).' }));
        return;
      }
      replace(
        body,
        el(
          'div',
          { class: 'faint', text: `${r.mode} · foes ${r.foeCount} · range ${r.strikeRange} · hp ${r.playerHealth}` },
        ),
      );
    } catch {
      if (disposed) return;
      replace(body, el('div', { class: 'faint', text: 'No content/melee.json.' }));
    }
  }

  void refresh();
  return () => {
    disposed = true;
  };
}
