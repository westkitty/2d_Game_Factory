/**
 * Economy, production & customer simulation (post-ten program Phase 19).
 *
 * The reusable basis for a shop, a factory, a restaurant floor and an idle
 * game: goods with stock and prices, transactions that either fully succeed or
 * fully fail, production recipes running on stations, customers who arrive with
 * a budget and a limited amount of patience, and a bounded offline catch-up.
 *
 * ## There is exactly one item definition system
 *
 * A good is **not** an item definition. `content/items.json` (the certified
 * Phase-2 item catalog, `items.state`) owns what a thing *is* - its display
 * name, category, stackability and effects. A good is what a *shop* knows about
 * that item: how many are on the shelf, what the shelf holds, and what it costs
 * on each side of the counter. `GoodDefinition.itemId` therefore points into the
 * item catalog and redefines none of it. Two competing item systems would mean
 * two places to rename a thing, and the second one would drift.
 *
 * ## There is exactly one wallet
 *
 * The shop's funds are `progression.state`'s currency, read and written through
 * `ProgressionService`. `sw2d.economy` never opens a second balance. A customer
 * carries their own `funds`, but a customer is not the player.
 *
 * ## One input policy: consume at start
 *
 * A production job removes its inputs from stock the moment it starts, and adds
 * its outputs once when it completes. It never consumes on both ends, and it
 * never re-checks inputs mid-flight. Cancelling a running job returns the
 * inputs it consumed, which is a refund, not a second consumption.
 *
 * Renderer-neutral and pure. Nothing here reads a clock or `Math.random`: the
 * live simulation advances on `deltaMs`, arrivals are drawn from the canonical
 * seeded RNG, and the one place a wall clock is legitimate - measuring how long
 * a player was away - takes it as an injected `WallClock`.
 */

import type { SeededRng } from './generation.ts';
// Placement geometry is shared with Phase 21's tower placement; it lives in
// geometry.ts so there is one implementation of "does this fit inside that".
import { DEFAULT_FOOTPRINT, footprintRect, pointInRect, rectContains, rectsOverlap } from './geometry.ts';
import type { Footprint, Point, Rect } from './geometry.ts';

export const ECONOMY_CAPABILITY_ID = 'simulation.economy';
export const PRODUCTION_CAPABILITY_ID = 'simulation.production';

// --- Goods ---------------------------------------------------------------

export interface GoodDefinition {
  /** Item id from `content/items.json`. This document never redefines the item. */
  readonly itemId: string;
  /** Units on the shelf when the shop opens. */
  readonly stock: number;
  /** Maximum units the shelf holds. A restock that would exceed it is refused whole. */
  readonly capacity: number;
  /** What the shop pays a supplier, per unit. */
  readonly buyPrice: number;
  /** What a customer pays the shop, per unit, before demand. */
  readonly sellPrice: number;
  /** Scales `sellPrice` only. Default 1. */
  readonly demandMultiplier?: number;
  /** Units a single restock adds by default. */
  readonly restockQuantity?: number;
}

export interface GoodState {
  readonly itemId: string;
  readonly stock: number;
  readonly capacity: number;
  readonly buyPrice: number;
  readonly sellPrice: number;
  readonly demandMultiplier: number;
  /** `sellPrice * demandMultiplier`, rounded to whole currency. */
  readonly unitSellPrice: number;
  /** `buyPrice`, rounded to whole currency. Demand does not move what a supplier charges. */
  readonly unitBuyPrice: number;
  readonly restockQuantity: number;
}

/**
 * Currency is whole units everywhere in the factory (`ProgressionService.currency()`
 * is an integer). A price that rounded to a fraction would make a balance
 * un-representable, so every price crosses into currency through here.
 */
export function priceInCurrency(base: number, multiplier = 1): number {
  if (!Number.isFinite(base) || !Number.isFinite(multiplier)) return 0;
  const raw = base * multiplier;
  if (raw <= 0) return 0;
  return Math.round(raw);
}

