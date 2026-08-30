import type {
  ArrivalPolicy,
  CustomerArchetype,
  CustomerOutcome,
  CustomerPhase,
  CustomerState,
  EconomyDocument,
  EconomyEvent,
  EconomyService,
  EventBus,
  GameContext,
  GoodDefinition,
  GoodState,
  InstalledSystemPack,
  ItemQuantity,
  OfflinePolicy,
  OfflineReport,
  PlacementResult,
  PlacementZone,
  Point,
  PrestigeDefinition,
  PrestigeResult,
  PrestigeState,
  ProductionEvent,
  ProductionJob,
  ProductionService,
  ProductionStartResult,
  QueueDefinition,
  QueueState,
  Rect,
  RecipeDefinition,
  SaveStore,
  SeededRng,
  StationDefinition,
  StationState,
  SystemPackDefinition,
  TransactionRequest,
  TransactionResult,
  VersionedRecord,
  WallClock,
} from '@sw2d/contracts';
import {
  DEFAULT_FOOTPRINT,
  EMPTY_OFFLINE_REPORT,
  chooseTarget,
  createRng,
  evaluatePlacement,
  evaluateTransaction,
  evaluateUnlock,
  footprintRect,
  goodState,
  hasInputs,
  isPrestigeEligible,
  ManualWallClock,
  offlineElapsedMs,
  pickArchetype,
  prestigeMultiplier,
  validateEconomyDocument,
} from '@sw2d/contracts';
import { registerSchema } from '@sw2d/schemas';
import { CAPABILITY_IDS, PACK_IDS } from '../ids.ts';
import type { ProgressionService } from '../progression/progressionPack.ts';
import economyConfigSchema from '../../schemas/economy-config.schema.json' with { type: 'json' };

export const ECONOMY_CONFIG_SCHEMA_ID = economyConfigSchema.$id;
registerSchema(economyConfigSchema);

/**
 * Economy, production & customer simulation (post-ten program Phase 19).
 *
 * Provides `simulation.economy` and `simulation.production` from one pack,
 * because a shop's shelf is the same shelf a production job draws from and
 * splitting them would mean two stock ledgers.
 *
 * Frame advancement is owned here and appears on **neither** service interface,
 * following the rule Phase 16 established after a shell and a pack both stepped
 * one ball. Consumers observe through `drainEvents()`.
 */

const ECONOMY_SAVE_SLOT = 'economy';
const ECONOMY_SAVE_VERSION = 1;
/** The one place where "how many whole batches fit in this absence" is bounded. */
const MAX_OFFLINE_BATCHES = 100_000;

export interface EconomyConfig {
  /** Content document name. Default `economy`. */
  readonly documentName?: string;
  /** Seed for the arrival draw. Default 1. */
  readonly arrivalSeed?: number;
}

export class MissingEconomyDocumentError extends Error {
  constructor(documentName: string) {
    super(
      `sw2d.economy requires an "${documentName}" content document. Author content/economy.json ` +
        '(urn:sw2d:schema:content-economy:v1).',
    );
    this.name = 'MissingEconomyDocumentError';
  }
}

export class MissingProgressionError extends Error {
  constructor() {
    super(
      'sw2d.economy requires progression.state: the shop\'s funds are the game\'s currency, and ' +
        'the economy deliberately does not open a second wallet.',
    );
    this.name = 'MissingProgressionError';
  }
}

interface EconomySaveRecord extends VersionedRecord {
  /** Wall-clock stamp from the injected clock. The only wall time in the record. */
  readonly savedAtMs: number;
  readonly stock: Readonly<Record<string, number>>;
  readonly prestigeLevel: number;
  readonly lifetimeEarnings: number;
  readonly jobs: readonly {
    readonly id: string;
    readonly recipeId: string;
    readonly stationId: string;
    readonly batchSize: number;
    readonly remainingMs: number;
    readonly totalMs: number;
  }[];
}

interface MutableCustomer {
  readonly id: string;
  readonly archetypeId: string;
  phase: CustomerPhase;
  funds: number;
  patienceRemainingMs: number;
  targetItemId: string | null;
  quantity: number;
  queueId: string | null;
  joinOrder: number | null;
  waitMs: number;
  outcome: CustomerOutcome | null;
  /** Time remaining in the current timed phase (`navigate`, `service`). */
  phaseRemainingMs: number;
}

interface MutableJob {
  readonly id: string;
  readonly recipeId: string;
  readonly stationId: string;
  readonly batchSize: number;
  remainingMs: number;
  readonly totalMs: number;
  /** Inputs actually taken at start, so a cancel refunds exactly what it consumed. */
  readonly consumed: readonly ItemQuantity[];
}

/** Merge repeated item ids so a report never lists `wood` twice. */
function mergeQuantities(entries: readonly ItemQuantity[]): readonly ItemQuantity[] {
  const totals = new Map<string, number>();
  for (const entry of entries) totals.set(entry.itemId, (totals.get(entry.itemId) ?? 0) + entry.quantity);
  return [...totals.entries()]
    .filter(([, quantity]) => quantity > 0)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([itemId, quantity]) => ({ itemId, quantity }));
}

class EconomyCore {
  readonly #document: EconomyDocument;
  readonly #goods = new Map<string, GoodDefinition>();
  readonly #stock = new Map<string, number>();
  readonly #demand = new Map<string, number>();

