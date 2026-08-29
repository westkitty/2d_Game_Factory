/**
 * Physics-profile authoring surface (capability program Phase 9).
 *
 * Reports which physics backend the game uses (Arcade default, or Matter for
 * rigid bodies / constraints / grapple) and how to switch. Read-only - the
 * profile is a one-line edit to content/game.json; bodies and grapple
 * parameters are game-specific code in src/game-specific/.
 *
 * Calls `POST /api/physics/inspect`.
 */

import { el, replace } from '../dom.ts';
import * as api from '../api.ts';

interface PhysicsResult {
  profile: 'arcade' | 'matter';
  matterGravity: { x: number; y: number } | null;
  note: string;
}

export function renderPhysicsLab(host: HTMLElement, gameId: string): () => void {
  const body = el('div', { class: 'pane__body', style: { 'font-size': '12px' } });
  replace(host, el('h3', { class: 'section-title', text: 'Physics' }), body);
  let disposed = false;

  async function refresh(): Promise<void> {
    try {
      const r = await api.post<PhysicsResult>('/physics/inspect', { gameId });
      if (disposed) return;
      replace(
        body,
        el('div', {}, el('strong', { text: `backend: ${r.profile}` })),
        r.matterGravity ? el('div', { class: 'faint', text: `matter gravity: (${r.matterGravity.x}, ${r.matterGravity.y})` }) : null,
        el('div', { class: 'faint', style: { 'margin-top': '4px' }, text: r.note }),
      );
    } catch {
      if (disposed) return;
      replace(body, el('div', { class: 'faint', text: 'No content/game.json.' }));
    }
  }

  void refresh();
  return () => {
    disposed = true;
  };
}