export function goodState(definition: GoodDefinition, stock: number): GoodState {
  const demandMultiplier = definition.demandMultiplier ?? 1;
  return {
    itemId: definition.itemId,
    stock,
    capacity: definition.capacity,
    buyPrice: definition.buyPrice,
    sellPrice: definition.sellPrice,
    demandMultiplier,
    unitSellPrice: priceInCurrency(definition.sellPrice, demandMultiplier),
    unitBuyPrice: priceInCurrency(definition.buyPrice),
    restockQuantity: definition.restockQuantity ?? 1,
  };
}

// --- Transactions --------------------------------------------------------

/**
 * `sell` moves goods from the shop to a buyer and money the other way.
 * `restock` moves goods from a supplier to the shop and money the other way.
 * There is no third direction, and neither one is a partial fill: a transaction
 * that cannot happen in full does not happen at all.
 */
export type TransactionSide = 'sell' | 'restock';

export type TransactionFailureReason =
  | 'unknown-good'
  | 'invalid-quantity'
  | 'insufficient-stock'
  | 'insufficient-capacity'
  | 'insufficient-funds';

export interface TransactionRequest {
  readonly itemId: string;
  readonly quantity: number;
  readonly side: TransactionSide;
  /**
   * The buyer's purse for a `sell`. Omit when the shop itself is the buyer
   * (`restock`), where the shop's own funds are used.
   */
  readonly buyerFunds?: number;
}

export interface TransactionResult {
  readonly ok: boolean;
  readonly reason?: TransactionFailureReason;
  readonly itemId: string;
  readonly quantity: number;
  readonly side: TransactionSide;
  readonly unitPrice: number;
  readonly total: number;
  readonly stockAfter: number;
  readonly shopFundsAfter: number;
  /** Present only for a `sell`, where a buyer's purse was supplied. */
  readonly buyerFundsAfter?: number;
}

/**
 * The whole validation rule for a transaction, as a pure function of the state
 * it needs. The service applies the result; it does not re-derive it, so there
 * is one place a transaction can be declared legal.
 */
export function evaluateTransaction(
  good: GoodState | undefined,
  request: TransactionRequest,
  shopFunds: number,
): { readonly reason?: TransactionFailureReason; readonly unitPrice: number; readonly total: number } {
  if (!good) return { reason: 'unknown-good', unitPrice: 0, total: 0 };
  if (!Number.isInteger(request.quantity) || request.quantity <= 0) {
    return { reason: 'invalid-quantity', unitPrice: 0, total: 0 };
  }
  const unitPrice = request.side === 'sell' ? good.unitSellPrice : good.unitBuyPrice;
  const total = unitPrice * request.quantity;

  if (request.side === 'sell') {
    if (good.stock < request.quantity) return { reason: 'insufficient-stock', unitPrice, total };
    const purse = request.buyerFunds ?? 0;
    if (purse < total) return { reason: 'insufficient-funds', unitPrice, total };
    return { unitPrice, total };
  }

  if (good.stock + request.quantity > good.capacity) {
    return { reason: 'insufficient-capacity', unitPrice, total };
  }
  if (shopFunds < total) return { reason: 'insufficient-funds', unitPrice, total };
  return { unitPrice, total };
}

// --- Production ----------------------------------------------------------

export interface ItemQuantity {
  readonly itemId: string;
  readonly quantity: number;
}

export type UnlockCondition =
  | { readonly kind: 'flag'; readonly flag: string }
  | { readonly kind: 'stock-at-least'; readonly itemId: string; readonly quantity: number }
  | { readonly kind: 'prestige-at-least'; readonly level: number };

export interface RecipeDefinition {
  readonly id: string;
  readonly displayName?: string;
  readonly inputs: readonly ItemQuantity[];
  readonly outputs: readonly ItemQuantity[];
  readonly durationMs: number;
  /** Matches `StationDefinition.type`. A recipe runs only on a station of its type. */
  readonly stationType: string;
  /** Units of each output produced per completed job. Default 1. */
  readonly batchSize?: number;
  readonly unlock?: readonly UnlockCondition[];
}

