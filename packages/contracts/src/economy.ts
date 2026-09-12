/**
 * Customer / demand / transaction / production economy
 * (Category-C capability program, Wave 1).
 *
 * Renderer-neutral, simulation-time. One reusable service covers the common
 * shop / restaurant / tycoon loop: stock, a demand queue, transaction
 * settlement, and production jobs. Theme-specific goods, recipes, prices and
 * presentation remain content.
 *
 * Three bounded modes (not three engines):
 *   - `shop`     — serve the front customer a held good; secondary restocks.
 *   - `kitchen`  — secondary starts a recipe; serve only when the requested
 *                  good is in stock (cook, then plate).
 *   - `factory`  — secondary starts a recipe; waiting customers auto-buy when
 *                  stock exists (`autoSell`).
 */

export const ECONOMY_CAPABILITY_ID = 'simulation.economy';

export type EconomyMode = 'shop' | 'kitchen' | 'factory';

export interface EconomyGood {
  readonly id: string;
  readonly displayName: string;
  /** What a customer pays when served this good. */
  readonly price: number;
  /** Shop-mode restock cost. Omit to make restock free. */
  readonly restockCost?: number;
  readonly stock: number;
}

export interface EconomyRecipeInput {
  readonly goodId: string;
  readonly count: number;
}

export interface EconomyRecipe {
  readonly id: string;
  readonly displayName: string;
  readonly outputGoodId: string;
  readonly outputCount: number;
  readonly durationMs: number;
  readonly input?: readonly EconomyRecipeInput[];
}

export interface EconomyDemand {
  /** Template id (stable across spawns). */
  readonly id: string;
  readonly displayName: string;
  readonly goodId: string;
  /** Override of the good's price. Omit to use the catalog price. */
  readonly pay?: number;
  readonly patienceMs: number;
}

export interface EconomySpawn {
  readonly firstDelayMs: number;
  readonly intervalMs: number;
  readonly maxQueue: number;
}

/** The validated `content/economy.json` document. */
export interface EconomyCatalog {
  readonly schemaVersion: number;
  readonly mode: EconomyMode;
  readonly cash: number;
  readonly goods: readonly EconomyGood[];
  readonly recipes?: readonly EconomyRecipe[];
  readonly demand: readonly EconomyDemand[];
  readonly spawn: EconomySpawn;
  /** Factory mode: serve automatically when the requested good is in stock. */
  readonly autoSell?: boolean;
}

export interface QueuedCustomer {
  readonly instanceId: string;
  readonly templateId: string;
  readonly displayName: string;
  readonly goodId: string;
  readonly pay: number;
  readonly remainingMs: number;
}

export interface EconomyProduction {
  readonly recipeId: string;
  readonly remainingMs: number;
  readonly totalMs: number;
}

export type EconomyServeReason = 'served' | 'no-customer' | 'no-stock' | 'wrong-good' | 'unknown-good';
export type EconomySecondaryReason =
  | 'restocked'
  | 'produced-started'
  | 'already-producing'
  | 'cannot-afford'
  | 'missing-input'
  | 'unknown-recipe'
  | 'unknown-good'
  | 'no-selection';

export interface EconomyServeResult {
  readonly ok: boolean;
  readonly reason: EconomyServeReason;
  readonly customerId?: string;
  readonly goodId?: string;
}

export interface EconomySecondaryResult {
  readonly ok: boolean;
  readonly reason: EconomySecondaryReason;
  readonly goodId?: string;
  readonly recipeId?: string;
}

export interface EconomyService {
  mode(): EconomyMode;
  cash(): number;
  stock(goodId: string): number;
  goods(): readonly EconomyGood[];
  recipes(): readonly EconomyRecipe[];
  queue(): readonly QueuedCustomer[];
  served(): number;
  lost(): number;
  produced(): number;
  /** Index into `goods()` (shop) or `recipes()` (kitchen/factory). */
  selectedIndex(): number;
  selectByDelta(delta: number): number;
  serve(): EconomyServeResult;
  secondary(): EconomySecondaryResult;
  producing(): EconomyProduction | null;
  lastResult(): string | null;
}

export class UnknownEconomyGoodError extends Error {
  constructor(id: string) {
    super(`No economy good defined with id "${id}" in content/economy.json.`);
    this.name = 'UnknownEconomyGoodError';
  }
}

export class UnknownEconomyRecipeError extends Error {
  constructor(id: string) {
    super(`No economy recipe defined with id "${id}" in content/economy.json.`);
    this.name = 'UnknownEconomyRecipeError';
  }
}
