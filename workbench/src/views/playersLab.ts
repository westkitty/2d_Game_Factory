/**
 * Local multiplayer roster authoring surface (post-ten program Phase 15).
 *
 * Edits `content/players.json`: how many players a game seats, whether they must
 * ready up, the slot ids, and the gamepad deadzone. Authoring this document is
 * what grants a generated game the `input.players` capability, so the panel says
 * so rather than leaving the creator to infer it.
 *
 * Calls `POST /api/roster/inspect` and `POST /api/roster/update`.
 */

import { el, replace } from '../dom.ts';
import * as api from '../api.ts';

interface RosterModel {
  schemaVersion: 1;
  minPlayers: number;
  maxPlayers: number;
  requireReady?: boolean;
  playerIds?: string[];
  deadzone?: { stick: number; trigger: number };
}

interface PlayersInspectResult {
  roster: RosterModel;
  keyboardProfileIds: string[];
}

function numberField(label: string, value: number, attrs: Record<string, string>): {
  row: HTMLElement;
  input: HTMLInputElement;
} {
  const input = el('input', {
    attrs: { type: 'number', value: String(value), ...attrs },
    style: { width: '70px', padding: '2px 4px', 'font-size': '12px' },
  }) as HTMLInputElement;
  const row = el(
    'div',
    { style: { display: 'flex', 'align-items': 'center', gap: '6px', 'margin-bottom': '4px' } },
    el('span', { style: { 'min-width': '150px' }, text: label }),
    input,
  );
  return { row, input };
}

export function renderPlayersLab(host: HTMLElement, gameId: string): () => void {
  const body = el('div', { class: 'pane__body', style: { 'font-size': '12px' } });
  replace(host, el('h3', { class: 'section-title', text: 'Local Multiplayer Roster' }), body);
  let disposed = false;

  async function refresh(): Promise<void> {
    try {
      const result = await api.post<PlayersInspectResult>('/roster/inspect', { gameId });
      if (disposed) return;
      const roster = result.roster;

      const min = numberField('Minimum players', roster.minPlayers, { min: '1', step: '1' });
      const max = numberField('Maximum players', roster.maxPlayers, { min: '1', step: '1' });
      const stick = numberField('Gamepad stick deadzone', roster.deadzone?.stick ?? 0.25, {
        min: '0',
        max: '0.9',
        step: '0.05',
      });
      const trigger = numberField('Gamepad trigger deadzone', roster.deadzone?.trigger ?? 0.1, {
        min: '0',
        max: '0.9',
        step: '0.05',
      });

      const readyBox = el('input', {
        attrs: { type: 'checkbox', ...(roster.requireReady ? { checked: 'checked' } : {}) },
      }) as HTMLInputElement;
      const readyRow = el(
        'div',
        { style: { display: 'flex', 'align-items': 'center', gap: '6px', 'margin-bottom': '4px' } },
        el('span', { style: { 'min-width': '150px' }, text: 'Require ready to start' }),
        readyBox,
      );

      const status = el('span', { class: 'faint', style: { 'margin-left': '8px', 'font-size': '11px' } });
      const saveBtn = el('button', { class: 'btn btn--sm', text: 'Save' });

      saveBtn.addEventListener('click', async () => {
        const next: RosterModel = {
          schemaVersion: 1,
          minPlayers: Number.parseInt(min.input.value, 10),
          maxPlayers: Number.parseInt(max.input.value, 10),
          requireReady: readyBox.checked,
          deadzone: {
            stick: Number.parseFloat(stick.input.value),
            trigger: Number.parseFloat(trigger.input.value),
          },
        };
        // playerIds must stay exactly maxPlayers long, so carry it only while it
        // still agrees; otherwise drop it and let the runtime generate p1..pN.
        if (roster.playerIds && roster.playerIds.length === next.maxPlayers) {
          next.playerIds = roster.playerIds;
        }
        saveBtn.disabled = true;
        status.textContent = 'Saving...';
        try {
          await api.post('/roster/update', { gameId, roster: next });
          status.textContent = 'Saved!';
          setTimeout(() => {
            status.textContent = '';
          }, 2000);
        } catch (error) {
          status.textContent = `Error: ${error instanceof Error ? error.message : String(error)}`;
        } finally {
          saveBtn.disabled = false;
        }
      });

      replace(
        body,
        el('div', {
          class: 'faint',
          style: { 'margin-bottom': '8px' },
          text: 'This document grants the game the input.players routing capability. Removing it returns the game to a single shared input.',
        }),
        min.row,
        max.row,
        readyRow,
        stick.row,
        trigger.row,
        el('div', {
          class: 'faint',
          style: { 'margin-top': '6px' },
          text: `Slots: ${roster.playerIds?.join(', ') ?? `p1..p${roster.maxPlayers} (generated)`}`,
        }),
        el('div', {
          class: 'faint',
          text: `Keyboard profiles available to seat on: ${result.keyboardProfileIds.join(', ')}`,
        }),
        el('div', { style: { 'margin-top': '8px' } }, saveBtn, status),
      );
    } catch {
      if (disposed) return;
      replace(body, el('div', { class: 'faint', text: 'No content/players.json in project (single-player input).' }));
    }
  }

  void refresh();
  return () => {
    disposed = true;
  };
}
