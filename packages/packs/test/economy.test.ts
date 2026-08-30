import { describe, expect, it } from 'vitest';
import type {
  EconomyDocument,
  EconomyService,
  GameContext,
  ProductionService,
  SaveStore,
  StorageDriver,
  VersionedRecord,
} from '@sw2d/contracts';
import { ManualWallClock } from '@sw2d/contracts';
import { createFakeGameContext } from './testSupport.ts';
import {
  createEconomy,
  economyPack,
  MissingEconomyDocumentError,
  MissingProgressionError,
  type EconomyBundle,
} from '../src/economy/economyPack.ts';
import { progressionPack, type ProgressionService } from '../src/progression/progressionPack.ts';

/**
 * A shop: two goods, one oven recipe, one till, two kinds of customer.
 * Every id here is authored - the pack knows no `apple` and no `baker`.
 */
const SHOP: EconomyDocument = {
  schemaVersion: 1,
  goods: [
    { itemId: 'apple', stock: 10, capacity: 20, buyPrice: 2, sellPrice: 5, restockQuantity: 4 },
    { itemId: 'pie', stock: 0, capacity: 6, buyPrice: 8, sellPrice: 20 },
  ],
  stations: [{ id: 'oven-1', type: 'oven', capacity: 2 }],
  recipes: [
    {
      id: 'bake-pie',
      inputs: [{ itemId: 'apple', quantity: 3 }],
      outputs: [{ itemId: 'pie', quantity: 1 }],
      durationMs: 1000,
      stationType: 'oven',
    },
    {
      id: 'bake-deluxe',
      inputs: [{ itemId: 'apple', quantity: 2 }],
      outputs: [{ itemId: 'pie', quantity: 2 }],
      durationMs: 2000,
      stationType: 'oven',
      unlock: [{ kind: 'flag', flag: 'deluxe-licence' }],
    },
  ],
  zones: [
    { id: 'floor', kind: 'buildable', x: 0, y: 0, width: 20, height: 10 },
    { id: 'walkway', kind: 'aisle', x: 0, y: 10, width: 20, height: 4 },
  ],
  queues: [{ id: 'till', capacity: 3, serviceSlots: 1, serviceMs: 500, navigateMs: 200 }],
  customers: [
    { id: 'regular', budget: 40, patienceMs: 5000, demandWeights: { apple: 5 }, arrivalWeight: 3 },
    { id: 'gourmet', budget: 100, patienceMs: 5000, demandWeights: { pie: 9, apple: 1 }, arrivalWeight: 1 },
  ],
  offline: { maximumMs: 60_000 },
  prestige: [
    {
      id: 'franchise',
      eligibility: { kind: 'lifetime-earnings-at-least', amount: 50 },
      resetScopes: ['goods-stock', 'production-jobs', 'currency'],
      rewardCurrency: 30,
      multiplierPerLevel: 1,
      unlockFlag: 'franchised',
    },
  ],
};

class MemoryStorage implements StorageDriver {
  readonly available = true;
  readonly #map = new Map<string, string>();
  read(key: string): string | null {
    return this.#map.get(key) ?? null;
  }
  write(key: string, value: string): void {
    this.#map.set(key, value);
  }
  remove(key: string): void {
    this.#map.delete(key);
  }
}

/** A minimal real SaveStore over an in-memory driver - not a stub of `save`. */
class MemorySaveStore implements SaveStore {
  readonly namespace = 'test';
  readonly #driver = new MemoryStorage();
  load<T extends VersionedRecord>(
    slot: string,
    options: { currentVersion: number; createDefault: () => T },
  ): { value: T; outcome: 'default' | 'loaded' } {
    const raw = this.#driver.read(`${this.namespace}:${slot}`);
    if (raw === null) return { value: options.createDefault(), outcome: 'default' };
    const parsed = JSON.parse(raw) as T;
    if (parsed.schemaVersion !== options.currentVersion) {
      return { value: options.createDefault(), outcome: 'default' };
    }
    return { value: parsed, outcome: 'loaded' };
  }
  save<T extends VersionedRecord>(slot: string, value: T): void {
    this.#driver.write(`${this.namespace}:${slot}`, JSON.stringify(value));
  }
  clear(slot: string): void {
    this.#driver.remove(`${this.namespace}:${slot}`);
  }
}

