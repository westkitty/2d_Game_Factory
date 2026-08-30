/**
 * Simulation agents authoring surface (post-ten program Phase 18).
 *
 * Tunes the two things a creator re-tunes constantly: how fast each need drifts
 * and where its thresholds sit, and how strongly each behaviour is pulled by
 * each need. Preconditions, effects and schedules are **reported, not edited** -
 * they are structural, and a form for wiring arbitrary conditions here would be
 * a visual scripting environment, which this is deliberately not.
 *
 * The panel surfaces what JSON hides while tuning: how many seconds each need
 * takes to reach its warning and critical thresholds at the authored rate.
 *
 * Calls `POST /api/needs/inspect` and `POST /api/needs/update`.
 */

import { el, replace } from '../dom.ts';
import * as api from '../api.ts';

interface NeedSummary {
  id: string;
  displayName: string;
  minimum: number;
  maximum: number;
  initial: number;
  changePerSecond: number;
  warningThreshold: number;
  criticalThreshold: number;
  secondsToWarning: number | null;
  secondsToCritical: number | null;
}

interface BehaviorSummary {
  id: string;
  displayName: string;
  baseUtility: number;
  needWeights: Record<string, number>;
  durationMs: number;
  cooldownMs: number;
  interruptible: boolean;
  preconditionCount: number;
  effectCount: number;
}

interface DocumentModel {
  schemaVersion: 1;
  decisionIntervalMs?: number;
  needs: NeedSummary[];
  behaviors: { id: string; baseUtility: number; needWeights?: Record<string, number> }[];
  agents: unknown[];
  workOrders?: unknown[];
}

interface InspectResult {
  document: DocumentModel;
  needs: NeedSummary[];
  behaviors: BehaviorSummary[];
  agentCount: number;
  workOrderCount: number;
  decisionIntervalMs: number;
}

function field(label: string, value: number, attrs: Record<string, string>): {
  row: HTMLElement;
  input: HTMLInputElement;
} {
  const input = el('input', {
    attrs: { type: 'number', value: String(value), ...attrs },
    style: { width: '80px', padding: '2px 4px', 'font-size': '12px' },
  }) as HTMLInputElement;
  const row = el(
    'div',
    { style: { display: 'flex', 'align-items': 'center', gap: '6px', 'margin-bottom': '4px' } },
    el('span', { style: { 'min-width': '160px' }, text: label }),
    input,
  );
  return { row, input };
}

function seconds(value: number | null): string {
  return value === null ? 'never' : `${value}s`;
}

