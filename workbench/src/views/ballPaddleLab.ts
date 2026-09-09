/**
 * Ball / paddle authoring surface (Category-C Wave 5 / ADR-0032).
 *
 * A compact read-only view of `content/ball-paddle.json`. Renders a quiet
 * "no table" line when the catalog is the inert empty document every
 * generated game ships. Calls `POST /api/ball-paddle/inspect`.
 */

import { el, replace } from '../dom.ts';
import * as api from '../api.ts';

interface InspectResult {
  present: boolean;
  mode: string;
  brickCount: number;
  lives: number;
  winScore: number | null;
  paddleAxis: string;
}

export function renderBallPaddleLab(host: HTMLElement, gameId: string): () => void {
  const body = el('div', { class: 'pane__body', style: { 'font-size': '12px' } });
  replace(host, el('h3', { class: 'section-title', text: 'Ball / paddle' }), body);
  let disposed = false;

  async function refresh(): Promise<void> {
    try {
      const r = await api.post<InspectResult>('/ball-paddle/inspect', { gameId });
      if (disposed) return;
      if (!r.present) {
        replace(body, el('div', { class: 'faint', text: 'No table in content/ball-paddle.json (inert).' }));
        return;
      }
      replace(
        body,
        el(
          'div',
          { class: 'faint', text: `${r.mode} · axis ${r.paddleAxis} · bricks ${r.brickCount} · lives ${r.lives}${r.winScore !== null ? ` · first to ${r.winScore}` : ''}` },
        ),
      );
    } catch {
      if (disposed) return;
      replace(body, el('div', { class: 'faint', text: 'No content/ball-paddle.json.' }));
    }
  }

  void refresh();
  return () => {
    disposed = true;
  };
}