/** A progression stand-in with the same wallet semantics the real pack has. */
class FakeProgression implements ProgressionService {
  #currency: number;
  #xp = 0;
  readonly #flags = new Set<string>();
  readonly #items = new Map<string, number>();
  constructor(currency = 0) {
    this.#currency = currency;
  }
  currency(): number {
    return this.#currency;
  }
  addCurrency(delta: number): number {
    this.#currency = Math.max(0, this.#currency + delta);
    return this.#currency;
  }
  xp(): number {
    return this.#xp;
  }
  addXp(delta: number): number {
    this.#xp = Math.max(0, this.#xp + delta);
    return this.#xp;
  }
  unlock(flag: string): void {
    this.#flags.add(flag);
  }
  isUnlocked(flag: string): boolean {
    return this.#flags.has(flag);
  }
  unlockedFlags(): readonly string[] {
    return [...this.#flags].sort();
  }
  itemCount(itemId: string): number {
    return this.#items.get(itemId) ?? 0;
  }
  addItem(itemId: string, delta: number): number {
    const next = Math.max(0, this.itemCount(itemId) + delta);
    this.#items.set(itemId, next);
    return next;
  }
}

interface Harness extends EconomyBundle {
  readonly progression: FakeProgression;
  readonly clock: ManualWallClock;
  readonly saves: MemorySaveStore;
}

function shop(
  overrides: Partial<EconomyDocument> = {},
  options: { currency?: number; arrivalSeed?: number } = {},
): Harness {
  const progression = new FakeProgression(options.currency ?? 100);
  const clock = new ManualWallClock(1_000_000);
  const saves = new MemorySaveStore();
  const bundle = createEconomy({ ...SHOP, ...overrides }, progression, {
    clock,
    saves,
    ...(options.arrivalSeed !== undefined ? { arrivalSeed: options.arrivalSeed } : {}),
  });
  return { ...bundle, progression, clock, saves };
}

function createContext(document?: EconomyDocument): GameContext {
  const base = createFakeGameContext();
  const data: Record<string, { schemaId: string; valid: true; value: unknown }> = {};
  if (document) data['economy'] = { schemaId: 'economy', valid: true, value: document };
  return { ...base, content: { ...base.content, data } };
}

/** Step the simulation in real frames, as the runtime does. */
function step(bundle: EconomyBundle, ms: number, frameMs = 100): void {
  let remaining = ms;
  while (remaining > 0) {
    const delta = Math.min(frameMs, remaining);
    bundle.update(delta);
    remaining -= delta;
  }
}

describe('economyPack installation', () => {
  it('provides both capabilities and releases them on dispose', () => {
    const context = createContext(SHOP);
    progressionPack.install(context, {});
    const installed = economyPack.install(context, {});
    expect(context.capabilities.has('simulation.economy')).toBe(true);
    expect(context.capabilities.has('simulation.production')).toBe(true);
    expect(installed.id).toBe('sw2d.economy');
    installed.dispose();
    expect(context.capabilities.has('simulation.economy')).toBe(false);
    expect(context.capabilities.has('simulation.production')).toBe(false);
  });

  it('requires the content document', () => {
    const context = createContext();
    progressionPack.install(context, {});
    expect(() => economyPack.install(context, {})).toThrow(MissingEconomyDocumentError);
  });

  it('refuses to run without a wallet rather than quietly opening its own', () => {
    expect(() => economyPack.install(createContext(SHOP), {})).toThrow(MissingProgressionError);
  });

  it('rejects a semantically invalid document at install, not at first use', () => {
    const context = createContext({ ...SHOP, goods: [{ ...SHOP.goods[0]!, stock: 999 }] });
    progressionPack.install(context, {});
    expect(() => economyPack.install(context, {})).toThrow(/capacity is 20/);
  });

  it('reads an alternative document name when configured', () => {
    const base = createFakeGameContext();
    const context = {
      ...base,
      content: { ...base.content, data: { shop: { schemaId: 'economy', valid: true, value: SHOP } } },
    } as GameContext;
    progressionPack.install(context, {});
    expect(() => economyPack.install(context, { documentName: 'shop' })).not.toThrow();
  });
});

describe('goods and stock', () => {
  it('reports the authored opening stock and prices, sorted by item id', () => {
    const { economy } = shop();
    expect(economy.goods().map((good) => good.itemId)).toEqual(['apple', 'pie']);
    expect(economy.stock('apple')).toBe(10);
    expect(economy.good('apple')!.unitSellPrice).toBe(5);
  });

  it('demand scales what a customer pays and not what a supplier charges', () => {
    const { economy } = shop();
    economy.setDemandMultiplier('apple', 3);
    expect(economy.good('apple')!.unitSellPrice).toBe(15);
    expect(economy.good('apple')!.unitBuyPrice).toBe(2);
  });

  it('ignores a demand multiplier for an unknown good or a nonsense value', () => {
    const { economy } = shop();
    economy.setDemandMultiplier('nope', 5);
    economy.setDemandMultiplier('apple', -1);
    expect(economy.good('apple')!.demandMultiplier).toBe(1);
  });
});

describe('transactions', () => {
  it('a sell moves stock one way and money the other, and emits exactly one event', () => {
    const { economy } = shop({}, { currency: 0 });
    const result = economy.transact({ itemId: 'apple', quantity: 2, side: 'sell', buyerFunds: 50 });
    expect(result.ok).toBe(true);
    expect(result.total).toBe(10);
    expect(result.stockAfter).toBe(8);
    expect(result.buyerFundsAfter).toBe(40);
    expect(economy.funds()).toBe(10);
    const events = economy.drainEvents().filter((event) => event.kind === 'transaction');
    expect(events).toHaveLength(1);
  });

  it('a refused sell changes nothing at all and emits nothing', () => {
    const { economy } = shop({}, { currency: 0 });
    economy.drainEvents();
    const result = economy.transact({ itemId: 'apple', quantity: 2, side: 'sell', buyerFunds: 1 });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('insufficient-funds');
    expect(economy.stock('apple')).toBe(10);
    expect(economy.funds()).toBe(0);
    expect(economy.drainEvents()).toHaveLength(0);
  });

  it('refuses a sell beyond stock without partially filling it', () => {
    const { economy } = shop();
    const result = economy.transact({ itemId: 'apple', quantity: 99, side: 'sell', buyerFunds: 9999 });
    expect(result.reason).toBe('insufficient-stock');
    expect(economy.stock('apple')).toBe(10);
  });

  it('a restock spends the shop\'s own funds and fills the shelf', () => {
    const { economy } = shop({}, { currency: 100 });
    const result = economy.transact({ itemId: 'apple', quantity: 5, side: 'restock' });
    expect(result.ok).toBe(true);
    expect(result.total).toBe(10);
    expect(economy.stock('apple')).toBe(15);
    expect(economy.funds()).toBe(90);
  });

  it('refuses a restock that would overflow the shelf', () => {
    const { economy } = shop();
    const result = economy.transact({ itemId: 'apple', quantity: 11, side: 'restock' });
    expect(result.reason).toBe('insufficient-capacity');
    expect(economy.stock('apple')).toBe(10);
  });

  it('restock() uses the good\'s authored restockQuantity', () => {
    const { economy } = shop();
    expect(economy.restock('apple').quantity).toBe(4);
    expect(economy.stock('apple')).toBe(14);
  });

  it('names an unknown good rather than throwing', () => {
    const { economy } = shop();
    expect(economy.transact({ itemId: 'ghost', quantity: 1, side: 'sell', buyerFunds: 9 }).reason).toBe(
      'unknown-good',
    );
  });
});

describe('production', () => {
  it('consumes inputs at start and produces outputs once on completion', () => {
    const { economy, production, update } = shop();
    const started = production.start('bake-pie');
    expect(started.ok).toBe(true);
    expect(started.consumed).toEqual([{ itemId: 'apple', quantity: 3 }]);
    expect(economy.stock('apple')).toBe(7); // consumed at start
    expect(economy.stock('pie')).toBe(0);

    update(999);
    expect(economy.stock('pie')).toBe(0); // not yet
    update(1);
    expect(economy.stock('pie')).toBe(1);
    expect(economy.stock('apple')).toBe(7); // never consumed a second time
    expect(production.jobs()).toHaveLength(0);
  });

  it('refuses a job whose inputs are not on the shelf, consuming nothing', () => {
    const { economy, production } = shop({ goods: [{ ...SHOP.goods[0]!, stock: 2 }, SHOP.goods[1]!] });
    const result = production.start('bake-pie');
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('insufficient-inputs');
    expect(result.consumed).toEqual([]);
    expect(economy.stock('apple')).toBe(2);
  });

  it('refuses a locked recipe and admits it once the flag is set', () => {
    const harness = shop();
    expect(harness.production.isUnlocked('bake-deluxe')).toBe(false);
    expect(harness.production.start('bake-deluxe').reason).toBe('locked');
    harness.progression.unlock('deluxe-licence');
    expect(harness.production.isUnlocked('bake-deluxe')).toBe(true);
    expect(harness.production.start('bake-deluxe').ok).toBe(true);
  });

  it('names an unknown recipe and a missing station type', () => {
    const { production } = shop();
    expect(production.start('nope').reason).toBe('unknown-recipe');
    expect(production.start('bake-pie', 'no-such-station').reason).toBe('no-station');
  });

  it('respects station capacity and reports the station as full', () => {
    const { production } = shop({ goods: [{ ...SHOP.goods[0]!, stock: 20, capacity: 20 }, SHOP.goods[1]!] });
    expect(production.start('bake-pie').ok).toBe(true);
    expect(production.start('bake-pie').ok).toBe(true);
    const third = production.start('bake-pie');
    expect(third.ok).toBe(false);
    expect(third.reason).toBe('station-full');
    expect(production.stations()[0]!.occupied).toBe(2);
  });

  it('a cancelled job refunds exactly what it consumed and nothing more', () => {
    const { economy, production } = shop();
    const started = production.start('bake-pie');
    expect(economy.stock('apple')).toBe(7);
    expect(production.cancel(started.jobId!)).toBe(true);
    expect(economy.stock('apple')).toBe(10);
    expect(production.jobs()).toHaveLength(0);
    expect(production.cancel(started.jobId!)).toBe(false);
  });

  it('a cancelled job produces no output even if it was nearly done', () => {
    const { economy, production, update } = shop();
    const started = production.start('bake-pie');
    update(900);
    production.cancel(started.jobId!);
    update(1000);
    expect(economy.stock('pie')).toBe(0);
  });

  it('output beyond shelf capacity is reported as wasted, not silently dropped', () => {
    const { economy, production, update } = shop({
      goods: [
        { itemId: 'apple', stock: 10, capacity: 20, buyPrice: 2, sellPrice: 5 },
        { itemId: 'pie', stock: 0, capacity: 1, buyPrice: 8, sellPrice: 20 },
      ],
      recipes: [
        {
          id: 'bake-pie',
          inputs: [{ itemId: 'apple', quantity: 1 }],
          outputs: [{ itemId: 'pie', quantity: 3 }],
          durationMs: 100,
          stationType: 'oven',
        },
      ],
    });
    production.start('bake-pie');
    update(100);
    expect(economy.stock('pie')).toBe(1);
    const completed = production.drainEvents().find((event) => event.kind === 'job-completed');
    expect(completed).toMatchObject({ produced: [{ itemId: 'pie', quantity: 1 }], wasted: [{ itemId: 'pie', quantity: 2 }] });
  });

  it('batchSize scales both the inputs taken and the outputs produced', () => {
    const { economy, production, update } = shop({
      goods: [{ ...SHOP.goods[0]!, stock: 20, capacity: 20 }, { ...SHOP.goods[1]!, capacity: 20 }],
      recipes: [{ ...SHOP.recipes![0]!, batchSize: 3 }],
    });
    production.start('bake-pie');
    expect(economy.stock('apple')).toBe(11); // 3 apples x batch 3
    update(1000);
    expect(economy.stock('pie')).toBe(3);
  });
});

describe('station placement', () => {
  it('accepts a placement inside a buildable zone and records it', () => {
    const { production } = shop();
    const result = production.place('oven-1', 10, 5);
    expect(result.ok).toBe(true);
    expect(production.stations()[0]!.position).toEqual({ x: 10, y: 5 });
  });

  it('refuses a placement outside every buildable zone', () => {
    const { production } = shop();
    expect(production.canPlace('oven-1', 100, 100).reason).toBe('outside-zone');
    expect(production.stations()[0]!.position).toBeNull();
  });

  it('refuses to overlap an already-placed station', () => {
    const { production } = shop({
      stations: [
        { id: 'oven-1', type: 'oven', capacity: 1, footprint: { width: 4, height: 4 } },
        { id: 'oven-2', type: 'oven', capacity: 1, footprint: { width: 4, height: 4 } },
      ],
    });
    expect(production.place('oven-1', 5, 5).ok).toBe(true);
    expect(production.canPlace('oven-2', 6, 5).reason).toBe('overlaps-station');
    expect(production.canPlace('oven-2', 9, 5).ok).toBe(true);
  });

  it('a station may be moved onto its own footprint without colliding with itself', () => {
    const { production } = shop({
      stations: [{ id: 'oven-1', type: 'oven', capacity: 1, footprint: { width: 4, height: 4 } }],
    });
    production.place('oven-1', 5, 5);
    expect(production.place('oven-1', 5, 5).ok).toBe(true);
  });

  it('refuses a station whose access point is not in an aisle', () => {
    const { production } = shop({
      // The aisle is the strip at y 10..14; the buildable floor is y 0..10.
      stations: [{ id: 'oven-1', type: 'oven', capacity: 1, accessOffset: { x: 0, y: 2 } }],
    });
    // Placed at y=5 the access point lands at y=7 - inside the floor, but the
    // floor is not somewhere an agent may stand.
    expect(production.canPlace('oven-1', 10, 5).reason).toBe('inaccessible');
    // Placed at the floor's edge the access point lands at y=11, in the aisle.
    expect(production.canPlace('oven-1', 10, 9).ok).toBe(true);
  });

  it('names an unknown station', () => {
    const { production } = shop();
    expect(production.canPlace('ghost', 1, 1).reason).toBe('unknown-station');
  });
});

describe('customers and queues', () => {
  it('walks the whole flow and ends in a purchase', () => {
    const { economy, update } = shop({}, { currency: 0 });
    economy.spawnCustomer('regular', { id: 'c1' });
    const phases: string[] = [];
    for (let frame = 0; frame < 40; frame += 1) {
      update(100);
      const events = economy.drainEvents();
      for (const event of events) {
        if (event.kind === 'customer-phase') phases.push(event.phase);
        if (event.kind === 'customer-left') phases.push(`left:${event.outcome}`);
      }
      if (phases.includes('left:purchased')) break;
    }
    expect(phases).toEqual([
      'arrive',
      'choose-target',
      'navigate',
      'queue',
      'service',
      'transaction',
      'leave',
      'left:purchased',
    ]);
    expect(economy.stock('apple')).toBe(9);
    expect(economy.funds()).toBe(5);
  });

  it('a customer who wants only an out-of-stock good leaves without queueing', () => {
    const { economy, update } = shop();
    economy.spawnCustomer('gourmet', { id: 'g1' }); // pie stock is 0, but apple weight is 1
    update(100);
    update(100);
    // The gourmet falls through to apple rather than leaving: a lower-weighted
    // good in stock still beats leaving empty-handed.
    expect(economy.customer('g1')!.targetItemId).toBe('apple');
  });

  it('a customer who can afford nothing leaves as unaffordable', () => {
    const { economy, update } = shop({
      customers: [
        { id: 'broke', budget: 1, patienceMs: 5000, demandWeights: { apple: 1 }, arrivalWeight: 1 },
      ],
    });
    economy.spawnCustomer('broke', { id: 'b1' });
    update(100);
    update(100);
    const left = economy.drainEvents().find((event) => event.kind === 'customer-left');
    expect(left).toMatchObject({ outcome: 'unaffordable' });
  });

  it('patience runs out while queueing and the queue slot is released', () => {
    const { economy, update } = shop({
      queues: [{ id: 'till', capacity: 3, serviceSlots: 1, serviceMs: 100_000, navigateMs: 0 }],
      customers: [
        { id: 'slow', budget: 40, patienceMs: 100_000, demandWeights: { apple: 1 }, arrivalWeight: 1 },
        { id: 'hasty', budget: 40, patienceMs: 600, demandWeights: { apple: 1 }, arrivalWeight: 1 },
      ],
    });
    economy.spawnCustomer('slow', { id: 'a-slow' });
    step({ update } as EconomyBundle, 300);
    economy.spawnCustomer('hasty', { id: 'b-hasty' });
    step({ update } as EconomyBundle, 300);
    expect(economy.queues()[0]!.waiting.map((entry) => entry.customerId)).toEqual(['b-hasty']);
    step({ update } as EconomyBundle, 1000);
    const left = economy.drainEvents().filter((event) => event.kind === 'customer-left');
    expect(left).toContainEqual({ kind: 'customer-left', customerId: 'b-hasty', outcome: 'impatient' });
    expect(economy.queues()[0]!.waiting).toHaveLength(0);
    expect(economy.queues()[0]!.serving).toEqual(['a-slow']);
  });

  it('patience does not run out mid-service, so an outcome is never ambiguous', () => {
    const { economy, update } = shop({
      queues: [{ id: 'till', capacity: 3, serviceSlots: 1, serviceMs: 5000, navigateMs: 0 }],
      customers: [
        { id: 'brief', budget: 40, patienceMs: 400, demandWeights: { apple: 1 }, arrivalWeight: 1 },
      ],
    });
    economy.spawnCustomer('brief', { id: 'c1' });
    step({ update } as EconomyBundle, 6000);
    const left = economy.drainEvents().find((event) => event.kind === 'customer-left');
    expect(left).toMatchObject({ outcome: 'purchased' });
  });

  it('the queue is strictly FIFO: a later arrival never overtakes an earlier one', () => {
    const { economy, update } = shop({
      queues: [{ id: 'till', capacity: 5, serviceSlots: 1, serviceMs: 400, navigateMs: 0 }],
      customers: [
        { id: 'regular', budget: 40, patienceMs: 100_000, demandWeights: { apple: 1 }, arrivalWeight: 1 },
      ],
    });
    const served: string[] = [];
    for (const id of ['c1', 'c2', 'c3']) {
      economy.spawnCustomer('regular', { id });
      step({ update } as EconomyBundle, 100);
    }
    for (let frame = 0; frame < 60; frame += 1) {
      update(100);
      for (const event of economy.drainEvents()) {
        if (event.kind === 'customer-phase' && event.phase === 'service') served.push(event.customerId);
      }
    }
    expect(served).toEqual(['c1', 'c2', 'c3']);
  });

  it('join order is monotonic and wait time accumulates only while queueing', () => {
    const { economy, update } = shop({
      queues: [{ id: 'till', capacity: 5, serviceSlots: 1, serviceMs: 100_000, navigateMs: 0 }],
    });
    economy.spawnCustomer('regular', { id: 'c1' });
    step({ update } as EconomyBundle, 200);
    economy.spawnCustomer('regular', { id: 'c2' });
    step({ update } as EconomyBundle, 500);
    const waiting = economy.queues()[0]!.waiting;
    expect(waiting).toHaveLength(1);
    expect(waiting[0]!.customerId).toBe('c2');
    expect(waiting[0]!.joinOrder).toBe(2);
    expect(waiting[0]!.waitMs).toBeGreaterThan(0);
  });

  it('an arrival beyond queue capacity leaves rather than waiting invisibly', () => {
    const { economy, update } = shop({
      queues: [{ id: 'till', capacity: 1, serviceSlots: 1, serviceMs: 100_000, navigateMs: 0 }],
    });
    economy.spawnCustomer('regular', { id: 'c1' });
    step({ update } as EconomyBundle, 300);
    economy.spawnCustomer('regular', { id: 'c2' });
    step({ update } as EconomyBundle, 300);
    const left = economy.drainEvents().filter((event) => event.kind === 'customer-left');
    expect(left).toContainEqual({ kind: 'customer-left', customerId: 'c2', outcome: 'queue-full' });
  });

  it('automatic arrivals are seeded, bounded by maxConcurrent, and reproducible', () => {
    const withArrivals = { arrival: { intervalMs: 500, maxConcurrent: 2 } };
    const runA = shop(withArrivals, { arrivalSeed: 11 });
    const runB = shop(withArrivals, { arrivalSeed: 11 });
    step(runA, 3000);
    step(runB, 3000);
    const idsA = runA.economy.customers().map((customer) => customer.archetypeId);
    const idsB = runB.economy.customers().map((customer) => customer.archetypeId);
    expect(idsA).toEqual(idsB);
    expect(runA.economy.customers().length).toBeLessThanOrEqual(2);
  });

  it('arrivals can be switched off entirely', () => {
    const { economy, update } = shop({ arrival: { intervalMs: 100, maxConcurrent: 5, enabled: false } });
    step({ update } as EconomyBundle, 2000);
    expect(economy.customers()).toHaveLength(0);
  });
});

describe('offline catch-up', () => {
  it('a save and an immediate resume credits nothing', () => {
    const harness = shop();
    harness.production.start('bake-pie');
    harness.economy.save();
    const report = harness.economy.resume();
    expect(report.appliedMs).toBe(0);
    expect(report.jobsCompleted).toBe(0);
  });

  it('credits whole completed batches without replaying frames', () => {
    const harness = shop({
      goods: [{ ...SHOP.goods[0]!, stock: 20, capacity: 20 }, { ...SHOP.goods[1]!, capacity: 20 }],
    });
    harness.production.start('bake-pie'); // 1000ms, 3 apples per batch
    harness.economy.save();
    harness.clock.advance(3500);
    const report = harness.economy.resume();
    expect(report.appliedMs).toBe(3500);
    expect(report.clamped).toBe(false);
    // 1 in-flight batch + 2 more whole ones (apples allow it), 3 pies total.
    expect(report.jobsCompleted).toBe(3);
    expect(report.produced).toEqual([{ itemId: 'pie', quantity: 3 }]);
    expect(harness.economy.stock('pie')).toBe(3);
  });

  it('later batches pay for their own inputs and stop when the shelf runs dry', () => {
    const harness = shop({
      goods: [{ ...SHOP.goods[0]!, stock: 4, capacity: 20 }, { ...SHOP.goods[1]!, capacity: 20 }],
    });
    harness.production.start('bake-pie'); // takes 3, leaving 1
    harness.economy.save();
    harness.clock.advance(50_000);
    const report = harness.economy.resume();
    expect(report.jobsCompleted).toBe(1); // only the in-flight batch could be paid for
    expect(harness.economy.stock('apple')).toBe(1);
  });

  it('clamps a long absence to the authored maximum and says so', () => {
    const harness = shop({
      goods: [{ ...SHOP.goods[0]!, stock: 20, capacity: 20 }, { ...SHOP.goods[1]!, capacity: 20 }],
    });
    harness.production.start('bake-pie');
    harness.economy.save();
    harness.clock.advance(10_000_000);
    const report = harness.economy.resume();
    expect(report.requestedMs).toBe(10_000_000);
    expect(report.appliedMs).toBe(60_000); // the authored cap
    expect(report.clamped).toBe(true);
  });

  it('a clock that moved backwards credits nothing', () => {
    const harness = shop();
    harness.production.start('bake-pie');
    harness.economy.save();
    harness.clock.advance(-500_000);
    const report = harness.economy.resume();
    expect(report.appliedMs).toBe(0);
    expect(report.jobsCompleted).toBe(0);
    expect(harness.economy.stock('pie')).toBe(0);
  });

  it('offline efficiency scales what an absence produces', () => {
    const overrides = {
      goods: [{ ...SHOP.goods[0]!, stock: 20, capacity: 20 }, { ...SHOP.goods[1]!, capacity: 20 }],
      offline: { maximumMs: 60_000, efficiency: 0.5 },
    };
    const harness = shop(overrides);
    harness.production.start('bake-pie');
    harness.economy.save();
    harness.clock.advance(4000); // 2000ms credited at 50%
    expect(harness.economy.resume().jobsCompleted).toBe(2);
  });

  it('restores stock, prestige level and in-flight jobs across a resume', () => {
    const harness = shop();
    harness.economy.transact({ itemId: 'apple', quantity: 4, side: 'sell', buyerFunds: 100 });
    const started = harness.production.start('bake-pie');
    harness.economy.save();

    const restored = shop();
    restored.saves.save('economy', JSON.parse(JSON.stringify(readSlot(harness))));
    const report = restored.economy.resume();
    expect(report.appliedMs).toBe(0);
    expect(restored.economy.stock('apple')).toBe(3); // 10 - 4 sold - 3 consumed
    expect(restored.production.jobs().map((job) => job.id)).toEqual([started.jobId]);
  });

  it('a restored job does not consume its inputs a second time', () => {
    const harness = shop();
    harness.production.start('bake-pie');
    harness.economy.save();
    const before = harness.economy.stock('apple');
    harness.economy.resume();
    expect(harness.economy.stock('apple')).toBe(before);
  });

  it('catchUp with no running jobs is a no-op that still reports the elapsed time', () => {
    const { production } = shop();
    const report = production.catchUp(5000);
    expect(report.appliedMs).toBe(5000);
    expect(report.jobsCompleted).toBe(0);
    expect(report.produced).toEqual([]);
  });
});

/** Read back what a harness wrote, so a second harness can resume from it. */
function readSlot(harness: Harness): unknown {
  return harness.saves.load('economy', {
    currentVersion: 1,
    createDefault: () => ({ schemaVersion: 1 }) as VersionedRecord,
  }).value;
}

describe('prestige', () => {
  it('is not eligible until the authored condition holds, and says what blocks it', () => {
    const { economy } = shop({}, { currency: 0 });
    expect(economy.prestigeState()).toMatchObject({
      level: 0,
      multiplier: 1,
      eligible: false,
      blockedBy: 'lifetime-earnings-at-least',
    });
    expect(economy.performPrestige().reason).toBe('not-eligible');
  });

  it('lifetime earnings count sales only, and are never reset by a prestige', () => {
    const { economy } = shop({}, { currency: 200 });
    economy.transact({ itemId: 'apple', quantity: 10, side: 'sell', buyerFunds: 500 }); // 50 earned
    expect(economy.prestigeState().lifetimeEarnings).toBe(50);
    economy.performPrestige();
    expect(economy.prestigeState().lifetimeEarnings).toBe(50);
  });

  it('resets the authored scopes, grants the reward after the reset, and raises the multiplier', () => {
    const harness = shop({}, { currency: 200 });
    harness.economy.transact({ itemId: 'apple', quantity: 10, side: 'sell', buyerFunds: 500 });
    harness.production.start('bake-pie');
    const result = harness.economy.performPrestige();

    expect(result.ok).toBe(true);
    expect(result.level).toBe(1);
    expect(result.multiplier).toBe(2);
    expect(harness.economy.stock('apple')).toBe(10); // goods-stock reset to authored
    expect(harness.production.jobs()).toHaveLength(0); // production-jobs wiped
    // currency was wiped, then the reward was granted - so the reward survives.
    expect(harness.economy.funds()).toBe(30);
    expect(harness.progression.isUnlocked('franchised')).toBe(true);
  });

  it('the multiplier makes production genuinely faster', () => {
    const harness = shop({}, { currency: 200 });
    harness.economy.transact({ itemId: 'apple', quantity: 10, side: 'sell', buyerFunds: 500 });
    harness.economy.performPrestige();
    harness.production.start('bake-pie'); // 1000ms at 2x
    step(harness, 500);
    expect(harness.economy.stock('pie')).toBe(1);
  });

  it('a retained scope is not reset', () => {
    const harness = shop(
      {
        prestige: [
          {
            id: 'franchise',
            eligibility: { kind: 'lifetime-earnings-at-least', amount: 10 },
            resetScopes: ['goods-stock', 'currency'],
            retainScopes: ['currency'],
          },
        ],
      },
      { currency: 200 },
    );
    harness.economy.transact({ itemId: 'apple', quantity: 4, side: 'sell', buyerFunds: 500 });
    const fundsBefore = harness.economy.funds();
    const result = harness.economy.performPrestige();
    expect(result.resetScopes).toEqual(['goods-stock']);
    expect(harness.economy.funds()).toBe(fundsBefore);
  });

  it('names an unknown prestige definition', () => {
    const { economy } = shop();
    expect(economy.performPrestige('nope').reason).toBe('unknown-definition');
  });

  it('reports no-prestige-defined when the document declares none', () => {
    const { economy } = shop({ prestige: [] });
    expect(economy.prestigeState().blockedBy).toBe('no-prestige-defined');
  });

  it('a prestige-gated recipe unlocks at the required level', () => {
    const harness = shop(
      {
        recipes: [
          { ...SHOP.recipes![0]!, unlock: [{ kind: 'prestige-at-least', level: 1 }] },
        ],
      },
      { currency: 200 },
    );
    expect(harness.production.isUnlocked('bake-pie')).toBe(false);
    harness.economy.transact({ itemId: 'apple', quantity: 10, side: 'sell', buyerFunds: 500 });
    harness.economy.performPrestige();
    expect(harness.production.isUnlocked('bake-pie')).toBe(true);
  });
});

describe('single-owner frame advancement', () => {
  it('neither service exposes update(), so a consumer cannot double-step the simulation', () => {
    const { economy, production } = shop();
    expect((economy as unknown as Record<string, unknown>)['update']).toBeUndefined();
    expect((production as unknown as Record<string, unknown>)['update']).toBeUndefined();
  });

  it('drainEvents empties, so an observer never sees the same event twice', () => {
    const { economy, update } = shop();
    economy.spawnCustomer('regular', { id: 'c1' });
    update(100);
    expect(economy.drainEvents().length).toBeGreaterThan(0);
    expect(economy.drainEvents()).toHaveLength(0);
  });
});

describe('reset', () => {
  it('returns goods, jobs, customers, queues and prestige to their authored start', () => {
    const harness = shop({}, { currency: 200 });
    harness.economy.transact({ itemId: 'apple', quantity: 5, side: 'sell', buyerFunds: 500 });
    harness.production.start('bake-pie');
    harness.production.place('oven-1', 10, 5);
    harness.economy.spawnCustomer('regular', { id: 'c1' });
    step(harness, 300);

    harness.economy.reset();
    expect(harness.economy.stock('apple')).toBe(10);
    expect(harness.production.jobs()).toHaveLength(0);
    expect(harness.economy.customers()).toHaveLength(0);
    expect(harness.economy.queues()[0]!.waiting).toHaveLength(0);
    expect(harness.production.stations()[0]!.position).toBeNull();
    expect(harness.economy.prestigeState().lifetimeEarnings).toBe(0);
    expect(harness.economy.drainEvents()).toHaveLength(0);
  });
});

describe('bus events', () => {
  it('emits economy and production events onto the game bus', () => {
    const context = createContext(SHOP);
    progressionPack.install(context, { startingCurrency: 100 });
    const installed = economyPack.install(context, {});
    const economy = context.capabilities.require<EconomyService>('simulation.economy');
    const production = context.capabilities.require<ProductionService>('simulation.production');

    const seen: string[] = [];
    context.events.on('economy:transaction', () => seen.push('transaction'));
    context.events.on('production:jobCompleted', () => seen.push('jobCompleted'));
    context.events.on('economy:prestige', () => seen.push('prestige'));

    // Start the job first: it consumes 3 apples, and selling the shelf empty
    // beforehand would leave nothing to bake with.
    production.start('bake-pie');
    economy.setDemandMultiplier('apple', 2);
    economy.transact({ itemId: 'apple', quantity: 7, side: 'sell', buyerFunds: 500 }); // 70 earned
    installed.update!(1000);
    economy.performPrestige();

    expect(seen).toEqual(['transaction', 'jobCompleted', 'prestige']);
    installed.dispose();
  });
});
