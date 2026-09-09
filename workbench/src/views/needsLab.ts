/**
 * Needs authoring surface (Category-C Wave 2 / ADR-0029).
 *
 * A compact read-only view of `content/needs.json`. Renders a quiet
 * "no needs" line when the catalog is the inert empty document every
 * generated game ships. Calls `POST /api/needs/inspect`.
 */

import { el, replace } from '../dom.ts';
import * as api from '../api.ts';

interface InspectResult {
  present: boolean;
  mode: string;
  subject: { id: string; displayName: string };
  needs: { id: string; displayName: string; value: number; decayPerSecond: number }[];
  actions: { id: string; displayName: string }[];
  win: { minValue: number; holdMs: number; minActions: number };
  loseBelow: number | null;
}

export function renderNeedsLab(host: HTMLElement, gameId: string): () => void {
  const body = el('div', { class: 'pane__body', style: { 'font-size': '12px' } });
  replace(host, el('h3', { class: 'section-title', text: 'Needs' }), body);
  let disposed = false;

  async function refresh(): Promise<void> {
    try {
      const r = await api.post<InspectResult>('/needs/inspect', { gameId });
      if (disposed) return;
      if (!r.present) {
        replace(body, el('div', { class: 'faint', text: 'No needs in content/needs.json (inert).' }));
        return;
      }
      replace(
        body,
        el('div', { class: 'faint', text: `${r.mode} · ${r.subject.displayName} · win ≥${r.win.minValue} hold ${r.win.holdMs}ms · ${r.win.minActions} acts${r.loseBelow !== null ? ` · fail ≤${r.loseBelow}` : ''}` }),
        el(
          'ul',
          { style: { 'list-style': 'none', margin: '4px 0 8px', padding: '0', display: 'flex', 'flex-direction': 'column', gap: '2px' } },
          ...r.needs.map((n) =>
            el(
              'li',
              {},
              el('strong', { text: n.displayName }),
              el('span', { class: 'faint', text: ` ${n.id} · start ${n.value} · decay ${n.decayPerSecond}/s` }),
            ),
          ),
        ),
        el('div', { class: 'faint', text: `actions: ${r.actions.map((a) => a.displayName).join(' · ') || '—'}` }),
      );
    } catch {
      if (disposed) return;
      replace(body, el('div', { class: 'faint', text: 'No content/needs.json.' }));
    }
  }

  void refresh();
  return () => {
    disposed = true;
  };
}