export interface StationDefinition {
  readonly id: string;
  readonly type: string;
  /** Concurrent jobs this station runs. */
  readonly capacity: number;
  /** Authored placement. A station with no position is unplaced until `place()`. */
  readonly position?: Point;
  readonly footprint?: Footprint;
  /**
   * Where an agent must be able to stand to use the station, relative to its
   * centre. Present only when the station genuinely needs to be reached.
   */
  readonly accessOffset?: Point;
}

export interface StationState {
  readonly id: string;
  readonly type: string;
  readonly capacity: number;
  readonly position: Point | null;
  readonly footprint: Footprint;
  /** Jobs currently running here. */
  readonly occupied: number;
  /** Job ids waiting for a slot, in join order. */
  readonly queue: readonly string[];
}

export type ProductionJobState = 'running' | 'complete' | 'cancelled';

export interface ProductionJob {
  readonly id: string;
  readonly recipeId: string;
  readonly stationId: string;
  readonly batchSize: number;
  readonly remainingMs: number;
  readonly totalMs: number;
  readonly state: ProductionJobState;
}

export type ProductionFailureReason =
  | 'unknown-recipe'
  | 'locked'
  | 'no-station'
  | 'station-full'
  | 'insufficient-inputs';

export interface ProductionStartResult {
  readonly ok: boolean;
  readonly reason?: ProductionFailureReason;
  readonly jobId?: string;
  readonly stationId?: string;
  /** Inputs actually removed from stock. Empty on failure - a refused job consumes nothing. */
  readonly consumed: readonly ItemQuantity[];
}

/** Enough of each input is on the shelf for one batch. */
export function hasInputs(recipe: RecipeDefinition, stockOf: (itemId: string) => number): boolean {
  const batch = recipe.batchSize ?? 1;
  return recipe.inputs.every((input) => stockOf(input.itemId) >= input.quantity * batch);
}

export function evaluateUnlock(
  conditions: readonly UnlockCondition[] | undefined,
  world: {
    readonly hasFlag: (flag: string) => boolean;
    readonly stockOf: (itemId: string) => number;
    readonly prestigeLevel: number;
  },
): boolean {
  if (!conditions || conditions.length === 0) return true;
  return conditions.every((condition) => {
    switch (condition.kind) {
      case 'flag':
        return world.hasFlag(condition.flag);
      case 'stock-at-least':
        return world.stockOf(condition.itemId) >= condition.quantity;
      case 'prestige-at-least':
        return world.prestigeLevel >= condition.level;
    }
  });
}

// --- Placement -----------------------------------------------------------

export type PlacementZoneKind = 'buildable' | 'aisle';

