/**
 * Vehicle + race authoring surface (capability program Phase 10).
 *
 * A structured read-only view of `content/vehicles.json` (profile + the major
 * handling numbers, and any surface tags) and `content/races.json` (mode, lap
 * count, countdown, ordered checkpoint ids). Editing is JSON work on the
 * files. Renders nothing when the project has neither document.
 *
 * Calls `POST /api/racing/inspect`.
 */

import { el, replace } from '../dom.ts';
import * as api from '../api.ts';

interface InspectResult {
  vehicles: { id: string; profile: string; acceleration: number; braking: number; maxForwardSpeed: number; steeringRate: number; lateralGrip: number; driftFactor: number; boostForce: number; surfaces: string[] }[];
  races: { id: string; mode: string; laps: number; countdownMs: number; checkpoints: string[]; startPositions: number }[];
}

export function renderRacingLab(host: HTMLElement, gameId: string): () => void {
  const body = el('div', { class: 'pane__body', style: { 'font-size': '12px' } });
  replace(host, el('h3', { class: 'section-title', text: 'Vehicles & racing' }), body);
  let disposed = false;

  async function refresh(): Promise<void> {
    try {
      const r = await api.post<InspectResult>('/racing/inspect', { gameId });
      if (disposed) return;
      replace(
        body,
        el('div', { class: 'faint', text: 'Vehicles' }),
        el(
          'ul',
          { style: { 'list-style': 'none', margin: '2px 0 8px', padding: '0', display: 'flex', 'flex-direction': 'column', gap: '4px' } },
          ...r.vehicles.map((v) =>
            el(
              'li',
              {},
              el('strong', { text: `${v.id}` }),
              el('span', { class: 'faint', text: ` ${v.profile} · accel ${v.acceleration} · max ${v.maxForwardSpeed} · steer ${v.steeringRate} · grip ${v.lateralGrip} · drift ${v.driftFactor} · boost ${v.boostForce}${v.surfaces.length ? ` · surfaces: ${v.surfaces.join(', ')}` : ''}` }),
            ),
          ),
        ),
        el('div', { class: 'faint', text: 'Races' }),
        el(
          'ul',
          { style: { 'list-style': 'none', margin: '2px 0 0', padding: '0', display: 'flex', 'flex-direction': 'column', gap: '4px' } },
          ...r.races.map((race) =>
            el(
              'li',
              {},
              el('strong', { text: `${race.id}` }),
              el('span', { class: 'faint', text: ` ${race.mode} · ${race.laps} lap(s) · countdown ${race.countdownMs}ms · ${race.startPositions} start pos` }),
              el('div', { class: 'faint', style: { 'word-break': 'break-all' }, text: `checkpoints: ${race.checkpoints.join(' → ') || '—'}` }),
            ),
          ),
          r.races.length === 0 ? el('li', { class: 'faint', text: 'no races defined' }) : null,
        ),
      );
    } catch {
      if (disposed) return;
      replace(body, el('div', { class: 'faint', text: 'No content/vehicles.json or content/races.json.' }));
    }
  }

  void refresh();
  return () => {
    disposed = true;
  };
}
