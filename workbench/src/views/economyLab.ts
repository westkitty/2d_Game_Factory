/**
 * Economy authoring surface (post-ten program Phase 19).
 *
 * Tunes prices, demand, shelf capacity, recipe durations, the offline cap and
 * the prestige reward - the numbers a creator re-tunes constantly and cannot
 * judge by reading JSON. Recipe inputs/outputs, zones and customer archetypes
 * are **reported, not edited**: what a recipe *is* is structure, what it *costs*
 * is feel, and drawing a floor plan needs a canvas rather than a form.
 *
 * The panel shows what JSON hides while tuning: the margin on each good, whether
 * a recipe is worth running at all, and how long the offline cap really is.
 *
 * Calls `POST /api/ledger/inspect` and `POST /api/ledger/update`.
 */

import { el, replace } from '../dom.ts';
import * as api from '../api.ts';

interface GoodSummary {
  itemId: string;
  stock: number;
  capacity: number;
  buyPrice: number;
  sellPrice: number;
  demandMultiplier: number;
  unitSellPrice: number;
  margin: number;
}

interface RecipeSummary {
  id: string;
  displayName: string;
  stationType: string;
  durationMs: number;
  batchSize: number;
  inputs: string;
  outputs: string;
  inputCost: number;
  outputValue: number;
  locked: boolean;
}

interface DocumentModel {
  schemaVersion: 1;
  goods: GoodSummary[];
  recipes?: { id: string; durationMs: number }[];
  offline?: { maximumMs: number; efficiency?: number };
  prestige?: { id: string; rewardCurrency?: number; multiplierPerLevel?: number }[];
}

interface InspectResult {
  document: DocumentModel;
  goods: GoodSummary[];
  recipes: RecipeSummary[];
  stationCount: number;
  zoneCount: number;
  queueCount: number;
  customerCount: number;
  offlineMaximumMinutes: number | null;
  offlineEfficiency: number;
  prestigeCount: number;
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
    el('span', { style: { 'min-width': '150px' }, text: label }),
    input,
  );
  return { row, input };
}

const block = (...children: (HTMLElement | null)[]): HTMLElement =>
  el(
    'div',
    {
      style: {
        'border-bottom': '1px solid var(--color-border, #333)',
        'padding-bottom': '8px',
        'margin-bottom': '8px',
      },
    },
    ...children,
  );

