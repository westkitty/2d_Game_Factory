import { describe, expect, it } from 'vitest';
import {
  DEFAULT_FOOTPRINT,
  InvalidEconomyDocumentError,
  ManualWallClock,
  chooseTarget,
  createRng,
  evaluatePlacement,
  evaluateTransaction,
  evaluateUnlock,
  footprintRect,
  goodState,
  hasInputs,
  isPrestigeEligible,
  offlineElapsedMs,
  pickArchetype,
  pointInRect,
  prestigeMultiplier,
  priceInCurrency,
  rectContains,
  rectsOverlap,
  validateEconomyDocument,
  type CustomerArchetype,
  type EconomyDocument,
  type GoodDefinition,
  type PlacementZone,
  type RecipeDefinition,
  type StationDefinition,
} from '../src/index.ts';

const APPLE: GoodDefinition = { itemId: 'apple', stock: 10, capacity: 20, buyPrice: 2, sellPrice: 5 };
const BREAD: GoodDefinition = { itemId: 'bread', stock: 4, capacity: 10, buyPrice: 3, sellPrice: 9 };

function document(overrides: Partial<EconomyDocument> = {}): EconomyDocument {
  return { schemaVersion: 1, goods: [APPLE, BREAD], ...overrides };
}

describe('priceInCurrency', () => {
  it('rounds to whole currency because a balance cannot hold a fraction', () => {
    expect(priceInCurrency(5, 1.5)).toBe(8); // 7.5 rounds up
    expect(priceInCurrency(5, 0.9)).toBe(5); // 4.5 rounds up (banker-free Math.round)
    expect(priceInCurrency(3, 1)).toBe(3);
  });

  it('never returns a negative or non-finite price', () => {
    expect(priceInCurrency(-5)).toBe(0);
    expect(priceInCurrency(Number.NaN, 2)).toBe(0);
    expect(priceInCurrency(5, Number.POSITIVE_INFINITY)).toBe(0);
  });
});

describe('goodState', () => {
  it('applies demand to the sell price only - a supplier does not care about demand', () => {
    const state = goodState({ ...APPLE, demandMultiplier: 2 }, 7);
    expect(state.unitSellPrice).toBe(10);
    expect(state.unitBuyPrice).toBe(2);
    expect(state.stock).toBe(7);
  });

  it('defaults demand to 1 and restockQuantity to 1', () => {
    const state = goodState(APPLE, 10);
    expect(state.demandMultiplier).toBe(1);
    expect(state.restockQuantity).toBe(1);
  });
});

describe('evaluateTransaction', () => {
  const apple = goodState(APPLE, 10);

  it('names an unknown good rather than silently doing nothing', () => {
    expect(evaluateTransaction(undefined, { itemId: 'x', quantity: 1, side: 'sell' }, 100).reason).toBe(
      'unknown-good',
    );
  });

  it('rejects a non-positive or fractional quantity', () => {
    for (const quantity of [0, -3, 1.5]) {
      expect(evaluateTransaction(apple, { itemId: 'apple', quantity, side: 'sell' }, 100).reason).toBe(
        'invalid-quantity',
      );
    }
  });

  it('refuses a sell beyond stock', () => {
    const result = evaluateTransaction(apple, { itemId: 'apple', quantity: 11, side: 'sell', buyerFunds: 999 }, 0);
    expect(result.reason).toBe('insufficient-stock');
  });

  it('refuses a sell the buyer cannot pay for, and reports the price it could not meet', () => {
    const result = evaluateTransaction(apple, { itemId: 'apple', quantity: 3, side: 'sell', buyerFunds: 14 }, 0);
    expect(result.reason).toBe('insufficient-funds');
    expect(result.total).toBe(15);
  });

  it('a sell with no buyer purse supplied is treated as a buyer with nothing', () => {
    expect(evaluateTransaction(apple, { itemId: 'apple', quantity: 1, side: 'sell' }, 999).reason).toBe(
      'insufficient-funds',
    );
  });

  it('allows an exactly affordable sell', () => {
    const result = evaluateTransaction(apple, { itemId: 'apple', quantity: 3, side: 'sell', buyerFunds: 15 }, 0);
    expect(result.reason).toBeUndefined();
    expect(result.unitPrice).toBe(5);
  });

  it('refuses a restock that would overflow the shelf, before checking funds', () => {
    const result = evaluateTransaction(apple, { itemId: 'apple', quantity: 11, side: 'restock' }, 0);
    expect(result.reason).toBe('insufficient-capacity');
  });

  it('refuses a restock the shop cannot pay for', () => {
    const result = evaluateTransaction(apple, { itemId: 'apple', quantity: 5, side: 'restock' }, 9);
    expect(result.reason).toBe('insufficient-funds');
    expect(result.total).toBe(10);
  });

  it('prices a restock at the buy price, not the sell price', () => {
    const result = evaluateTransaction(apple, { itemId: 'apple', quantity: 2, side: 'restock' }, 100);
    expect(result.unitPrice).toBe(2);
    expect(result.total).toBe(4);
  });
});

