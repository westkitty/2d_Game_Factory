/**
 * Platformer climbing authoring surface (capability program Phase 12).
 *
 * Exposes configuration fields:
 * wall-slide speed, wall friction, wall-jump velocities,
 * wall stick duration, ledge-grab tolerances, ladder climb speed,
 * and ledge climb toggle.
 *
 * Calls `POST /api/climbing/inspect`.
 */

import { el, replace } from '../dom.ts';
import * as api from '../api.ts';

interface ClimbingInspectResult {
  config: {
    wallSlideMaxSpeed: number;
    wallFriction: number;
    wallJumpVelocityX: number;
    wallJumpVelocityY: number;
    wallStickMs: number;
    ledgeGrabToleranceX: number;
    ledgeGrabToleranceY: number;
    ladderClimbSpeed: number;
    enableLedgeClimb: boolean;
  };
}

export function renderClimbingLab(host: HTMLElement, gameId: string): () => void {
  const body = el('div', { class: 'pane__body', style: { 'font-size': '12px' } });
  replace(host, el('h3', { class: 'section-title', text: 'Climbing & Wall Traversal' }), body);
  let disposed = false;

  async function refresh(): Promise<void> {
    try {
      const r = await api.post<ClimbingInspectResult>('/climbing/inspect', { gameId });
      if (disposed) return;
      const c = r.config;
      replace(
        body,
        el(
          'ul',
          {
            style: {
              'list-style': 'none',
              margin: '0',
              padding: '0',
              display: 'flex',
              'flex-direction': 'column',
              gap: '4px',
            },
          },
          el('li', {}, el('strong', { text: 'Wall slide speed: ' }), el('span', { class: 'faint', text: `${c.wallSlideMaxSpeed} px/s` })),
          el('li', {}, el('strong', { text: 'Wall friction: ' }), el('span', { class: 'faint', text: `${c.wallFriction}` })),
          el('li', {}, el('strong', { text: 'Wall jump velocity: ' }), el('span', { class: 'faint', text: `(${c.wallJumpVelocityX}, -${c.wallJumpVelocityY})` })),
          el('li', {}, el('strong', { text: 'Wall stick: ' }), el('span', { class: 'faint', text: `${c.wallStickMs} ms` })),
          el('li', {}, el('strong', { text: 'Ledge grab tolerance: ' }), el('span', { class: 'faint', text: `dx: ${c.ledgeGrabToleranceX}px, dy: ${c.ledgeGrabToleranceY}px` })),
          el('li', {}, el('strong', { text: 'Ladder climb speed: ' }), el('span', { class: 'faint', text: `${c.ladderClimbSpeed} px/s` })),
          el('li', {}, el('strong', { text: 'Ledge climb enabled: ' }), el('span', { class: 'faint', text: c.enableLedgeClimb ? 'yes' : 'no' })),
        ),
      );
    } catch {
      if (disposed) return;
      replace(body, el('div', { class: 'faint', text: 'No content/climbing.json.' }));
    }
  }

  void refresh();
  return () => {
    disposed = true;
  };
}
