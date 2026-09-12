/**
 * Dialogue authoring surface (Category-C Wave 3 / ADR-0030).
 *
 * A compact read-only view of `content/dialogue.json`. Renders a quiet
 * "no dialogue" line when the catalog is the inert empty document every
 * generated game ships. Calls `POST /api/dialogue/inspect`.
 */

import { el, replace } from '../dom.ts';
import * as api from '../api.ts';

interface InspectResult {
  present: boolean;
  mode: string;
  startConversationId: string | null;
  conversations: { id: string; nodeCount: number }[];
  hotspots: { id: string; conversationId: string; lockedBy: string[] }[];
}

export function renderDialogueLab(host: HTMLElement, gameId: string): () => void {
  const body = el('div', { class: 'pane__body', style: { 'font-size': '12px' } });
  replace(host, el('h3', { class: 'section-title', text: 'Dialogue' }), body);
  let disposed = false;

  async function refresh(): Promise<void> {
    try {
      const r = await api.post<InspectResult>('/dialogue/inspect', { gameId });
      if (disposed) return;
      if (!r.present) {
        replace(body, el('div', { class: 'faint', text: 'No conversations in content/dialogue.json (inert).' }));
        return;
      }
      replace(
        body,
        el('div', { class: 'faint', text: `${r.mode}${r.startConversationId ? ` · start ${r.startConversationId}` : ''}` }),
        el(
          'ul',
          { style: { 'list-style': 'none', margin: '4px 0 8px', padding: '0', display: 'flex', 'flex-direction': 'column', gap: '2px' } },
          ...r.conversations.map((c) =>
            el(
              'li',
              {},
              el('strong', { text: c.id }),
              el('span', { class: 'faint', text: ` · ${c.nodeCount} node${c.nodeCount === 1 ? '' : 's'}` }),
            ),
          ),
        ),
        r.hotspots.length > 0
          ? el('div', { class: 'faint', text: `hotspots: ${r.hotspots.map((h) => h.id + (h.lockedBy.length ? ` (need ${h.lockedBy.join('+')})` : '')).join(' · ')}` })
          : null,
      );
    } catch {
      if (disposed) return;
      replace(body, el('div', { class: 'faint', text: 'No content/dialogue.json.' }));
    }
  }

  void refresh();
  return () => {
    disposed = true;
  };
}