export function renderEconomyLab(host: HTMLElement, gameId: string): () => void {
  const body = el('div', { class: 'pane__body', style: { 'font-size': '12px' } });
  replace(host, el('h3', { class: 'section-title', text: 'Economy' }), body);
  let disposed = false;

  async function refresh(): Promise<void> {
    try {
      const result = await api.post<InspectResult>('/ledger/inspect', { gameId });
      if (disposed) return;
      const doc = result.document;

      const status = el('span', { class: 'faint', style: { 'margin-left': '8px', 'font-size': '11px' } });
      const saveBtn = el('button', { class: 'btn btn--sm', text: 'Save' });

      const goodInputs = result.goods.map((good) => {
        const buy = field('Buy price', good.buyPrice, { min: '0', step: '1' });
        const sell = field('Sell price', good.sellPrice, { min: '0', step: '1' });
        const demand = field('Demand multiplier', good.demandMultiplier, { min: '0', step: '0.1' });
        const capacity = field('Shelf capacity', good.capacity, { min: '1', step: '1' });
        return {
          itemId: good.itemId,
          buy,
          sell,
          demand,
          capacity,
          block: block(
            el('div', { style: { 'font-weight': 'bold' }, text: good.itemId }),
            buy.row,
            sell.row,
            demand.row,
            capacity.row,
            el('div', {
              class: good.margin > 0 ? 'faint' : '',
              style: good.margin > 0 ? {} : { color: 'var(--color-warn, #d88)' },
              text:
                `Customer pays ${good.unitSellPrice}, supplier charges ${good.buyPrice} - ` +
                (good.margin > 0
                  ? `margin ${good.margin} per unit.`
                  : `margin ${good.margin}: the shop loses money on every sale.`),
            }),
          ),
        };
      });

      const recipeInputs = result.recipes.map((recipe) => {
        const duration = field('Duration (ms)', recipe.durationMs, { min: '1', step: '100' });
        const profit = recipe.outputValue - recipe.inputCost;
        return {
          id: recipe.id,
          duration,
          block: block(
            el('div', { style: { 'font-weight': 'bold' }, text: `${recipe.displayName} (${recipe.id})` }),
            el('div', { class: 'faint', text: `${recipe.inputs} → ${recipe.outputs} on a ${recipe.stationType}` }),
            duration.row,
            el('div', {
              class: profit > 0 ? 'faint' : '',
              style: profit > 0 ? {} : { color: 'var(--color-warn, #d88)' },
              text:
                `Inputs cost ${recipe.inputCost}, outputs are worth ${recipe.outputValue}` +
                (profit > 0 ? ` - ${profit} per batch.` : ` - ${profit} per batch: not worth running.`),
            }),
            recipe.locked ? el('div', { class: 'faint', text: 'Gated by an authored unlock condition.' }) : null,
          ),
        };
      });

      const offlineMax = field('Offline cap (minutes)', result.offlineMaximumMinutes ?? 0, {
        min: '0',
        step: '5',
      });
      const offlineEff = field('Offline efficiency', result.offlineEfficiency, {
        min: '0',
        max: '1',
        step: '0.05',
      });

      const prestige = doc.prestige?.[0];
      const prestigeReward = prestige ? field('Prestige reward', prestige.rewardCurrency ?? 0, { min: '0', step: '5' }) : null;
      const prestigeStep = prestige
        ? field('Multiplier per level', prestige.multiplierPerLevel ?? 0, { min: '0', step: '0.5' })
        : null;

      saveBtn.addEventListener('click', async () => {
        const next: DocumentModel = {
          ...doc,
          goods: doc.goods.map((good) => {
            const inputs = goodInputs.find((entry) => entry.itemId === good.itemId);
            if (!inputs) return good;
            return {
              ...good,
              buyPrice: Number.parseFloat(inputs.buy.input.value),
              sellPrice: Number.parseFloat(inputs.sell.input.value),
              demandMultiplier: Number.parseFloat(inputs.demand.input.value),
              capacity: Number.parseInt(inputs.capacity.input.value, 10),
            };
          }),
          ...(doc.recipes
            ? {
                recipes: doc.recipes.map((recipe) => {
                  const inputs = recipeInputs.find((entry) => entry.id === recipe.id);
                  return inputs ? { ...recipe, durationMs: Number.parseFloat(inputs.duration.input.value) } : recipe;
                }),
              }
            : {}),
          ...(doc.offline
            ? {
                offline: {
                  maximumMs: Math.round(Number.parseFloat(offlineMax.input.value) * 60_000),
                  efficiency: Number.parseFloat(offlineEff.input.value),
                },
              }
            : {}),
          ...(doc.prestige && prestigeReward && prestigeStep
            ? {
                prestige: doc.prestige.map((entry, index) =>
                  index === 0
                    ? {
                        ...entry,
                        rewardCurrency: Math.round(Number.parseFloat(prestigeReward.input.value)),
                        multiplierPerLevel: Number.parseFloat(prestigeStep.input.value),
                      }
                    : entry,
                ),
              }
            : {}),
        };

        saveBtn.disabled = true;
        status.textContent = 'Saving...';
        try {
          await api.post('/ledger/update', { gameId, document: next });
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
          text:
            `${result.goods.length} good(s), ${result.recipes.length} recipe(s), ${result.stationCount} station(s), ` +
            `${result.zoneCount} zone(s), ${result.queueCount} queue(s), ${result.customerCount} customer type(s). ` +
            'Each good points at an item id - there is one item definition system, and it is content/items.json.',
        }),
        el('div', { style: { 'font-weight': 'bold' }, text: 'Goods' }),
        ...goodInputs.map((entry) => entry.block),
        result.recipes.length > 0
          ? el('div', { style: { 'font-weight': 'bold' }, text: 'Production' })
          : null,
        ...recipeInputs.map((entry) => entry.block),
        doc.offline
          ? block(
              el('div', { style: { 'font-weight': 'bold' }, text: 'Offline catch-up' }),
              offlineMax.row,
              offlineEff.row,
              el('div', {
                class: 'faint',
                text: 'A longer absence credits nothing extra - the cap is the honest ceiling.',
              }),
            )
          : el('div', { class: 'faint', text: 'No offline policy authored: an absence credits nothing.' }),
        prestigeReward && prestigeStep
          ? block(
              el('div', { style: { 'font-weight': 'bold' }, text: `Prestige (${prestige!.id})` }),
              prestigeReward.row,
              prestigeStep.row,
            )
          : el('div', { class: 'faint', text: 'No prestige authored.' }),
        el('div', {
          class: 'faint',
          text: 'Recipe inputs and outputs, placement zones and customer archetypes are authored in content/economy.json - this panel tunes feel, not structure.',
        }),
        el('div', { style: { 'margin-top': '8px' } }, saveBtn, status),
      );
    } catch {
      if (disposed) return;
      replace(body, el('div', { class: 'faint', text: 'No content/economy.json in project.' }));
    }
  }

  void refresh();
  return () => {
    disposed = true;
  };
}