  readonly #recipes = new Map<string, RecipeDefinition>();
  readonly #stations = new Map<string, StationDefinition>();
  readonly #positions = new Map<string, Point | null>();
  readonly #jobs = new Map<string, MutableJob>();
  #jobSeq = 0;

  readonly #queues = new Map<string, QueueDefinition>();
  readonly #waiting = new Map<string, string[]>();
  readonly #serving = new Map<string, Set<string>>();
  readonly #joinSeq = new Map<string, number>();

  readonly #archetypes = new Map<string, CustomerArchetype>();
  readonly #customers = new Map<string, MutableCustomer>();
  #customerSeq = 0;
  #sinceArrivalMs = 0;

  #prestigeLevel = 0;
  #lifetimeEarnings = 0;

  readonly #economyEvents: EconomyEvent[] = [];
  readonly #productionEvents: ProductionEvent[] = [];

  readonly #progression: ProgressionService;
  readonly #events: EventBus | undefined;
  readonly #saves: SaveStore | undefined;
  readonly #clock: WallClock;
  readonly #rng: SeededRng;

  constructor(
    document: EconomyDocument,
    progression: ProgressionService,
    clock: WallClock,
    options: { readonly events?: EventBus; readonly saves?: SaveStore; readonly arrivalSeed?: number },
  ) {
    this.#document = document;
    this.#progression = progression;
    this.#clock = clock;
    this.#events = options.events;
    this.#saves = options.saves;
    this.#rng = createRng(options.arrivalSeed ?? 1);

    for (const good of document.goods) {
      this.#goods.set(good.itemId, good);
      this.#stock.set(good.itemId, good.stock);
      this.#demand.set(good.itemId, good.demandMultiplier ?? 1);
    }
    for (const recipe of document.recipes ?? []) this.#recipes.set(recipe.id, recipe);
    for (const station of document.stations ?? []) {
      this.#stations.set(station.id, station);
      this.#positions.set(station.id, station.position ?? null);
    }
    for (const queue of document.queues ?? []) {
      this.#queues.set(queue.id, queue);
      this.#waiting.set(queue.id, []);
      this.#serving.set(queue.id, new Set());
      this.#joinSeq.set(queue.id, 0);
    }
    for (const archetype of document.customers ?? []) this.#archetypes.set(archetype.id, archetype);
  }

  // --- Goods ------------------------------------------------------------

