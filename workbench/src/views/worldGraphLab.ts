/**
 * World-graph authoring surface (capability program Phase 8).
 *
 * A structured, read-only list of the project's `content/world-graph.json`:
 * every node, its level and map coordinates, its entrances, and each
 * connection with its destination entrance and bounded conditions. It shows
 * the same structural validation the runtime applies plus start-node
 * reachability, so a broken graph is visible before the game runs. Editing is
 * ordinary JSON work on the file - this is not a node-graph IDE.
 *
 * Calls `POST /api/world-graph/inspect`. Renders nothing when the project has
 * no world-graph document.
 */

import { el, replace } from '../dom.ts';
import * as api from '../api.ts';

interface InspectResult {
  id: string;
  displayName?: string;
  startNodeId: string;
  valid: boolean;
  errors: string[];
  reachableFromStart: string[];
  unreachable: string[];
  nodes: {
    id: string;
    displayName: string;
    level: string;
    mapX: number;
    mapY: number;
    entrances: string[];
    connections: { id: string; to: string; toEntrance: string; oneWay: boolean; mapLabel?: string; conditions: string[] }[];
  }[];
}

export function renderWorldGraphLab(host: HTMLElement, gameId: string): () => void {
  const body = el('div', { class: 'pane__body', style: { 'font-size': '12px' } });
  replace(host, el('h3', { class: 'section-title', text: 'World graph' }), body);
  let disposed = false;

  async function refresh(): Promise<void> {
    try {
      const r = await api.post<InspectResult>('/world-graph/inspect', { gameId });
      if (disposed) return;
      paint(r);
    } catch {
      if (disposed) return;
      replace(body, el('div', { class: 'faint', text: 'This project has no content/world-graph.json.' }));
    }
  }

  function paint(r: InspectResult): void {
    replace(
      body,
      el(
        'div',
        { style: { 'line-height': '1.6' } },
        el('div', {}, el('strong', { text: `${r.displayName ?? r.id}` }), el('span', { class: 'faint', text: `  start: ${r.startNodeId}` })),
        el(
          'div',
          {},
          el('strong', { text: r.valid ? 'valid ✓' : 'INVALID ✗' }),
          r.errors.length > 0 ? el('span', { class: 'faint', text: ` — ${r.errors.join('; ')}` }) : null,
        ),
        r.unreachable.length > 0
          ? el('div', { class: 'faint', text: `unreachable from start: ${r.unreachable.join(', ')}` })
          : el('div', { class: 'faint', text: `all ${r.reachableFromStart.length} node(s) reachable from start` }),
      ),
      el(
        'ul',
        { style: { 'list-style': 'none', margin: '8px 0 0', padding: '0', display: 'flex', 'flex-direction': 'column', gap: '8px' } },
        ...r.nodes.map((n) =>
          el(
            'li',
            { style: { border: '1px solid var(--line, #2a2a2a)', 'border-radius': '6px', padding: '8px' } },
            el('div', {}, el('strong', { text: n.displayName }), el('span', { class: 'faint', text: `  (${n.id})  ${n.level}  @${n.mapX},${n.mapY}` })),
            el('div', { class: 'faint', text: `entrances: ${n.entrances.join(', ') || '—'}` }),
            ...n.connections.map((c) =>
              el('div', { style: { 'margin-top': '2px' } }, el('span', { text: `→ ${c.to} (${c.toEntrance})${c.oneWay ? ' one-way' : ''}${c.mapLabel ? ` · “${c.mapLabel}”` : ''}` }), c.conditions.length > 0 ? el('span', { class: 'faint', text: `  if ${c.conditions.join(' & ')}` }) : el('span', { class: 'faint', text: '  (open)' })),
            ),
          ),
        ),
      ),
    );
  }

  void refresh();
  return () => {
    disposed = true;
  };
}