export function renderAgentsLab(host: HTMLElement, gameId: string): () => void {
  const body = el('div', { class: 'pane__body', style: { 'font-size': '12px' } });
  replace(host, el('h3', { class: 'section-title', text: 'Simulation Agents' }), body);
  let disposed = false;

  async function refresh(): Promise<void> {
    try {
      const result = await api.post<InspectResult>('/needs/inspect', { gameId });
      if (disposed) return;
      const doc = result.document;

      const interval = field('Decision interval (ms)', result.decisionIntervalMs, { min: '1', step: '50' });
      const status = el('span', { class: 'faint', style: { 'margin-left': '8px', 'font-size': '11px' } });
      const saveBtn = el('button', { class: 'btn btn--sm', text: 'Save' });

      const needInputs = result.needs.map((need) => {
        const rate = field('Change per second', need.changePerSecond, { step: '0.5' });
        const warning = field('Warning threshold', need.warningThreshold, { step: '1' });
        const critical = field('Critical threshold', need.criticalThreshold, { step: '1' });
        const block = el(
          'div',
          {
            style: {
              'border-bottom': '1px solid var(--color-border, #333)',
              'padding-bottom': '8px',
              'margin-bottom': '8px',
            },
          },
          el('div', { style: { 'font-weight': 'bold' }, text: `${need.displayName} (${need.id})` }),
          el('div', {
            class: 'faint',
            text: `Range ${need.minimum}..${need.maximum}, starts at ${need.initial}`,
          }),
          rate.row,
          warning.row,
          critical.row,
          el('div', {
            class: 'faint',
            text: `At this rate: warning after ${seconds(need.secondsToWarning)}, critical after ${seconds(need.secondsToCritical)}`,
          }),
        );
        return { id: need.id, block, rate, warning, critical };
      });

      const behaviorInputs = result.behaviors.map((behavior) => {
        const base = field('Base utility', behavior.baseUtility, { step: '0.5' });
        const weights = Object.entries(behavior.needWeights).map(([needId, weight]) => ({
          needId,
          input: field(`Weight: ${needId}`, weight, { step: '0.5' }),
        }));
        const block = el(
          'div',
          {
            style: {
              'border-bottom': '1px solid var(--color-border, #333)',
              'padding-bottom': '8px',
              'margin-bottom': '8px',
            },
          },
          el('div', { style: { 'font-weight': 'bold' }, text: `${behavior.displayName} (${behavior.id})` }),
          base.row,
          ...weights.map((entry) => entry.input.row),
          el('div', {
            class: 'faint',
            text:
              `${behavior.durationMs}ms, cooldown ${behavior.cooldownMs}ms, ` +
              `${behavior.interruptible ? 'interruptible' : 'NOT interruptible'}`,
          }),
          el('div', {
            class: 'faint',
            text: `${behavior.preconditionCount} precondition(s), ${behavior.effectCount} effect(s) - authored in content/agents.json`,
          }),
        );
        return { id: behavior.id, block, base, weights };
      });

      saveBtn.addEventListener('click', async () => {
        const next: DocumentModel = {
          ...doc,
          decisionIntervalMs: Number.parseFloat(interval.input.value),
          needs: doc.needs.map((need) => {
            const inputs = needInputs.find((entry) => entry.id === need.id);
            if (!inputs) return need;
            return {
              ...need,
              changePerSecond: Number.parseFloat(inputs.rate.input.value),
              warningThreshold: Number.parseFloat(inputs.warning.input.value),
              criticalThreshold: Number.parseFloat(inputs.critical.input.value),
            };
          }),
          behaviors: doc.behaviors.map((behavior) => {
            const inputs = behaviorInputs.find((entry) => entry.id === behavior.id);
            if (!inputs) return behavior;
            const weights: Record<string, number> = { ...(behavior.needWeights ?? {}) };
            for (const entry of inputs.weights) weights[entry.needId] = Number.parseFloat(entry.input.input.value);
            return {
              ...behavior,
              baseUtility: Number.parseFloat(inputs.base.input.value),
              ...(Object.keys(weights).length > 0 ? { needWeights: weights } : {}),
            };
          }),
        };

        saveBtn.disabled = true;
        status.textContent = 'Saving...';
        try {
          await api.post('/needs/update', { gameId, document: next });
          status.textContent = 'Saved!';
          setTimeout(() => {
            status.textContent = '';
          }, 2000);
          void refresh();
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
          text: `${result.agentCount} archetype(s), ${result.workOrderCount} work order(s). Need ids and behaviour ids are authored - the capability assumes no vocabulary of its own.`,
        }),
        interval.row,
        el('div', { style: { 'font-weight': 'bold', 'margin-top': '8px' }, text: 'Needs' }),
        ...needInputs.map((entry) => entry.block),
        el('div', { style: { 'font-weight': 'bold' }, text: 'Behaviour utility' }),
        ...behaviorInputs.map((entry) => entry.block),
        el('div', {
          class: 'faint',
          text: 'Preconditions, effects, schedules and work orders are authored in content/agents.json - this panel tunes feel, not structure.',
        }),
        el('div', { style: { 'margin-top': '8px' } }, saveBtn, status),
      );
    } catch {
      if (disposed) return;
      replace(body, el('div', { class: 'faint', text: 'No content/agents.json in project.' }));
    }
  }

  void refresh();
  return () => {
    disposed = true;
  };
}