export interface PlacementZone {
  readonly id: string;
  readonly kind: PlacementZoneKind;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export type PlacementFailureReason =
  | 'unknown-station'
  | 'outside-zone'
  | 'overlaps-station'
  | 'inaccessible';

export interface PlacementResult {
  readonly ok: boolean;
  readonly reason?: PlacementFailureReason;
  readonly stationId: string;
  readonly position: Point;
}

/**
 * The whole placement rule, pure. A station must sit entirely inside a
 * `buildable` zone, must not overlap another placed station, and - when it
 * declares an access point - that point must fall in an `aisle`.
 *
 * This is a *reachability* check, not a path. Whether an agent can actually walk
 * there is `world.navigation`'s question, and this contract does not pretend to
 * answer it.
 */
export function evaluatePlacement(
  station: StationDefinition,
  position: Point,
  zones: readonly PlacementZone[],
  occupiedRects: readonly Rect[],
): PlacementFailureReason | undefined {
  const rect = footprintRect(position, station.footprint ?? DEFAULT_FOOTPRINT);
  const buildable = zones.filter((zone) => zone.kind === 'buildable');
  if (!buildable.some((zone) => rectContains(zone, rect))) return 'outside-zone';
  if (occupiedRects.some((other) => rectsOverlap(rect, other))) return 'overlaps-station';
  if (station.accessOffset) {
    const access = { x: position.x + station.accessOffset.x, y: position.y + station.accessOffset.y };
    const aisles = zones.filter((zone) => zone.kind === 'aisle');
    if (!aisles.some((zone) => pointInRect(access, zone))) return 'inaccessible';
  }
  return undefined;
}

// --- Customers -----------------------------------------------------------

export interface CustomerArchetype {
  readonly id: string;
  readonly displayName?: string;
  /** Whole currency the customer arrives carrying. */
  readonly budget: number;
  /** How long the customer will tolerate walking and waiting before leaving. */
  readonly patienceMs: number;
  /** `itemId -> weight`. Higher weight is chosen first among affordable, in-stock goods. */
  readonly demandWeights: Readonly<Record<string, number>>;
  /** Most units this customer will ever buy at once. Default 1. */
  readonly maxQuantity?: number;
  /** Relative likelihood of this archetype being the next arrival. */
  readonly arrivalWeight: number;
}

/**
 * The customer flow. Each phase is entered exactly once per visit and the order
 * never varies; what varies is how long a phase takes and whether patience runs
 * out first.
 */
export type CustomerPhase =
  | 'arrive'
  | 'choose-target'
  | 'navigate'
  | 'queue'
  | 'service'
  | 'transaction'
  | 'leave';

export const CUSTOMER_PHASE_ORDER: readonly CustomerPhase[] = [
  'arrive',
  'choose-target',
  'navigate',
  'queue',
  'service',
  'transaction',
  'leave',
];

export type CustomerOutcome = 'purchased' | 'impatient' | 'out-of-stock' | 'unaffordable' | 'queue-full';

export interface CustomerState {
  readonly id: string;
  readonly archetypeId: string;
  readonly phase: CustomerPhase;
  readonly funds: number;
  readonly patienceRemainingMs: number;
  readonly targetItemId: string | null;
  readonly quantity: number;
  readonly queueId: string | null;
  /** Monotonic per queue. Two customers never share one, so FIFO is total. */
  readonly joinOrder: number | null;
  readonly waitMs: number;
  readonly outcome: CustomerOutcome | null;
}

/**
 * Which good this customer wants: the highest demand weight among goods that
 * are in stock and that they can afford at least one of. Ties break on
 * ascending item id so the same shop and the same customer always agree.
 */
export function chooseTarget(
  archetype: CustomerArchetype,
  funds: number,
  goods: readonly GoodState[],
): { readonly itemId: string; readonly quantity: number } | { readonly reason: 'out-of-stock' | 'unaffordable' } {
  const wanted = goods
    .filter((good) => (archetype.demandWeights[good.itemId] ?? 0) > 0)
    .slice()
    .sort((a, b) => {
      const weightDelta = (archetype.demandWeights[b.itemId] ?? 0) - (archetype.demandWeights[a.itemId] ?? 0);
      return weightDelta !== 0 ? weightDelta : a.itemId.localeCompare(b.itemId);
    });
  if (wanted.length === 0) return { reason: 'out-of-stock' };

  const inStock = wanted.filter((good) => good.stock > 0);
  if (inStock.length === 0) return { reason: 'out-of-stock' };

  const affordable = inStock.filter((good) => good.unitSellPrice <= funds);
  if (affordable.length === 0) return { reason: 'unaffordable' };

  const target = affordable[0]!;
  const maxQuantity = Math.max(1, Math.trunc(archetype.maxQuantity ?? 1));
  const byPurse = target.unitSellPrice > 0 ? Math.floor(funds / target.unitSellPrice) : maxQuantity;
  const quantity = Math.max(1, Math.min(maxQuantity, target.stock, byPurse));
  return { itemId: target.itemId, quantity };
}

/**
 * Weighted archetype draw through the canonical seeded RNG's own
 * `weightedChoose` - never `Math.random`, and never a second weighted-pick
 * implementation that could drift from the certified one.
 */
export function pickArchetype(
  archetypes: readonly CustomerArchetype[],
  rng: SeededRng,
): CustomerArchetype | undefined {
  const eligible = archetypes.filter((archetype) => archetype.arrivalWeight > 0);
  if (eligible.length === 0) return undefined;
  return rng.weightedChoose(
    eligible.map((archetype) => ({ value: archetype, weight: archetype.arrivalWeight })),
  );
}

// --- Queues --------------------------------------------------------------

export interface QueueDefinition {
  readonly id: string;
  /** Customers who may wait. An arrival beyond it leaves with `queue-full`. */
  readonly capacity: number;
  /** Customers served concurrently. */
  readonly serviceSlots: number;
  /** How long one customer occupies a service slot. */
  readonly serviceMs: number;
  /** How long a customer spends walking to the queue before joining it. */
  readonly navigateMs?: number;
}

export interface QueueEntry {
  readonly customerId: string;
  readonly joinOrder: number;
  readonly waitMs: number;
}

export interface QueueState {
  readonly id: string;
  readonly capacity: number;
  readonly serviceSlots: number;
  readonly waiting: readonly QueueEntry[];
  readonly serving: readonly string[];
}

// --- Offline catch-up ----------------------------------------------------

/**
 * The one legitimate wall clock in the system, and it is injected so nothing in
 * a contract or a pack ever calls `Date.now()` directly. It is read **only** at
 * the load/resume boundary; the live simulation is `deltaMs` from first frame to
 * last.
 */
export interface WallClock {
  now(): number;
}

export const WALL_CLOCK_CAPABILITY_ID = 'time.wall-clock';

/**
 * Supplied rather than sampled: the only clock a deterministic test should see.
 * It lives here, beside the interface, so there is exactly one manual clock in
 * the system rather than one per package that needed to fake an absence.
 */
export class ManualWallClock implements WallClock {
  #nowMs: number;