  goodStates(): readonly GoodState[] {
    return [...this.#goods.values()]
      .map((definition) =>
        goodState(
          { ...definition, demandMultiplier: this.#demand.get(definition.itemId) ?? 1 },
          this.#stock.get(definition.itemId) ?? 0,
        ),
      )
      .sort((a, b) => a.itemId.localeCompare(b.itemId));
  }

  goodStateOf(itemId: string): GoodState | undefined {
    const definition = this.#goods.get(itemId);
    if (!definition) return undefined;
    return goodState(
      { ...definition, demandMultiplier: this.#demand.get(itemId) ?? 1 },
      this.#stock.get(itemId) ?? 0,
    );
  }

  stockOf = (itemId: string): number => this.#stock.get(itemId) ?? 0;

  setDemandMultiplier(itemId: string, multiplier: number): void {
    if (!this.#goods.has(itemId)) return;
    if (!Number.isFinite(multiplier) || multiplier < 0) return;
    this.#demand.set(itemId, multiplier);
  }

  /** Adds stock clamped to capacity; returns what did not fit. */
  #addStock(itemId: string, quantity: number): number {
    const definition = this.#goods.get(itemId);
    if (!definition) return quantity;
    const current = this.#stock.get(itemId) ?? 0;
    const next = Math.min(definition.capacity, current + quantity);
    this.#stock.set(itemId, next);
    return quantity - (next - current);
  }

  // --- Transactions -----------------------------------------------------

  funds(): number {
    return this.#progression.currency();
  }

  transact(request: TransactionRequest): TransactionResult {
    const good = this.goodStateOf(request.itemId);
    const shopFunds = this.funds();
    const evaluation = evaluateTransaction(good, request, shopFunds);

    const base = {
      itemId: request.itemId,
      quantity: request.quantity,
      side: request.side,
      unitPrice: evaluation.unitPrice,
      total: evaluation.total,
    } as const;

    if (evaluation.reason) {
      // A refused transaction moves nothing and emits nothing. The caller still
      // gets a named reason; the world does not get a half-applied trade.
      return {
        ...base,
        ok: false,
        reason: evaluation.reason,
        stockAfter: good?.stock ?? 0,
        shopFundsAfter: shopFunds,
        ...(request.side === 'sell' ? { buyerFundsAfter: request.buyerFunds ?? 0 } : {}),
      };
    }

    if (request.side === 'sell') {
      this.#stock.set(request.itemId, (this.#stock.get(request.itemId) ?? 0) - request.quantity);
      this.#progression.addCurrency(evaluation.total);
      this.#lifetimeEarnings += evaluation.total;
    } else {
      this.#addStock(request.itemId, request.quantity);
      this.#progression.addCurrency(-evaluation.total);
    }

    const result: TransactionResult = {
      ...base,
      ok: true,
      stockAfter: this.#stock.get(request.itemId) ?? 0,
      shopFundsAfter: this.funds(),
      ...(request.side === 'sell' ? { buyerFundsAfter: (request.buyerFunds ?? 0) - evaluation.total } : {}),
    };
    this.#emitEconomy({ kind: 'transaction', result });
    return result;
  }

  restock(itemId: string, quantity?: number): TransactionResult {
    const good = this.goodStateOf(itemId);
    const units = quantity ?? good?.restockQuantity ?? 1;
    return this.transact({ itemId, quantity: units, side: 'restock' });
  }

  // --- Production -------------------------------------------------------

  recipeList(): readonly RecipeDefinition[] {
    return [...this.#recipes.values()].sort((a, b) => a.id.localeCompare(b.id));
  }

  isUnlocked(recipeId: string): boolean {
    const recipe = this.#recipes.get(recipeId);
    if (!recipe) return false;
    return evaluateUnlock(recipe.unlock, {
      hasFlag: (flag) => this.#progression.isUnlocked(flag),
      stockOf: this.stockOf,
      prestigeLevel: this.#prestigeLevel,
    });
  }

  stationStates(): readonly StationState[] {
    return [...this.#stations.values()]
      .map((station) => ({
        id: station.id,
        type: station.type,
        capacity: station.capacity,
        position: this.#positions.get(station.id) ?? null,
        footprint: station.footprint ?? DEFAULT_FOOTPRINT,
        occupied: this.#jobsAt(station.id).length,
        queue: this.#jobsAt(station.id)
          .slice(station.capacity)
          .map((job) => job.id),
      }))
      .sort((a, b) => a.id.localeCompare(b.id));
  }

  #jobsAt(stationId: string): readonly MutableJob[] {
    return [...this.#jobs.values()]
      .filter((job) => job.stationId === stationId)
      .sort((a, b) => a.id.localeCompare(b.id));
  }

  jobList(): readonly ProductionJob[] {
    return [...this.#jobs.values()]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((job) => ({
        id: job.id,
        recipeId: job.recipeId,
        stationId: job.stationId,
        batchSize: job.batchSize,
        remainingMs: job.remainingMs,
        totalMs: job.totalMs,
        state: 'running' as const,
      }));
  }

  start(recipeId: string, stationId?: string): ProductionStartResult {
    const recipe = this.#recipes.get(recipeId);
    if (!recipe) return { ok: false, reason: 'unknown-recipe', consumed: [] };
    if (!this.isUnlocked(recipeId)) return { ok: false, reason: 'locked', consumed: [] };

    const candidates = stationId
      ? [this.#stations.get(stationId)].filter((station): station is StationDefinition => station !== undefined)
      : [...this.#stations.values()].sort((a, b) => a.id.localeCompare(b.id));
    const typed = candidates.filter((station) => station.type === recipe.stationType);
    if (typed.length === 0) return { ok: false, reason: 'no-station', consumed: [] };

    const free = typed.find((station) => this.#jobsAt(station.id).length < station.capacity);
    if (!free) return { ok: false, reason: 'station-full', consumed: [] };

    if (!hasInputs(recipe, this.stockOf)) return { ok: false, reason: 'insufficient-inputs', consumed: [] };

    // Consume-at-start, the one documented input policy. Completion adds
    // outputs and never touches inputs again.
    const batch = recipe.batchSize ?? 1;
    const consumed: ItemQuantity[] = [];
    for (const input of recipe.inputs) {
      const units = input.quantity * batch;
      this.#stock.set(input.itemId, (this.#stock.get(input.itemId) ?? 0) - units);
      consumed.push({ itemId: input.itemId, quantity: units });
    }

    this.#jobSeq += 1;
    const id = `job-${String(this.#jobSeq).padStart(4, '0')}`;
    this.#jobs.set(id, {
      id,
      recipeId: recipe.id,
      stationId: free.id,
      batchSize: batch,
      remainingMs: recipe.durationMs,
      totalMs: recipe.durationMs,
      consumed: mergeQuantities(consumed),
    });
    this.#emitProduction({ kind: 'job-started', jobId: id, recipeId: recipe.id, stationId: free.id });
    return { ok: true, jobId: id, stationId: free.id, consumed: mergeQuantities(consumed) };
  }

  cancel(jobId: string): boolean {
    const job = this.#jobs.get(jobId);
    if (!job) return false;
    this.#jobs.delete(jobId);
    // Refunding what the job consumed is the counterpart of consume-at-start,
    // not a second consumption. Anything over capacity is simply lost.
    for (const entry of job.consumed) this.#addStock(entry.itemId, entry.quantity);
    this.#emitProduction({ kind: 'job-cancelled', jobId, refunded: job.consumed });
    return true;
  }

  /** Credit one completed batch of `recipe`, returning what was produced and lost. */
  #completeBatch(recipe: RecipeDefinition, batchSize: number): {
    produced: ItemQuantity[];
    wasted: ItemQuantity[];
  } {
    const produced: ItemQuantity[] = [];
    const wasted: ItemQuantity[] = [];
    for (const output of recipe.outputs) {
      const units = output.quantity * batchSize;
      const lost = this.#addStock(output.itemId, units);
      if (units - lost > 0) produced.push({ itemId: output.itemId, quantity: units - lost });
      if (lost > 0) wasted.push({ itemId: output.itemId, quantity: lost });
    }
    return { produced, wasted };
  }

  // --- Placement --------------------------------------------------------

  #occupiedRects(exceptStationId: string): readonly Rect[] {
    const rects: Rect[] = [];
    for (const [id, position] of this.#positions) {
      if (id === exceptStationId || position === null) continue;
      const station = this.#stations.get(id);
      if (!station) continue;
      rects.push(footprintRect(position, station.footprint ?? DEFAULT_FOOTPRINT));
    }
    return rects;
  }

  canPlace(stationId: string, x: number, y: number): PlacementResult {
    const station = this.#stations.get(stationId);
    const position: Point = { x, y };
    if (!station) return { ok: false, reason: 'unknown-station', stationId, position };
    const zones: readonly PlacementZone[] = this.#document.zones ?? [];
    const reason = evaluatePlacement(station, position, zones, this.#occupiedRects(stationId));
    return reason ? { ok: false, reason, stationId, position } : { ok: true, stationId, position };
  }

  place(stationId: string, x: number, y: number): PlacementResult {
    const result = this.canPlace(stationId, x, y);
    if (!result.ok) return result;
    this.#positions.set(stationId, result.position);
    this.#emitProduction({ kind: 'station-placed', stationId, position: result.position });
    return result;
  }

  // --- Customers and queues ---------------------------------------------

  queueStates(): readonly QueueState[] {
    return [...this.#queues.values()]
      .map((queue) => ({
        id: queue.id,
        capacity: queue.capacity,
        serviceSlots: queue.serviceSlots,
        waiting: (this.#waiting.get(queue.id) ?? []).map((customerId) => {
          const customer = this.#customers.get(customerId)!;
          return { customerId, joinOrder: customer.joinOrder ?? 0, waitMs: customer.waitMs };
        }),
        serving: [...(this.#serving.get(queue.id) ?? [])].sort((a, b) => a.localeCompare(b)),
      }))
      .sort((a, b) => a.id.localeCompare(b.id));
  }

  customerStates(): readonly CustomerState[] {
    return [...this.#customers.values()]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((customer) => this.#snapshot(customer));
  }

  customerState(customerId: string): CustomerState | undefined {
    const customer = this.#customers.get(customerId);
    return customer ? this.#snapshot(customer) : undefined;
  }

  #snapshot(customer: MutableCustomer): CustomerState {
    return {
      id: customer.id,
      archetypeId: customer.archetypeId,
      phase: customer.phase,
      funds: customer.funds,
      patienceRemainingMs: customer.patienceRemainingMs,
      targetItemId: customer.targetItemId,
      quantity: customer.quantity,
      queueId: customer.queueId,
      joinOrder: customer.joinOrder,
      waitMs: customer.waitMs,
      outcome: customer.outcome,
    };
  }

  spawnCustomer(archetypeId?: string, options?: { readonly id?: string }): CustomerState | null {
    const archetype = archetypeId
      ? this.#archetypes.get(archetypeId)
      : pickArchetype([...this.#archetypes.values()], this.#rng);
    if (!archetype) return null;

    this.#customerSeq += 1;
    const id = options?.id ?? `cust-${String(this.#customerSeq).padStart(4, '0')}`;
    const customer: MutableCustomer = {
      id,
      archetypeId: archetype.id,
      phase: 'arrive',
      funds: archetype.budget,
      patienceRemainingMs: archetype.patienceMs,
      targetItemId: null,
      quantity: 0,
      queueId: null,
      joinOrder: null,
      waitMs: 0,
      outcome: null,
      phaseRemainingMs: 0,
    };
    this.#customers.set(id, customer);
    this.#emitEconomy({ kind: 'customer-phase', customerId: id, phase: 'arrive' });
    return this.#snapshot(customer);
  }

  #setPhase(customer: MutableCustomer, phase: CustomerPhase): void {
    customer.phase = phase;
    this.#emitEconomy({ kind: 'customer-phase', customerId: customer.id, phase });
  }

  /**
   * Leave cleanly: the queue slot and the service slot are released before the
   * customer is marked done, so a customer who runs out of patience mid-queue
   * never leaves a reservation behind.
   */
  #leave(customer: MutableCustomer, outcome: CustomerOutcome): void {
    if (customer.queueId) {
      const waiting = this.#waiting.get(customer.queueId);
      if (waiting) {
        const index = waiting.indexOf(customer.id);
        if (index >= 0) waiting.splice(index, 1);
      }
      this.#serving.get(customer.queueId)?.delete(customer.id);
    }
    customer.queueId = null;
    customer.joinOrder = null;
    customer.outcome = outcome;
    this.#setPhase(customer, 'leave');
    this.#emitEconomy({ kind: 'customer-left', customerId: customer.id, outcome });
  }

  #defaultQueue(): QueueDefinition | undefined {
    return [...this.#queues.values()].sort((a, b) => a.id.localeCompare(b.id))[0];
  }

  #advanceCustomers(deltaMs: number): void {
    // Ascending id order: with several customers on one frame, who moves first
    // must not depend on Map insertion order.
    const ordered = [...this.#customers.values()].sort((a, b) => a.id.localeCompare(b.id));

    for (const customer of ordered) {
      if (customer.phase === 'leave') {
        this.#customers.delete(customer.id);
        continue;
      }

      // Patience runs while walking and while waiting - not while being served.
      // A customer already at the counter walking out mid-sale would leave the
      // transaction ambiguous, and the outcome is the thing this must not blur.
      if (customer.phase === 'navigate' || customer.phase === 'queue') {
        customer.patienceRemainingMs = Math.max(0, customer.patienceRemainingMs - deltaMs);
        if (customer.patienceRemainingMs === 0) {
          this.#leave(customer, 'impatient');
          continue;
        }
      }

      switch (customer.phase) {
        case 'arrive':
          this.#setPhase(customer, 'choose-target');
          break;

        case 'choose-target': {
          const archetype = this.#archetypes.get(customer.archetypeId)!;
          const choice = chooseTarget(archetype, customer.funds, this.goodStates());
          if ('reason' in choice) {
            this.#leave(customer, choice.reason);
            break;
          }
          customer.targetItemId = choice.itemId;
          customer.quantity = choice.quantity;
          const queue = this.#defaultQueue();
          customer.phaseRemainingMs = queue?.navigateMs ?? 0;
          this.#setPhase(customer, 'navigate');
          break;
        }

        case 'navigate': {
          customer.phaseRemainingMs = Math.max(0, customer.phaseRemainingMs - deltaMs);
          if (customer.phaseRemainingMs > 0) break;
          const queue = this.#defaultQueue();
          if (!queue) {
            this.#leave(customer, 'queue-full');
            break;
          }
          const waiting = this.#waiting.get(queue.id)!;
          const serving = this.#serving.get(queue.id)!;
          if (waiting.length + serving.size >= queue.capacity) {
            this.#leave(customer, 'queue-full');
            break;
          }
          const nextOrder = (this.#joinSeq.get(queue.id) ?? 0) + 1;
          this.#joinSeq.set(queue.id, nextOrder);
          customer.queueId = queue.id;
          customer.joinOrder = nextOrder;
          customer.waitMs = 0;
          waiting.push(customer.id);
          this.#setPhase(customer, 'queue');
          break;
        }

        case 'queue': {
          customer.waitMs += deltaMs;
          const queue = this.#queues.get(customer.queueId!)!;
          const waiting = this.#waiting.get(queue.id)!;
          const serving = this.#serving.get(queue.id)!;
          // Strict FIFO: only the head is ever promoted, so a later arrival can
          // never overtake an earlier one even when a slot frees.
          if (waiting[0] !== customer.id || serving.size >= queue.serviceSlots) break;
          waiting.shift();
          serving.add(customer.id);
          customer.phaseRemainingMs = queue.serviceMs;
          this.#setPhase(customer, 'service');
          break;
        }

        case 'service': {
          customer.phaseRemainingMs = Math.max(0, customer.phaseRemainingMs - deltaMs);
          if (customer.phaseRemainingMs > 0) break;
          this.#setPhase(customer, 'transaction');
          break;
        }

        case 'transaction': {
          const result = this.transact({
            itemId: customer.targetItemId!,
            quantity: customer.quantity,
            side: 'sell',
            buyerFunds: customer.funds,
          });
          if (result.ok) {
            customer.funds = result.buyerFundsAfter ?? customer.funds;
            this.#leave(customer, 'purchased');
          } else {
            this.#leave(customer, result.reason === 'insufficient-funds' ? 'unaffordable' : 'out-of-stock');
          }
          break;
        }

        default:
          break;
      }
    }
  }

  #advanceArrivals(deltaMs: number): void {
    const arrival: ArrivalPolicy | undefined = this.#document.arrival;
    if (!arrival || arrival.enabled === false) return;
    this.#sinceArrivalMs += deltaMs;
    while (this.#sinceArrivalMs >= arrival.intervalMs) {
      this.#sinceArrivalMs -= arrival.intervalMs;
      if (this.#customers.size >= arrival.maxConcurrent) continue;
      this.spawnCustomer();
    }
  }

  // --- Prestige ---------------------------------------------------------

  #prestigeDefinition(definitionId?: string): PrestigeDefinition | undefined {
    const definitions = this.#document.prestige ?? [];
    return definitionId ? definitions.find((entry) => entry.id === definitionId) : definitions[0];
  }

  prestigeState(): PrestigeState {
    const definition = this.#prestigeDefinition();
    const multiplier = prestigeMultiplier(this.#prestigeLevel, definition?.multiplierPerLevel);
    if (!definition) {
      return {
        level: this.#prestigeLevel,
        multiplier,
        lifetimeEarnings: this.#lifetimeEarnings,
        eligible: false,
        blockedBy: 'no-prestige-defined',
      };
    }
    const eligible = isPrestigeEligible(definition.eligibility, {
      lifetimeEarnings: this.#lifetimeEarnings,
      stockOf: this.stockOf,
      hasFlag: (flag) => this.#progression.isUnlocked(flag),
    });
    return {
      level: this.#prestigeLevel,
      multiplier,
      lifetimeEarnings: this.#lifetimeEarnings,
      eligible,
      blockedBy: eligible ? null : definition.eligibility.kind,
    };
  }

  performPrestige(definitionId?: string): PrestigeResult {
    const definition = this.#prestigeDefinition(definitionId);
    const state = this.prestigeState();
    if (!definition) {
      return {
        ok: false,
        reason: 'unknown-definition',
        level: state.level,
        multiplier: state.multiplier,
        grantedCurrency: 0,
        resetScopes: [],
      };
    }
    if (!state.eligible) {
      return {
        ok: false,
        reason: 'not-eligible',
        level: state.level,
        multiplier: state.multiplier,
        grantedCurrency: 0,
        resetScopes: [],
      };
    }

    const retained = new Set(definition.retainScopes ?? []);
    const applied = definition.resetScopes.filter((scope) => !retained.has(scope));

    for (const scope of applied) {
      switch (scope) {
        case 'goods-stock':
          for (const good of this.#goods.values()) this.#stock.set(good.itemId, good.stock);
          break;
        case 'production-jobs':
          // Wiped, not refunded: a prestige is a fresh start, and refunding
          // in-flight inputs into a shelf that is itself being reset is noise.
          this.#jobs.clear();
          break;
        case 'station-placement':
          for (const station of this.#stations.values()) {
            this.#positions.set(station.id, station.position ?? null);
          }
          break;
        case 'currency':
          this.#progression.addCurrency(-this.#progression.currency());
          break;
        case 'unlocks':
          // Unlock flags belong to progression, which has no revoke: recorded
          // as a known limitation rather than reaching into its private state.
          break;
      }
    }

    this.#prestigeLevel += 1;
    // The reward is granted after the reset so a `currency` wipe cannot eat it.
    const grantedCurrency = definition.rewardCurrency ?? 0;
    if (grantedCurrency > 0) this.#progression.addCurrency(grantedCurrency);
    if (definition.unlockFlag) this.#progression.unlock(definition.unlockFlag);

    const multiplier = prestigeMultiplier(this.#prestigeLevel, definition.multiplierPerLevel);
    this.#emitEconomy({ kind: 'prestige', level: this.#prestigeLevel, multiplier });
    return {
      ok: true,
      level: this.#prestigeLevel,
      multiplier,
      grantedCurrency,
      resetScopes: applied,
    };
  }

  // --- Offline ----------------------------------------------------------

  #offlinePolicy(): OfflinePolicy {
    return this.#document.offline ?? { maximumMs: 0 };
  }

  save(): void {
    if (!this.#saves) return;
    this.#saves.save<EconomySaveRecord>(ECONOMY_SAVE_SLOT, {
      schemaVersion: ECONOMY_SAVE_VERSION,
      savedAtMs: this.#clock.now(),
      stock: Object.fromEntries(this.#stock),
      prestigeLevel: this.#prestigeLevel,
      lifetimeEarnings: this.#lifetimeEarnings,
      jobs: [...this.#jobs.values()].map((job) => ({
        id: job.id,
        recipeId: job.recipeId,
        stationId: job.stationId,
        batchSize: job.batchSize,
        remainingMs: job.remainingMs,
        totalMs: job.totalMs,
      })),
    });
  }

  resume(): OfflineReport {
    if (!this.#saves) return EMPTY_OFFLINE_REPORT;
    const loaded = this.#saves.load<EconomySaveRecord>(ECONOMY_SAVE_SLOT, {
      currentVersion: ECONOMY_SAVE_VERSION,
      createDefault: () => ({
        schemaVersion: ECONOMY_SAVE_VERSION,
        savedAtMs: 0,
        stock: {},
        prestigeLevel: 0,
        lifetimeEarnings: 0,
        jobs: [],
      }),
    });
    if (loaded.outcome !== 'loaded' && loaded.outcome !== 'migrated') return EMPTY_OFFLINE_REPORT;

    const record = loaded.value;
    for (const [itemId, stock] of Object.entries(record.stock)) {
      if (this.#goods.has(itemId)) this.#stock.set(itemId, stock);
    }
    this.#prestigeLevel = record.prestigeLevel;
    this.#lifetimeEarnings = record.lifetimeEarnings;
    this.#jobs.clear();
    this.#jobSeq = 0;
    for (const job of record.jobs) {
      const recipe = this.#recipes.get(job.recipeId);
      if (!recipe) continue;
      // Inputs were consumed before the save, so a restored job carries them for
      // a later cancel and must not consume again here.
      this.#jobs.set(job.id, {
        id: job.id,
        recipeId: job.recipeId,
        stationId: job.stationId,
        batchSize: job.batchSize,
        remainingMs: job.remainingMs,
        totalMs: job.totalMs,
        consumed: mergeQuantities(
          recipe.inputs.map((input) => ({ itemId: input.itemId, quantity: input.quantity * job.batchSize })),
        ),
      });
      const sequence = Number.parseInt(job.id.replace(/^job-/, ''), 10);
      if (Number.isFinite(sequence)) this.#jobSeq = Math.max(this.#jobSeq, sequence);
    }

    const policy = this.#offlinePolicy();
    const requestedRaw = this.#clock.now() - record.savedAtMs;
    const appliedMs = offlineElapsedMs(this.#clock.now(), record.savedAtMs, policy.maximumMs);
    const catchUp = this.catchUp(appliedMs);
    return {
      ...catchUp,
      requestedMs: requestedRaw > 0 ? requestedRaw : 0,
      clamped: requestedRaw > policy.maximumMs,
    };
  }

  /**
   * Aggregate an absence into whole completed batches. Deliberately not a frame
   * replay: eight hours at 60fps is 1.7 million frames, and a catch-up that
   * takes visible time to compute is a catch-up players notice.
   */
  catchUp(elapsedMs: number): OfflineReport {
    if (!(elapsedMs > 0) || this.#jobs.size === 0) {
      return { ...EMPTY_OFFLINE_REPORT, appliedMs: elapsedMs > 0 ? elapsedMs : 0, requestedMs: elapsedMs > 0 ? elapsedMs : 0 };
    }
    const efficiency = this.#offlinePolicy().efficiency ?? 1;
    const credited = elapsedMs * efficiency;

    const produced: ItemQuantity[] = [];
    const wasted: ItemQuantity[] = [];
    let jobsCompleted = 0;

    for (const job of [...this.#jobs.values()].sort((a, b) => a.id.localeCompare(b.id))) {
      const recipe = this.#recipes.get(job.recipeId);
      if (!recipe) continue;
      if (credited < job.remainingMs) {
        job.remainingMs -= credited;
        continue;
      }
      // The in-flight batch finishes; whatever time is left runs the recipe
      // again, but every repeat has to pay for its own inputs.
      let batches = 1;
      let leftover = credited - job.remainingMs;
      const repeats = Math.min(Math.floor(leftover / recipe.durationMs), MAX_OFFLINE_BATCHES);
      for (let index = 0; index < repeats; index += 1) {
        if (!hasInputs(recipe, this.stockOf)) break;
        for (const input of recipe.inputs) {
          const units = input.quantity * job.batchSize;
          this.#stock.set(input.itemId, (this.#stock.get(input.itemId) ?? 0) - units);
        }
        batches += 1;
        leftover -= recipe.durationMs;
      }
      for (let index = 0; index < batches; index += 1) {
        const outcome = this.#completeBatch(recipe, job.batchSize);
        produced.push(...outcome.produced);
        wasted.push(...outcome.wasted);
      }
      jobsCompleted += batches;
      this.#jobs.delete(job.id);
      this.#emitProduction({
        kind: 'job-completed',
        jobId: job.id,
        recipeId: recipe.id,
        produced: mergeQuantities(produced),
        wasted: mergeQuantities(wasted),
      });
    }

    return {
      requestedMs: elapsedMs,
      appliedMs: elapsedMs,
      clamped: false,
      jobsCompleted,
      produced: mergeQuantities(produced),
      wasted: mergeQuantities(wasted),
    };
  }

  // --- Frame ------------------------------------------------------------

  update(deltaMs: number): void {
    if (!(deltaMs > 0)) return;
    const speed = this.prestigeState().multiplier;

    for (const job of [...this.#jobs.values()].sort((a, b) => a.id.localeCompare(b.id))) {
      job.remainingMs -= deltaMs * speed;
      if (job.remainingMs > 0) continue;
      const recipe = this.#recipes.get(job.recipeId);
      this.#jobs.delete(job.id);
      if (!recipe) continue;
      const outcome = this.#completeBatch(recipe, job.batchSize);
      this.#emitProduction({
        kind: 'job-completed',
        jobId: job.id,
        recipeId: recipe.id,
        produced: mergeQuantities(outcome.produced),
        wasted: mergeQuantities(outcome.wasted),
      });
    }

    this.#advanceArrivals(deltaMs);
    this.#advanceCustomers(deltaMs);
  }

  // --- Events and reset --------------------------------------------------

  #emitEconomy(event: EconomyEvent): void {
    this.#economyEvents.push(event);
    switch (event.kind) {
      case 'transaction':
        this.#events?.emit('economy:transaction', {
          itemId: event.result.itemId,
          side: event.result.side,
          quantity: event.result.quantity,
          total: event.result.total,
        });
        break;
      case 'customer-left':
        this.#events?.emit('economy:customerLeft', { customerId: event.customerId, outcome: event.outcome });
        break;
      case 'prestige':
        this.#events?.emit('economy:prestige', { level: event.level, multiplier: event.multiplier });
        break;
      default:
        break;
    }
  }

  #emitProduction(event: ProductionEvent): void {
    this.#productionEvents.push(event);
    if (event.kind === 'job-completed') {
      this.#events?.emit('production:jobCompleted', { jobId: event.jobId, recipeId: event.recipeId });
    }
  }

  drainEconomyEvents(): readonly EconomyEvent[] {
    return this.#economyEvents.splice(0, this.#economyEvents.length);
  }

  drainProductionEvents(): readonly ProductionEvent[] {
    return this.#productionEvents.splice(0, this.#productionEvents.length);
  }

  reset(): void {
    for (const good of this.#goods.values()) {
      this.#stock.set(good.itemId, good.stock);
      this.#demand.set(good.itemId, good.demandMultiplier ?? 1);
    }
    for (const station of this.#stations.values()) this.#positions.set(station.id, station.position ?? null);
    this.#jobs.clear();
    this.#jobSeq = 0;
    this.#customers.clear();
    this.#customerSeq = 0;
    this.#sinceArrivalMs = 0;
    for (const queue of this.#queues.values()) {
      this.#waiting.set(queue.id, []);
      this.#serving.set(queue.id, new Set());
      this.#joinSeq.set(queue.id, 0);
    }
    this.#prestigeLevel = 0;
    this.#lifetimeEarnings = 0;
    this.#economyEvents.length = 0;
    this.#productionEvents.length = 0;
  }
}

