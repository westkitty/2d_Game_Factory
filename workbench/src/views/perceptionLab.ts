/**
 * AI Perception authoring surface (capability program Phase 11).
 *
 * Minimum authoring controls for perception configuration:
 * vision range, field of view, awareness gain, awareness decay,
 * memory, hearing, and pursuit thresholds.
 *
 * Calls `POST /api/perception/inspect`.
 */

import { el, replace } from '../dom.ts';
import * as api from '../api.ts';

interface PerceptionInspectResult {
  sensors: {
    id: string;
    visionRange: number;
    fieldOfViewDegrees: number;
    awarenessGainPerSecond: number;
    awarenessDecayPerSecond: number;
    memoryMs: number;
    hearingRange: number;
    hearingMultiplier: number;
  }[];
  pursuits: {
    pursuerId: string;
    targetId: string;
    safeDistance: number;
    dangerDistance: number;
    captureDistance: number;
    graceMs: number;
  }[];
}

export function renderPerceptionLab(host: HTMLElement, gameId: string): () => void {
  const body = el('div', { class: 'pane__body', style: { 'font-size': '12px' } });
  replace(host, el('h3', { class: 'section-title', text: 'AI Perception & Pursuit' }), body);
  let disposed = false;

  async function refresh(): Promise<void> {
    try {
      const r = await api.post<PerceptionInspectResult>('/perception/inspect', { gameId });
      if (disposed) return;
      replace(
        body,
        el('div', { class: 'faint', text: 'Sensors' }),
        el(
          'ul',
          {
            style: {
              'list-style': 'none',
              margin: '2px 0 8px',
              padding: '0',
              display: 'flex',
              'flex-direction': 'column',
              gap: '4px',
            },
          },
          ...r.sensors.map((s) =>
            el(
              'li',
              {},
              el('strong', { text: s.id }),
              el('span', {
                class: 'faint',
                text: ` · range ${s.visionRange}px · FOV ${s.fieldOfViewDegrees}° · gain ${s.awarenessGainPerSecond}/s · decay ${s.awarenessDecayPerSecond}/s · memory ${s.memoryMs}ms · hearing ${s.hearingRange}px (×${s.hearingMultiplier})`,
              }),
            ),
          ),
        ),
        r.pursuits.length > 0 ? el('div', { class: 'faint', text: 'Pursuit Thresholds' }) : null,
        r.pursuits.length > 0
          ? el(
              'ul',
              {
                style: {
                  'list-style': 'none',
                  margin: '2px 0 0',
                  padding: '0',
                  display: 'flex',
                  'flex-direction': 'column',
                  gap: '4px',
                },
              },
              ...r.pursuits.map((p) =>
                el(
                  'li',
                  {},
                  el('strong', { text: `${p.pursuerId} → ${p.targetId}` }),
                  el('span', {
                    class: 'faint',
                    text: ` · safe ${p.safeDistance}px · danger ${p.dangerDistance}px · capture ${p.captureDistance}px · grace ${p.graceMs}ms`,
                  }),
                ),
              ),
            )
          : null,
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