  constructor(nowMs = 0) {
    this.#nowMs = nowMs;
  }

  now(): number {
    return this.#nowMs;
  }

  set(nowMs: number): void {
    this.#nowMs = nowMs;
  }

  advance(deltaMs: number): void {
    this.#nowMs += deltaMs;
  }
}

export interface OfflinePolicy {
  /** Hard cap on credited absence, however long the player was really away. */
  readonly maximumMs: number;
  /** Fraction of normal output credited while away. 0..1, default 1. */
  readonly efficiency?: number;
}

/**
 * Elapsed absence, clamped. A clock that moved backwards (a timezone change, a
 * corrected system clock, a hand-edited save) credits **nothing** rather than a
 * negative or a wrapped-around amount.
 */
export function offlineElapsedMs(nowMs: number, savedAtMs: number, maximumMs: number): number {
  if (!Number.isFinite(nowMs) || !Number.isFinite(savedAtMs) || !Number.isFinite(maximumMs)) return 0;
  const cap = maximumMs > 0 ? maximumMs : 0;
  const raw = nowMs - savedAtMs;
  if (!(raw > 0)) return 0;
  return raw > cap ? cap : raw;
}

export interface OfflineReport {
  /** Absence measured before clamping, so a UI can honestly say "capped at 8h". */
  readonly requestedMs: number;
  readonly appliedMs: number;
  readonly clamped: boolean;
  readonly jobsCompleted: number;
  readonly produced: readonly ItemQuantity[];
  /** Output that exceeded shelf capacity and was lost. Reported, never silent. */
  readonly wasted: readonly ItemQuantity[];
}

export const EMPTY_OFFLINE_REPORT: OfflineReport = {
  requestedMs: 0,
  appliedMs: 0,
  clamped: false,
  jobsCompleted: 0,
  produced: [],
  wasted: [],
};

// --- Prestige ------------------------------------------------------------

export type PrestigeResetScope =
  | 'goods-stock'
  | 'production-jobs'
  | 'station-placement'
  | 'currency'
  | 'unlocks';

export type PrestigeEligibility =
  | { readonly kind: 'lifetime-earnings-at-least'; readonly amount: number }
  | { readonly kind: 'stock-at-least'; readonly itemId: string; readonly quantity: number }
  | { readonly kind: 'flag'; readonly flag: string };

export interface PrestigeDefinition {
  readonly id: string;
  readonly displayName?: string;
  readonly eligibility: PrestigeEligibility;
  /** What a prestige wipes. */
  readonly resetScopes: readonly PrestigeResetScope[];
  /** Kept even when also listed in `resetScopes`; retain wins, and validation says so. */
  readonly retainScopes?: readonly PrestigeResetScope[];
  /** Currency granted on prestige. Survives the reset even when `currency` is wiped. */
  readonly rewardCurrency?: number;
  /** Added to the permanent multiplier per prestige level. Default 0. */
  readonly multiplierPerLevel?: number;
  readonly unlockFlag?: string;
}

export interface PrestigeState {
  readonly level: number;
  /** `1 + level * multiplierPerLevel`. Scales production speed. */
  readonly multiplier: number;
  /** Every unit of currency the shop has ever earned. Never reset by prestige. */
  readonly lifetimeEarnings: number;
  readonly eligible: boolean;
  readonly blockedBy: string | null;
}

export interface PrestigeResult {
  readonly ok: boolean;
  readonly reason?: 'unknown-definition' | 'not-eligible';
  readonly level: number;
  readonly multiplier: number;
  readonly grantedCurrency: number;
  readonly resetScopes: readonly PrestigeResetScope[];
}

export function prestigeMultiplier(level: number, perLevel: number | undefined): number {
  const step = perLevel ?? 0;
  return 1 + Math.max(0, level) * step;
}

export function isPrestigeEligible(
  eligibility: PrestigeEligibility,
  world: {
    readonly lifetimeEarnings: number;
    readonly stockOf: (itemId: string) => number;
    readonly hasFlag: (flag: string) => boolean;
  },
): boolean {
  switch (eligibility.kind) {
    case 'lifetime-earnings-at-least':
      return world.lifetimeEarnings >= eligibility.amount;
    case 'stock-at-least':
      return world.stockOf(eligibility.itemId) >= eligibility.quantity;
    case 'flag':
      return world.hasFlag(eligibility.flag);
  }
}

// --- Document ------------------------------------------------------------

export interface ArrivalPolicy {
  /** Simulated milliseconds between arrivals. */
  readonly intervalMs: number;
  /** Customers present at once. An arrival beyond it is skipped, not queued. */
  readonly maxConcurrent: number;
  /** Whether the shop generates arrivals at all. Default true. */
  readonly enabled?: boolean;
}

/** The validated `content/economy.json` document. */
export interface EconomyDocument {
  readonly schemaVersion: number;
  readonly goods: readonly GoodDefinition[];
  readonly recipes?: readonly RecipeDefinition[];
  readonly stations?: readonly StationDefinition[];
  readonly zones?: readonly PlacementZone[];
  readonly queues?: readonly QueueDefinition[];
  readonly customers?: readonly CustomerArchetype[];
  readonly arrival?: ArrivalPolicy;
  readonly offline?: OfflinePolicy;
  readonly prestige?: readonly PrestigeDefinition[];
}

export class InvalidEconomyDocumentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidEconomyDocumentError';
  }
}

