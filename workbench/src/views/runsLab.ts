/**
 * Run lifecycle & roguelite meta-progression authoring surface (capability program Phase 13).
 *
 * Inspects and edits `content/runs.json` (seed policy, starting transient currency,
 * carryover rules, rewards, reset scopes, upgrades).
 *
 * Calls `POST /api/runs/inspect` and `POST /api/runs/update`.
 */

import { el, replace } from '../dom.ts';
import * as api from '../api.ts';

interface RunDefinitionModel {
  id: string;
  displayName?: string;
  seedPolicy: {
    kind: 'fixed' | 'increment-attempt' | 'run-counter-derived';
    seed?: number;
    baseSeed?: number;
    step?: number;
  };
  startingTransientCurrency?: number;
  resumable?: boolean;
  resetScopes?: string[];
  rewardRules?: {
    onVictory?: { metaCurrency?: number; xp?: number; unlockFlags?: string[] };
    onDefeat?: { metaCurrency?: number; xp?: number; unlockFlags?: string[] };
  };
  upgrades?: Array<{
    id: string;
    displayName: string;
    cost: number;
    kind: 'transient' | 'permanent';
    effectRef?: string;
  }>;
}

interface RunsInspectResult {
  runs: {
    schemaVersion: number;
    runs: RunDefinitionModel[];
  };
}

export function renderRunsLab(host: HTMLElement, gameId: string): () => void {
  const body = el('div', { class: 'pane__body', style: { 'font-size': '12px' } });
  replace(host, el('h3', { class: 'section-title', text: 'Run Lifecycle & Roguelite Meta-Progression' }), body);
  let disposed = false;

  async function refresh(): Promise<void> {
    try {
      const r = await api.post<RunsInspectResult>('/lifecycle/inspect', { gameId });
      if (disposed) return;

      const runs = r.runs.runs ?? [];
      if (runs.length === 0) {
        replace(body, el('div', { class: 'faint', text: 'content/runs.json contains no run definitions.' }));
        return;
      }

      const runElements = runs.map((run) => {
        const seedPolicyDesc =
          run.seedPolicy.kind === 'fixed'
            ? `fixed (seed: ${run.seedPolicy.seed ?? 1337})`
            : run.seedPolicy.kind === 'increment-attempt'
              ? `increment-attempt (base: ${run.seedPolicy.baseSeed ?? 1337}, step: ${run.seedPolicy.step ?? 1})`
              : `run-counter-derived (base: ${run.seedPolicy.baseSeed ?? 1337})`;

        const currencyInput = el('input', {
          attrs: {
            type: 'number',
            min: '0',
            value: String(run.startingTransientCurrency ?? 0),
          },
          style: { width: '60px', padding: '2px 4px', 'font-size': '12px' },
        }) as HTMLInputElement;

        const saveBtn = el('button', { class: 'btn btn--sm', text: 'Save' });
        const statusMsg = el('span', { class: 'faint', style: { 'margin-left': '6px', 'font-size': '11px' } });

        saveBtn.addEventListener('click', async () => {
          const nextVal = parseInt(currencyInput.value, 10);
          if (isNaN(nextVal) || nextVal < 0) return;
          run.startingTransientCurrency = nextVal;
          saveBtn.disabled = true;
          statusMsg.textContent = 'Saving...';
          try {
            await api.post('/lifecycle/update', { gameId, runs: r.runs });
            statusMsg.textContent = 'Saved!';
            setTimeout(() => {
              statusMsg.textContent = '';
            }, 2000);
          } catch (err) {
            statusMsg.textContent = `Error: ${err instanceof Error ? err.message : String(err)}`;
          } finally {
            saveBtn.disabled = false;
          }
        });

        return el(
          'div',
          {
            style: {
              'border-bottom': '1px solid var(--color-border, #333)',
              'padding-bottom': '8px',
              'margin-bottom': '8px',
            },
          },
          el('div', { style: { 'font-weight': 'bold', 'margin-bottom': '4px' }, text: `${run.displayName ?? run.id} (${run.id})` }),
          el('div', { class: 'faint', text: `Seed policy: ${seedPolicyDesc}` }),
          el('div', { class: 'faint', text: `Resumable: ${run.resumable ? 'yes' : 'no'}` }),
          el('div', { class: 'faint', text: `Upgrades defined: ${run.upgrades?.length ?? 0}` }),
          el(
            'div',
            { style: { 'margin-top': '6px', display: 'flex', 'align-items': 'center', gap: '6px' } },
            el('span', { text: 'Starting currency:' }),
            currencyInput,
            saveBtn,
            statusMsg,
          ),
        );
      });

      replace(body, ...runElements);
    } catch {
      if (disposed) return;
      replace(body, el('div', { class: 'faint', text: 'No content/runs.json in project.' }));
    }
  }

  void refresh();
  return () => {
    disposed = true;
  };
}
