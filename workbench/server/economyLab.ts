/**
 * Economy authoring surface (post-ten program Phase 19).
 *
 * Reads and updates `content/economy.json`. The editable fields are the ones a
 * creator re-tunes constantly and cannot judge from JSON: prices and demand,
 * shelf capacity, recipe durations, the offline cap and efficiency, and the
 * prestige reward and multiplier.
 *
 * **Recipes' inputs and outputs, the zones, and the customer archetypes are
 * reported, not edited.** Changing what a recipe *is* changes what the game can
 * make; changing what it *costs* changes how the game feels, and only the second
 * is tuning. Drawing zones needs a canvas, not a form, and this panel declines
 * to be a bad one.
 *
 * The panel computes what the JSON hides: the margin on each good, and how long
 * the authored offline cap actually is in minutes.
 *
 * Validates against urn:sw2d:schema:content-economy:v1 and then against the
 * contract's semantic gate, and writes atomically with path containment checks.
 */

import { existsSync, readFileSync } from 'node:fs';
import type { EconomyDocument } from '@sw2d/contracts';
import { goodState, validateEconomyDocument } from '@sw2d/contracts';
import { validateContentBundleData, validateDocumentOrThrow } from '@sw2d/schemas';
import { gameRoot, resolveContained } from './paths.ts';
import { writeJsonAtomic } from './atomicJson.ts';
import { SecurityError } from './security.ts';

export interface GoodSummary {
  readonly itemId: string;
  readonly stock: number;
  readonly capacity: number;
  readonly buyPrice: number;
  readonly sellPrice: number;
  readonly demandMultiplier: number;
  /** What a customer actually pays, after demand and rounding to whole currency. */
  readonly unitSellPrice: number;
  /** `unitSellPrice - buyPrice`. Negative means the shop loses money on every sale. */
  readonly margin: number;
}

export interface RecipeSummary {
  readonly id: string;
  readonly displayName: string;
  readonly stationType: string;
  readonly durationMs: number;
  readonly batchSize: number;
  readonly inputs: string;
  readonly outputs: string;
  /** Input cost at buy price vs output value at sell price, per batch. */
  readonly inputCost: number;
  readonly outputValue: number;
  readonly locked: boolean;
}

export interface EconomyInspectResult {
  readonly document: EconomyDocument;
  readonly goods: readonly GoodSummary[];
  readonly recipes: readonly RecipeSummary[];
  readonly stationCount: number;
  readonly zoneCount: number;
  readonly queueCount: number;
  readonly customerCount: number;
  readonly offlineMaximumMinutes: number | null;
  readonly offlineEfficiency: number;
  readonly prestigeCount: number;
}

export interface EconomyUpdateResult {
  readonly ok: boolean;
  readonly document: EconomyDocument;
}

function loadDocument(gameId: string): EconomyDocument {
  const full = resolveContained(gameRoot(gameId), 'content', 'economy.json');
  if (!existsSync(full)) {
    throw new SecurityError(404, `No content/economy.json in "${gameId}".`);
  }
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(full, 'utf8'));
  } catch {
    throw new SecurityError(400, `content/economy.json in "${gameId}" is not valid JSON.`);
  }
  const validated = validateContentBundleData({ economy: raw }).economy!.value as EconomyDocument;
  validateEconomyDocument(validated);
  return validated;
}

function describe(entries: readonly { readonly itemId: string; readonly quantity: number }[]): string {
  return entries.length === 0 ? '(nothing)' : entries.map((e) => `${e.quantity}x ${e.itemId}`).join(' + ');
}

export function inspectEconomy(gameId: string): EconomyInspectResult {
  const document = loadDocument(gameId);
  const priceOf = new Map(document.goods.map((good) => [good.itemId, good]));

  return {
    document,
    stationCount: document.stations?.length ?? 0,
    zoneCount: document.zones?.length ?? 0,
    queueCount: document.queues?.length ?? 0,
    customerCount: document.customers?.length ?? 0,
    prestigeCount: document.prestige?.length ?? 0,
    offlineMaximumMinutes: document.offline
      ? Math.round((document.offline.maximumMs / 60_000) * 100) / 100
      : null,
    offlineEfficiency: document.offline?.efficiency ?? 1,
    goods: document.goods.map((good) => {
      const state = goodState(good, good.stock);
      return {
        itemId: good.itemId,
        stock: good.stock,
        capacity: good.capacity,
        buyPrice: good.buyPrice,
        sellPrice: good.sellPrice,
        demandMultiplier: state.demandMultiplier,
        unitSellPrice: state.unitSellPrice,
        margin: state.unitSellPrice - state.unitBuyPrice,
      };
    }),
    recipes: (document.recipes ?? []).map((recipe) => {
      const batch = recipe.batchSize ?? 1;
      const inputCost = recipe.inputs.reduce(
        (sum, entry) => sum + (priceOf.get(entry.itemId)?.buyPrice ?? 0) * entry.quantity * batch,
        0,
      );
      const outputValue = recipe.outputs.reduce(
        (sum, entry) => sum + (priceOf.get(entry.itemId)?.sellPrice ?? 0) * entry.quantity * batch,
        0,
      );
      return {
        id: recipe.id,
        displayName: recipe.displayName ?? recipe.id,
        stationType: recipe.stationType,
        durationMs: recipe.durationMs,
        batchSize: batch,
        inputs: describe(recipe.inputs),
        outputs: describe(recipe.outputs),
        inputCost: Math.round(inputCost * 100) / 100,
        outputValue: Math.round(outputValue * 100) / 100,
        locked: (recipe.unlock?.length ?? 0) > 0,
      };
    }),
  };
}

export function updateEconomy(gameId: string, payload: unknown): EconomyUpdateResult {
  if (typeof payload !== 'object' || payload === null) {
    throw new SecurityError(400, 'Economy update payload must be an EconomyDocument object.');
  }
  const validated = validateDocumentOrThrow('economy', 'content/economy.json', payload) as EconomyDocument;
  // The schema cannot see a dangling item reference, a recipe needing a station
  // type nothing provides, or a prestige that retains everything it resets.
  try {
    validateEconomyDocument(validated);
  } catch (error) {
    throw new SecurityError(400, error instanceof Error ? error.message : String(error));
  }
  const target = resolveContained(gameRoot(gameId), 'content', 'economy.json');
  writeJsonAtomic(target, validated);
  return { ok: true, document: validated };
}