/**
 * The semantic gate the JSON schema cannot express: cross-references between
 * sections, orderings, and the rules that only make sense once every section is
 * present together.
 */
export function validateEconomyDocument(document: EconomyDocument): void {
  const fail = (message: string): never => {
    throw new InvalidEconomyDocumentError(message);
  };

  const goodIds = new Set<string>();
  for (const good of document.goods) {
    if (goodIds.has(good.itemId)) fail(`Good "${good.itemId}" is defined more than once.`);
    goodIds.add(good.itemId);
    if (good.capacity <= 0) fail(`Good "${good.itemId}" has capacity ${good.capacity}; it must be positive.`);
    if (good.stock > good.capacity) {
      fail(`Good "${good.itemId}" starts with ${good.stock} units but its capacity is ${good.capacity}.`);
    }
    if (good.stock < 0) fail(`Good "${good.itemId}" cannot start with negative stock.`);
    if ((good.restockQuantity ?? 1) <= 0) fail(`Good "${good.itemId}" has a non-positive restockQuantity.`);
  }

  const stationTypes = new Set((document.stations ?? []).map((station) => station.type));
  const stationIds = new Set<string>();
  for (const station of document.stations ?? []) {
    if (stationIds.has(station.id)) fail(`Station "${station.id}" is defined more than once.`);
    stationIds.add(station.id);
    if (station.capacity <= 0) fail(`Station "${station.id}" has capacity ${station.capacity}; it must be positive.`);
  }

  const recipeIds = new Set<string>();
  for (const recipe of document.recipes ?? []) {
    if (recipeIds.has(recipe.id)) fail(`Recipe "${recipe.id}" is defined more than once.`);
    recipeIds.add(recipe.id);
    if (recipe.outputs.length === 0) fail(`Recipe "${recipe.id}" produces nothing.`);
    if (recipe.durationMs <= 0) fail(`Recipe "${recipe.id}" has a non-positive durationMs.`);
    if (!stationTypes.has(recipe.stationType)) {
      fail(`Recipe "${recipe.id}" needs a "${recipe.stationType}" station, but no station of that type is defined.`);
    }
    for (const entry of [...recipe.inputs, ...recipe.outputs]) {
      if (!goodIds.has(entry.itemId)) {
        fail(`Recipe "${recipe.id}" references item "${entry.itemId}", which is not a defined good.`);
      }
      if (entry.quantity <= 0) fail(`Recipe "${recipe.id}" has a non-positive quantity for "${entry.itemId}".`);
    }
    for (const condition of recipe.unlock ?? []) {
      if (condition.kind === 'stock-at-least' && !goodIds.has(condition.itemId)) {
        fail(`Recipe "${recipe.id}" unlocks on item "${condition.itemId}", which is not a defined good.`);
      }
    }
  }

  const zoneIds = new Set<string>();
  for (const zone of document.zones ?? []) {
    if (zoneIds.has(zone.id)) fail(`Placement zone "${zone.id}" is defined more than once.`);
    zoneIds.add(zone.id);
    if (zone.width <= 0 || zone.height <= 0) fail(`Placement zone "${zone.id}" has no area.`);
  }

  const queueIds = new Set<string>();
  for (const queue of document.queues ?? []) {
    if (queueIds.has(queue.id)) fail(`Queue "${queue.id}" is defined more than once.`);
    queueIds.add(queue.id);
    if (queue.capacity <= 0) fail(`Queue "${queue.id}" has a non-positive capacity.`);
    if (queue.serviceSlots <= 0) fail(`Queue "${queue.id}" has a non-positive serviceSlots.`);
    if (queue.serviceMs <= 0) fail(`Queue "${queue.id}" has a non-positive serviceMs.`);
  }

  const archetypeIds = new Set<string>();
  for (const archetype of document.customers ?? []) {
    if (archetypeIds.has(archetype.id)) fail(`Customer archetype "${archetype.id}" is defined more than once.`);
    archetypeIds.add(archetype.id);
    if (archetype.patienceMs <= 0) fail(`Customer archetype "${archetype.id}" has a non-positive patienceMs.`);
    const weightIds = Object.keys(archetype.demandWeights);
    if (weightIds.length === 0) fail(`Customer archetype "${archetype.id}" wants nothing.`);
    for (const itemId of weightIds) {
      if (!goodIds.has(itemId)) {
        fail(`Customer archetype "${archetype.id}" wants "${itemId}", which is not a defined good.`);
      }
    }
  }
  if ((document.customers ?? []).length > 0 && (document.queues ?? []).length === 0) {
    fail('Customer archetypes are defined but no queue is: a customer would have nowhere to wait.');
  }

  if (document.arrival) {
    if (document.arrival.intervalMs <= 0) fail('arrival.intervalMs must be positive.');
    if (document.arrival.maxConcurrent <= 0) fail('arrival.maxConcurrent must be positive.');
  }

  if (document.offline) {
    if (document.offline.maximumMs < 0) fail('offline.maximumMs cannot be negative.');
    const efficiency = document.offline.efficiency ?? 1;
    if (efficiency < 0 || efficiency > 1) fail(`offline.efficiency must be between 0 and 1, got ${efficiency}.`);
  }

  const prestigeIds = new Set<string>();
  for (const definition of document.prestige ?? []) {
    if (prestigeIds.has(definition.id)) fail(`Prestige "${definition.id}" is defined more than once.`);
    prestigeIds.add(definition.id);
    if (definition.resetScopes.length === 0) fail(`Prestige "${definition.id}" resets nothing.`);
    const retained = new Set(definition.retainScopes ?? []);
    const everything = definition.resetScopes.every((scope) => retained.has(scope));
    if (everything) fail(`Prestige "${definition.id}" retains every scope it resets, so it would do nothing.`);
    if (definition.eligibility.kind === 'stock-at-least' && !goodIds.has(definition.eligibility.itemId)) {
      fail(`Prestige "${definition.id}" is gated on item "${definition.eligibility.itemId}", which is not a defined good.`);
    }
  }
}

