/**
 * Economy authoring surface (Category-C Wave 1 / ADR-0028).
 *
 * A compact read-only view of `content/economy.json`. Renders a quiet
 * "no goods" line when the catalog is the inert empty document every
 * generated game ships. Calls `POST /api/economy/inspect`.
 */

import { el, replace } from '../dom.ts';
import * as api from '../api.ts';

interface InspectResult {
  present: boolean;
  mode: string;
  cash: number;
  autoSell: boolean;
  goods: { id: string; displayName: string; price: number; restockCost: number; stock: number }[];
  recipes: { id: string; displayName: string; outputGoodId: string; outputCount: number; durationMs: number }[];
  demand: { id: string; displayName: string; goodId: string; patienceMs: number }[];
  spawn: { firstDelayMs: number; intervalMs: number; maxQueue: number };
}

export function renderEconomyLab(host: HTMLElement, gameId: string): () => void {
  const body = el('div', { class: 'pane__body', style: { 'font-size': '12px' } });
  replace(host, el('h3', { class: 'section-title', text: 'Economy' }), body);
  let disposed = false;

  async function refresh(): Promise<void> {
    try {
      const r = await api.post<InspectResult>('/economy/inspect', { gameId });
      if (disposed) return;
      if (!r.present) {
        replace(body, el('div', { class: 'faint', text: 'No goods or demand in content/economy.json (inert).' }));
        return;
      }
      replace(
        body,
        el('div', { class: 'faint', text: `${r.mode}${r.autoSell ? ' · auto-sell' : ''} · starting cash $${r.cash} · queue cap ${r.spawn.maxQueue}` }),
        el(
          'ul',
          { style: { 'list-style': 'none', margin: '4px 0 8px', padding: '0', display: 'flex', 'flex-direction': 'column', gap: '2px' } },
          ...r.goods.map((g) =>
            el(
              'li',
              {},
              el('strong', { text: g.displayName }),
              el('span', { class: 'faint', text: ` ${g.id} · $${g.price} · stock ${g.stock}${g.restockCost ? ` · restock $${g.restockCost}` : ''}` }),
            ),
          ),
        ),
        r.recipes.length > 0
          ? el(
              'ul',
              { style: { 'list-style': 'none', margin: '0 0 8px', padding: '0' } },
              ...r.recipes.map((recipe) =>
                el('li', { class: 'faint', text: `${recipe.displayName} → ${recipe.outputCount}× ${recipe.outputGoodId} (${recipe.durationMs}ms)` }),
              ),
            )
          : null,
        el('div', { class: 'faint', text: `demand: ${r.demand.map((d) => `${d.displayName} wants ${d.goodId}`).join(' → ') || '—'}` }),
      );
    } catch {
      if (disposed) return;
      replace(body, el('div', { class: 'faint', text: 'No content/economy.json.' }));
    }
  }

  void refresh();
  return () => {
    disposed = true;
  };
}