describe('hasInputs', () => {
  const recipe: RecipeDefinition = {
    id: 'bake',
    inputs: [{ itemId: 'apple', quantity: 2 }],
    outputs: [{ itemId: 'bread', quantity: 1 }],
    durationMs: 1000,
    stationType: 'oven',
  };

  it('accounts for the batch size, not just the per-unit input', () => {
    const stock = (id: string) => (id === 'apple' ? 5 : 0);
    expect(hasInputs(recipe, stock)).toBe(true);
    expect(hasInputs({ ...recipe, batchSize: 2 }, stock)).toBe(true); // needs 4
    expect(hasInputs({ ...recipe, batchSize: 3 }, stock)).toBe(false); // needs 6
  });
});

describe('evaluateUnlock', () => {
  const world = { hasFlag: (flag: string) => flag === 'shop-open', stockOf: () => 5, prestigeLevel: 2 };

  it('an absent or empty condition list is unlocked', () => {
    expect(evaluateUnlock(undefined, world)).toBe(true);
    expect(evaluateUnlock([], world)).toBe(true);
  });

  it('every condition must hold, not just one', () => {
    expect(evaluateUnlock([{ kind: 'flag', flag: 'shop-open' }], world)).toBe(true);
    expect(
      evaluateUnlock(
        [
          { kind: 'flag', flag: 'shop-open' },
          { kind: 'prestige-at-least', level: 3 },
        ],
        world,
      ),
    ).toBe(false);
  });

  it('reads stock and prestige level', () => {
    expect(evaluateUnlock([{ kind: 'stock-at-least', itemId: 'apple', quantity: 5 }], world)).toBe(true);
    expect(evaluateUnlock([{ kind: 'stock-at-least', itemId: 'apple', quantity: 6 }], world)).toBe(false);
    expect(evaluateUnlock([{ kind: 'prestige-at-least', level: 2 }], world)).toBe(true);
  });
});

describe('placement geometry', () => {
  it('centres a footprint on its position', () => {
    expect(footprintRect({ x: 10, y: 10 }, { width: 4, height: 2 })).toEqual({ x: 8, y: 9, width: 4, height: 2 });
  });

  it('defaults to a 1x1 footprint', () => {
    expect(footprintRect({ x: 0, y: 0 })).toEqual(footprintRect({ x: 0, y: 0 }, DEFAULT_FOOTPRINT));
  });

  it('containment is inclusive of the boundary', () => {
    const outer = { x: 0, y: 0, width: 10, height: 10 };
    expect(rectContains(outer, { x: 0, y: 0, width: 10, height: 10 })).toBe(true);
    expect(rectContains(outer, { x: 0, y: 0, width: 10.1, height: 10 })).toBe(false);
  });

  it('touching edges do not overlap, so stations may sit flush', () => {
    expect(rectsOverlap({ x: 0, y: 0, width: 2, height: 2 }, { x: 2, y: 0, width: 2, height: 2 })).toBe(false);
    expect(rectsOverlap({ x: 0, y: 0, width: 2, height: 2 }, { x: 1.9, y: 0, width: 2, height: 2 })).toBe(true);
  });

  it('a point on a rect edge is inside it', () => {
    expect(pointInRect({ x: 10, y: 0 }, { x: 0, y: 0, width: 10, height: 10 })).toBe(true);
    expect(pointInRect({ x: 10.1, y: 0 }, { x: 0, y: 0, width: 10, height: 10 })).toBe(false);
  });
});