// --- Events --------------------------------------------------------------

export type EconomyEvent =
  | { readonly kind: 'transaction'; readonly result: TransactionResult }
  | { readonly kind: 'customer-phase'; readonly customerId: string; readonly phase: CustomerPhase }
  | { readonly kind: 'customer-left'; readonly customerId: string; readonly outcome: CustomerOutcome }
  | { readonly kind: 'prestige'; readonly level: number; readonly multiplier: number };

export type ProductionEvent =
  | { readonly kind: 'job-started'; readonly jobId: string; readonly recipeId: string; readonly stationId: string }
  | {
      readonly kind: 'job-completed';
      readonly jobId: string;
      readonly recipeId: string;
      readonly produced: readonly ItemQuantity[];
      readonly wasted: readonly ItemQuantity[];
    }
  | { readonly kind: 'job-cancelled'; readonly jobId: string; readonly refunded: readonly ItemQuantity[] }
  | { readonly kind: 'station-placed'; readonly stationId: string; readonly position: Point };

// --- Services ------------------------------------------------------------

/**
 * Frame advancement is **absent** from both service interfaces, following the
 * Phase-16 rule. The pack owns `update(deltaMs)`; a consumer observes what
 * happened through `drainEvents()` and never steps the simulation itself.
 * Phase 16 found this exact defect the hard way, where a shell and a pack both
 * advanced one ball and it moved twice per frame.
 */
