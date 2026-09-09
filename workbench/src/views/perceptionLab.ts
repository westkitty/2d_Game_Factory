/**
 * Perception authoring surface (Category-C Wave 4 / ADR-0031).
 *
 * A compact read-only view of `content/perception.json`. Renders a quiet
 * "no perception" line when the catalog is the inert empty document every
 * generated game ships. Calls `POST /api/perception/inspect`.
 */

import { el, replace } from '../dom.ts';
import * as api from '../api.ts';

interface InspectResult {
  present: boolean;
  mode: string;
  observerCount: number;
  coverCount: number;
  objectiveCount: number;
  exitCount: number;
  observers: { id: string; fovDeg: number; range: number }[];
}

export function renderPerceptionLab(host: HTMLElement, gameId: string): () => void {
  const body = el('div', { class: 'pane__body', style: { 'font-size': '12px' } });
  replace(host, el('h3', { class: 'section-title', text: 'Perception' }), body);
  let disposed = false;

  async function refresh(): Promise<void> {
    try {
      const r = await api.post<InspectResult>('/perception/inspect', { gameId });
      if (disposed) return;
      if (!r.present) {
        replace(body, el('div', { class: 'faint', text: 'No observers in content/perception.json (inert).' }));
        return;
      }
      replace(
        body,
        el('div', { class: 'faint', text: `${r.mode} · ${r.observerCount} observer${r.observerCount === 1 ? '' : 's'} · cover ${r.coverCount} · loot ${r.objectiveCount} · exits ${r.exitCount}` }),
        el(
          'ul',
          { style: { 'list-style': 'none', margin: '4px 0 0', padding: '0', display: 'flex', 'flex-direction': 'column', gap: '2px' } },
          ...r.observers.map((o) =>
            el(
              'li',
              {},
              el('strong', { text: o.id }),
              el('span', { class: 'faint', text: ` · fov ${o.fovDeg}° range ${o.range}` }),
            ),
          ),
        ),
      );
    } catch {
      if (disposed) return;
      replace(body, el('div', { class: 'faint', text: 'No content/perception.json.' }));
    }
  }

  void refresh();
  return () => {
    disposed = true;
  };
}