describe('evaluatePlacement', () => {
  const zones: readonly PlacementZone[] = [
    { id: 'floor', kind: 'buildable', x: 0, y: 0, width: 20, height: 10 },
    { id: 'walkway', kind: 'aisle', x: 0, y: 10, width: 20, height: 4 },
  ];
  const counter: StationDefinition = {
    id: 'counter',
    type: 'counter',
    capacity: 1,
    footprint: { width: 4, height: 2 },
  };

  it('accepts a station wholly inside a buildable zone', () => {
    expect(evaluatePlacement(counter, { x: 10, y: 5 }, zones, [])).toBeUndefined();
  });

  it('refuses a station that hangs over the zone edge', () => {
    expect(evaluatePlacement(counter, { x: 19, y: 5 }, zones, [])).toBe('outside-zone');
  });

  it('a station straddling two buildable zones is refused - it must fit inside one', () => {
    const split: readonly PlacementZone[] = [
      { id: 'a', kind: 'buildable', x: 0, y: 0, width: 10, height: 10 },
      { id: 'b', kind: 'buildable', x: 10, y: 0, width: 10, height: 10 },
    ];
    expect(evaluatePlacement(counter, { x: 10, y: 5 }, split, [])).toBe('outside-zone');
  });

  it('refuses an overlap with a placed station', () => {
    const occupied = [footprintRect({ x: 11, y: 5 }, { width: 4, height: 2 })];
    expect(evaluatePlacement(counter, { x: 10, y: 5 }, zones, occupied)).toBe('overlaps-station');
  });

  it('an access point outside every aisle is inaccessible', () => {
    const reachable: StationDefinition = { ...counter, accessOffset: { x: 0, y: 6 } };
    expect(evaluatePlacement(reachable, { x: 10, y: 5 }, zones, [])).toBeUndefined();
    const unreachable: StationDefinition = { ...counter, accessOffset: { x: 0, y: -4 } };
    expect(evaluatePlacement(unreachable, { x: 10, y: 5 }, zones, [])).toBe('inaccessible');
  });

  it('a station with no access offset is never inaccessible', () => {
    expect(evaluatePlacement(counter, { x: 10, y: 5 }, [zones[0]!], [])).toBeUndefined();
  });
});

describe('chooseTarget', () => {
  const shopper: CustomerArchetype = {
    id: 'shopper',
    budget: 100,
    patienceMs: 5000,
    demandWeights: { apple: 3, bread: 5 },
    arrivalWeight: 1,
  };
  const goods = [goodState(APPLE, 10), goodState(BREAD, 4)];

  it('picks the highest demand weight among affordable, in-stock goods', () => {
    const choice = chooseTarget(shopper, 100, goods);
    expect(choice).toEqual({ itemId: 'bread', quantity: 1 });
  });

  it('falls through to a lower-weighted good when the favourite is out of stock', () => {
    const choice = chooseTarget(shopper, 100, [goodState(APPLE, 10), goodState(BREAD, 0)]);
    expect(choice).toEqual({ itemId: 'apple', quantity: 1 });
  });

  it('reports out-of-stock rather than picking something the customer never wanted', () => {
    const choice = chooseTarget(shopper, 100, [goodState(APPLE, 0), goodState(BREAD, 0)]);
    expect(choice).toEqual({ reason: 'out-of-stock' });
  });

  it('distinguishes unaffordable from out-of-stock', () => {
    expect(chooseTarget(shopper, 2, goods)).toEqual({ reason: 'unaffordable' });
  });

  it('a customer who wants nothing on the shelf is out-of-stock, not unaffordable', () => {
    const picky: CustomerArchetype = { ...shopper, demandWeights: { cheese: 1 } };
    expect(chooseTarget(picky, 100, goods)).toEqual({ reason: 'out-of-stock' });
  });

  it('buys up to maxQuantity, bounded by stock and by the purse', () => {
    const bulk: CustomerArchetype = { ...shopper, maxQuantity: 5, demandWeights: { apple: 1 } };
    expect(chooseTarget(bulk, 100, goods)).toEqual({ itemId: 'apple', quantity: 5 });
    expect(chooseTarget(bulk, 12, goods)).toEqual({ itemId: 'apple', quantity: 2 }); // 12/5 = 2
    expect(chooseTarget(bulk, 100, [goodState(APPLE, 3)])).toEqual({ itemId: 'apple', quantity: 3 });
  });

  it('breaks equal demand weights on ascending item id, so the choice is reproducible', () => {
    const even: CustomerArchetype = { ...shopper, demandWeights: { apple: 4, bread: 4 } };
    expect(chooseTarget(even, 100, goods)).toEqual({ itemId: 'apple', quantity: 1 });
  });
});