export interface EconomyService {
  goods(): readonly GoodState[];
  good(itemId: string): GoodState | undefined;
  stock(itemId: string): number;
  /** The shop's balance: `progression.state`'s currency, not a second wallet. */
  funds(): number;
  transact(request: TransactionRequest): TransactionResult;
  /** Restock at the good's authored `restockQuantity`. */
  restock(itemId: string, quantity?: number): TransactionResult;
  setDemandMultiplier(itemId: string, multiplier: number): void;

  queues(): readonly QueueState[];
  customers(): readonly CustomerState[];
  customer(customerId: string): CustomerState | undefined;
  /** Introduce a customer now, bypassing the arrival timer. Null when none can be admitted. */
  spawnCustomer(archetypeId?: string, options?: { readonly id?: string }): CustomerState | null;

  prestigeState(): PrestigeState;
  performPrestige(definitionId?: string): PrestigeResult;

  /** Write the economy save record, stamping the injected wall clock. */
  save(): void;
  /**
   * The load/resume boundary: measure the clamped absence and aggregate what it
   * produced. Never replays frames.
   */
  resume(): OfflineReport;
  reset(): void;
  drainEvents(): readonly EconomyEvent[];
}

export interface ProductionService {
  recipes(): readonly RecipeDefinition[];
  isUnlocked(recipeId: string): boolean;
  stations(): readonly StationState[];
  jobs(): readonly ProductionJob[];
  start(recipeId: string, stationId?: string): ProductionStartResult;
  cancel(jobId: string): boolean;
  canPlace(stationId: string, x: number, y: number): PlacementResult;
  place(stationId: string, x: number, y: number): PlacementResult;
  /** Aggregate `elapsedMs` of absence into completed batches. Never replays frames. */
  catchUp(elapsedMs: number): OfflineReport;
  reset(): void;
  drainEvents(): readonly ProductionEvent[];
}