class EconomyServiceImpl implements EconomyService {
  readonly #core: EconomyCore;
  constructor(core: EconomyCore) {
    this.#core = core;
  }
  goods = (): readonly GoodState[] => this.#core.goodStates();
  good = (itemId: string): GoodState | undefined => this.#core.goodStateOf(itemId);
  stock = (itemId: string): number => this.#core.stockOf(itemId);
  funds = (): number => this.#core.funds();
  transact = (request: TransactionRequest): TransactionResult => this.#core.transact(request);
  restock = (itemId: string, quantity?: number): TransactionResult => this.#core.restock(itemId, quantity);
  setDemandMultiplier = (itemId: string, multiplier: number): void =>
    this.#core.setDemandMultiplier(itemId, multiplier);
  queues = (): readonly QueueState[] => this.#core.queueStates();
  customers = (): readonly CustomerState[] => this.#core.customerStates();
  customer = (customerId: string): CustomerState | undefined => this.#core.customerState(customerId);
  spawnCustomer = (archetypeId?: string, options?: { readonly id?: string }): CustomerState | null =>
    this.#core.spawnCustomer(archetypeId, options);
  prestigeState = (): PrestigeState => this.#core.prestigeState();
  performPrestige = (definitionId?: string): PrestigeResult => this.#core.performPrestige(definitionId);
  save = (): void => this.#core.save();
  resume = (): OfflineReport => this.#core.resume();
  reset = (): void => this.#core.reset();
  drainEvents = (): readonly EconomyEvent[] => this.#core.drainEconomyEvents();
}