describe('pickArchetype', () => {
  const archetypes: CustomerArchetype[] = [
    { id: 'a', budget: 10, patienceMs: 1000, demandWeights: { apple: 1 }, arrivalWeight: 1 },
    { id: 'b', budget: 10, patienceMs: 1000, demandWeights: { apple: 1 }, arrivalWeight: 3 },
  ];

  it('is deterministic for a given seed', () => {
    const first = Array.from({ length: 12 }, (_, index) => index).map(() => undefined);
    const rngA = createRng(42);
    const rngB = createRng(42);
    const drawsA = first.map(() => pickArchetype(archetypes, rngA)?.id);
    const drawsB = first.map(() => pickArchetype(archetypes, rngB)?.id);
    expect(drawsA).toEqual(drawsB);
  });

  it('respects the weights across many draws', () => {
    const rng = createRng(7);
    const draws = Array.from({ length: 400 }, () => pickArchetype(archetypes, rng)!.id);
    const bs = draws.filter((id) => id === 'b').length;
    expect(bs).toBeGreaterThan(240); // ~75% expected
    expect(bs).toBeLessThan(360);
  });

  it('ignores zero-weight archetypes and returns undefined when none are eligible', () => {
    const rng = createRng(1);
    expect(pickArchetype([{ ...archetypes[0]!, arrivalWeight: 0 }], rng)).toBeUndefined();
    expect(pickArchetype([], rng)).toBeUndefined();
  });
});

describe('offlineElapsedMs', () => {
  it('credits the real absence when it is under the cap', () => {
    expect(offlineElapsedMs(5000, 1000, 10_000)).toBe(4000);
  });

  it('clamps a long absence to the cap', () => {
    expect(offlineElapsedMs(1_000_000, 0, 10_000)).toBe(10_000);
  });

  it('credits nothing for a clock that moved backwards', () => {
    expect(offlineElapsedMs(1000, 5000, 10_000)).toBe(0);
  });

  it('credits nothing for a zero absence or a non-finite clock', () => {
    expect(offlineElapsedMs(1000, 1000, 10_000)).toBe(0);
    expect(offlineElapsedMs(Number.NaN, 0, 10_000)).toBe(0);
    expect(offlineElapsedMs(1000, Number.NaN, 10_000)).toBe(0);
  });

  it('a zero or negative cap credits nothing however long the absence', () => {
    expect(offlineElapsedMs(1_000_000, 0, 0)).toBe(0);
    expect(offlineElapsedMs(1_000_000, 0, -5)).toBe(0);
  });
});

describe('ManualWallClock', () => {
  it('moves only when told to', () => {
    const clock = new ManualWallClock(1000);
    expect(clock.now()).toBe(1000);
    clock.advance(500);
    expect(clock.now()).toBe(1500);
    clock.set(10);
    expect(clock.now()).toBe(10);
  });
});

describe('prestige', () => {
  it('the multiplier is 1 at level 0 and grows linearly', () => {
    expect(prestigeMultiplier(0, 0.5)).toBe(1);
    expect(prestigeMultiplier(2, 0.5)).toBe(2);
    expect(prestigeMultiplier(3, undefined)).toBe(1);
  });

  it('reads each eligibility kind from the world it is given', () => {
    const world = {
      lifetimeEarnings: 500,
      stockOf: (id: string) => (id === 'apple' ? 10 : 0),
      hasFlag: (flag: string) => flag === 'ready',
    };
    expect(isPrestigeEligible({ kind: 'lifetime-earnings-at-least', amount: 500 }, world)).toBe(true);
    expect(isPrestigeEligible({ kind: 'lifetime-earnings-at-least', amount: 501 }, world)).toBe(false);
    expect(isPrestigeEligible({ kind: 'stock-at-least', itemId: 'apple', quantity: 10 }, world)).toBe(true);
    expect(isPrestigeEligible({ kind: 'stock-at-least', itemId: 'bread', quantity: 1 }, world)).toBe(false);
    expect(isPrestigeEligible({ kind: 'flag', flag: 'ready' }, world)).toBe(true);
    expect(isPrestigeEligible({ kind: 'flag', flag: 'nope' }, world)).toBe(false);
  });
});

