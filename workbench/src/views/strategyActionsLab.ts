/**
 * Strategy orders & tactical actions authoring surface (capability program Phase 14).
 *
 * Reports the validated `content/strategy-actions.json` catalog: the per-turn
 * action-point budget, and for each action its order kind, targeting mode,
 * range window, cost, cooldown, uses-per-turn, team requirement and target filter.
 *
 * Calls `POST /api/tactics/inspect`.
 */

import { el, replace } from '../dom.ts';
import * as api from '../api.ts';

interface StrategyActionRow {
  id: string;
  displayName: string;
  orderKind: string;
  targeting: string;
  range: number;
  minRange: number | null;
  cost: number;
  cooldownTicks: number;
  usesPerTurn: number | null;
  requiresTeam: string | null;
  targetFilter: string;
}

interface StrategyActionsInspectResult {
  actionPointsPerTurn: number;
  actions: StrategyActionRow[];
}

function rangeText(action: StrategyActionRow): string {
  if (action.targeting === 'none') return 'self / targetless';
  return action.minRange === null ? `0 - ${action.range}` : `${action.minRange} - ${action.range}`;
}

export function renderStrategyActionsLab(host: HTMLElement, gameId: string): () => void {
  const body = el('div', { class: 'pane__body', style: { 'font-size': '12px' } });
  replace(host, el('h3', { class: 'section-title', text: 'Strategy Orders & Tactical Actions' }), body);
  let disposed = false;

  async function refresh(): Promise<void> {
    try {
      const r = await api.post<StrategyActionsInspectResult>('/tactics/inspect', { gameId });
      if (disposed) return;

      if (r.actions.length === 0) {
        replace(body, el('div', { class: 'faint', text: 'content/strategy-actions.json defines no actions.' }));
        return;
      }

      const rows = r.actions.map((action) =>
        el(
          'div',
          {
            style: {
              'border-bottom': '1px solid var(--color-border, #333)',
              'padding-bottom': '6px',
              'margin-bottom': '6px',
            },
          },
          el('div', { style: { 'font-weight': 'bold' }, text: `${action.displayName} (${action.id})` }),
          el('div', { class: 'faint', text: `Raises: ${action.orderKind} order - targets: ${action.targeting} (${action.targetFilter})` }),
          el('div', { class: 'faint', text: `Range: ${rangeText(action)}` }),
          el('div', {
            class: 'faint',
            text:
              `Cost: ${action.cost} AP` +
              ` - cooldown: ${action.cooldownTicks} tick${action.cooldownTicks === 1 ? '' : 's'}` +
              ` - uses/turn: ${action.usesPerTurn === null ? 'unlimited' : String(action.usesPerTurn)}`,
          }),
          ...(action.requiresTeam !== null
            ? [el('div', { class: 'faint', text: `Restricted to team: ${action.requiresTeam}` })]
            : []),
        ),
      );

      replace(
        body,
        el('div', { class: 'faint', style: { 'margin-bottom': '6px' }, text: `Action points per turn: ${r.actionPointsPerTurn}` }),
        ...rows,
      );
    } catch {
      if (disposed) return;
      replace(body, el('div', { class: 'faint', text: 'No content/strategy-actions.json in project.' }));
    }
  }

  void refresh();
  return () => {
    disposed = true;
  };
}