class ProductionServiceImpl implements ProductionService {
  readonly #core: EconomyCore;
  constructor(core: EconomyCore) {
    this.#core = core;
  }
  recipes = (): readonly RecipeDefinition[] => this.#core.recipeList();
  isUnlocked = (recipeId: string): boolean => this.#core.isUnlocked(recipeId);
  stations = (): readonly StationState[] => this.#core.stationStates();
  jobs = (): readonly ProductionJob[] => this.#core.jobList();
  start = (recipeId: string, stationId?: string): ProductionStartResult => this.#core.start(recipeId, stationId);
  cancel = (jobId: string): boolean => this.#core.cancel(jobId);
  canPlace = (stationId: string, x: number, y: number): PlacementResult => this.#core.canPlace(stationId, x, y);
  place = (stationId: string, x: number, y: number): PlacementResult => this.#core.place(stationId, x, y);
  catchUp = (elapsedMs: number): OfflineReport => this.#core.catchUp(elapsedMs);
  reset = (): void => this.#core.reset();
  drainEvents = (): readonly ProductionEvent[] => this.#core.drainProductionEvents();
}

/** What a headless economy is: two services and the one thing that advances them. */
export interface EconomyBundle {
  readonly economy: EconomyService;
  readonly production: ProductionService;
  /**
   * Frame advancement. It is here rather than on either service on purpose: a
   * consumer holding an `EconomyService` cannot step the simulation, which is
   * the rule Phase 16 established after a shell and a pack both advanced one ball.
   */
  update(deltaMs: number): void;
}