describe('validateEconomyDocument', () => {
  const expectFail = (doc: EconomyDocument, fragment: string): void => {
    expect(() => validateEconomyDocument(doc)).toThrow(InvalidEconomyDocumentError);
    expect(() => validateEconomyDocument(doc)).toThrow(fragment);
  };

  it('accepts a minimal document', () => {
    expect(() => validateEconomyDocument(document())).not.toThrow();
  });

  it('rejects a duplicate good', () => {
    expectFail(document({ goods: [APPLE, APPLE] }), 'defined more than once');
  });

  it('rejects starting stock above capacity', () => {
    expectFail(document({ goods: [{ ...APPLE, stock: 50 }] }), 'capacity is 20');
  });

  it('rejects a recipe whose station type nothing provides', () => {
    expectFail(
      document({
        recipes: [
          { id: 'bake', inputs: [], outputs: [{ itemId: 'bread', quantity: 1 }], durationMs: 100, stationType: 'oven' },
        ],
      }),
      'no station of that type',
    );
  });

  it('rejects a recipe referencing an item that is not a good', () => {
    expectFail(
      document({
        stations: [{ id: 'oven-1', type: 'oven', capacity: 1 }],
        recipes: [
          { id: 'bake', inputs: [], outputs: [{ itemId: 'cake', quantity: 1 }], durationMs: 100, stationType: 'oven' },
        ],
      }),
      'not a defined good',
    );
  });

  it('rejects a recipe that produces nothing', () => {
    expectFail(
      document({
        stations: [{ id: 'oven-1', type: 'oven', capacity: 1 }],
        recipes: [{ id: 'bake', inputs: [], outputs: [], durationMs: 100, stationType: 'oven' }],
      }),
      'produces nothing',
    );
  });

  it('rejects a customer who wants an item that is not a good', () => {
    expectFail(
      document({
        queues: [{ id: 'till', capacity: 4, serviceSlots: 1, serviceMs: 500 }],
        customers: [
          { id: 'shopper', budget: 10, patienceMs: 1000, demandWeights: { cake: 1 }, arrivalWeight: 1 },
        ],
      }),
      'not a defined good',
    );
  });

  it('rejects customers with nowhere to wait', () => {
    expectFail(
      document({
        customers: [
          { id: 'shopper', budget: 10, patienceMs: 1000, demandWeights: { apple: 1 }, arrivalWeight: 1 },
        ],
      }),
      'nowhere to wait',
    );
  });

  it('rejects an offline efficiency outside 0..1', () => {
    expectFail(document({ offline: { maximumMs: 1000, efficiency: 1.5 } }), 'between 0 and 1');
  });

  it('rejects a prestige that retains every scope it resets, because it would do nothing', () => {
    expectFail(
      document({
        prestige: [
          {
            id: 'reborn',
            eligibility: { kind: 'lifetime-earnings-at-least', amount: 10 },
            resetScopes: ['goods-stock', 'currency'],
            retainScopes: ['goods-stock', 'currency'],
          },
        ],
      }),
      'would do nothing',
    );
  });

  it('rejects a prestige gated on an item that is not a good', () => {
    expectFail(
      document({
        prestige: [
          {
            id: 'reborn',
            eligibility: { kind: 'stock-at-least', itemId: 'cake', quantity: 1 },
            resetScopes: ['goods-stock'],
          },
        ],
      }),
      'not a defined good',
    );
  });

  it('accepts a full document with every section populated', () => {
    expect(() =>
      validateEconomyDocument(
        document({
          stations: [{ id: 'oven-1', type: 'oven', capacity: 2 }],
          recipes: [
            {
              id: 'bake',
              inputs: [{ itemId: 'apple', quantity: 2 }],
              outputs: [{ itemId: 'bread', quantity: 1 }],
              durationMs: 1000,
              stationType: 'oven',
              unlock: [{ kind: 'stock-at-least', itemId: 'apple', quantity: 1 }],
            },
          ],
          zones: [{ id: 'floor', kind: 'buildable', x: 0, y: 0, width: 10, height: 10 }],
          queues: [{ id: 'till', capacity: 4, serviceSlots: 1, serviceMs: 500, navigateMs: 250 }],
          customers: [
            { id: 'shopper', budget: 50, patienceMs: 4000, demandWeights: { bread: 2 }, arrivalWeight: 1 },
          ],
          arrival: { intervalMs: 1000, maxConcurrent: 3 },
          offline: { maximumMs: 60_000, efficiency: 0.5 },
          prestige: [
            {
              id: 'reborn',
              eligibility: { kind: 'lifetime-earnings-at-least', amount: 100 },
              resetScopes: ['goods-stock', 'currency'],
              retainScopes: ['currency'],
              rewardCurrency: 25,
              multiplierPerLevel: 0.5,
            },
          ],
        }),
      ),
    ).not.toThrow();
  });
});