/**
 * Build an economy without a `GameContext`. Used by the pack's own `install`,
 * and by tests and tools that need the simulation without a renderer.
 */
export function createEconomy(
  document: EconomyDocument,
  progression: ProgressionService,
  options: {
    readonly clock?: WallClock;
    readonly events?: EventBus;
    readonly saves?: SaveStore;
    readonly arrivalSeed?: number;
  } = {},
): EconomyBundle {
  validateEconomyDocument(document);
  const core = new EconomyCore(document, progression, options.clock ?? new ManualWallClock(0), {
    ...(options.events ? { events: options.events } : {}),
    ...(options.saves ? { saves: options.saves } : {}),
    ...(options.arrivalSeed !== undefined ? { arrivalSeed: options.arrivalSeed } : {}),
  });
  return {
    economy: new EconomyServiceImpl(core),
    production: new ProductionServiceImpl(core),
    update: (deltaMs: number) => core.update(deltaMs),
  };
}

export const economyPack: SystemPackDefinition<EconomyConfig, GameContext> = {
  id: PACK_IDS.economy,
  version: '0.1.0',
  provides: [CAPABILITY_IDS.economy, CAPABILITY_IDS.production],
  dependencies: [CAPABILITY_IDS.progression],
  configSchemaId: ECONOMY_CONFIG_SCHEMA_ID,

  install(context: GameContext, config: EconomyConfig): InstalledSystemPack {
    const documentName = config?.documentName ?? 'economy';
    const document = context.content.data[documentName]?.value as EconomyDocument | undefined;
    if (!document) throw new MissingEconomyDocumentError(documentName);
    // `createEconomy` runs the semantic gate the JSON schema cannot express
    // (cross-references, orderings, "retains everything it resets").

    const progression = context.capabilities.get<ProgressionService>(CAPABILITY_IDS.progression);
    if (!progression) throw new MissingProgressionError();

    const bundle = createEconomy(document, progression, {
      ...(context.capabilities.get<WallClock>(CAPABILITY_IDS.wallClock)
        ? { clock: context.capabilities.require<WallClock>(CAPABILITY_IDS.wallClock) }
        : {}),
      ...(context.events ? { events: context.events } : {}),
      ...(context.saves ? { saves: context.saves } : {}),
      ...(config?.arrivalSeed !== undefined ? { arrivalSeed: config.arrivalSeed } : {}),
    });

    const economyHandle = context.capabilities.provide(CAPABILITY_IDS.economy, bundle.economy);
    const productionHandle = context.capabilities.provide(CAPABILITY_IDS.production, bundle.production);

    return {
      id: PACK_IDS.economy,
      update(deltaMs: number): void {
        bundle.update(deltaMs);
      },
      dispose(): void {
        productionHandle.dispose();
        economyHandle.dispose();
      },
    };
  },
};

export type { EconomyService, ProductionService } from '@sw2d/contracts';
