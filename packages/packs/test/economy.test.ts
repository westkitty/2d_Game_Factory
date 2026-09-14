import { describe, expect, it } from 'vitest';
import { validateContentBundleData } from '@sw2d/schemas';
import type { EconomyCatalog, EconomyService, GameContext } from '@sw2d/contracts';
import { ECONOMY_CAPABILITY_ID } from '@sw2d/contracts';
import { CAPABILITY_IDS } from '../src/ids.ts';
import { economyPack } from '../src/economy/economyPack.ts';
import { FakeCapabilityRegistry, FakeEventBus } from './testSupport.ts';

const SHOP: EconomyCatalog = {
  schemaVersion: 1,
  mode: 'shop',
  cash: 10,
  goods: [
    { id: 'apple', displayName: 'Apple', price: 5, restockCost: 2, stock: 1 },
    { id: 'bread', displayName: 'Bread', price: 8, restockCost: 4, stock: 0 },
  ],
  demand: [
    { id: 'pat', displayName: 'Pat', goodId: 'apple', patienceMs: 5000 },
    { id: 'sam', displayName: 'Sam', goodId: 'bread', patienceMs: 5000 },
  ],
  spawn: { firstDelayMs: 100, intervalMs: 1000, maxQueue: 2 },
};

const KITCHEN: EconomyCatalog = {
  schemaVersion: 1,
  mode: 'kitchen',
  cash: 0,
  goods: [{ id: 'soup', displayName: 'Soup', price: 12, stock: 0 }],
  recipes: [{ id: 'cook-soup', displayName: 'Cook soup', outputGoodId: 'soup', outputCount: 1, durationMs: 200 }],
  demand: [{ id: 'diner', displayName: 'Diner', goodId: 'soup', patienceMs: 8000 }],
  spawn: { firstDelayMs: 50, intervalMs: 2000, maxQueue: 1 },
};

const FACTORY: EconomyCatalog = {
  schemaVersion: 1,
  mode: 'factory',
  cash: 0,
  autoSell: true,
  goods: [{ id: 'widget', displayName: 'Widget', price: 6, stock: 0 }],
  recipes: [{ id: 'make-widget', displayName: 'Stamp', outputGoodId: 'widget', outputCount: 1, durationMs: 100 }],
  demand: [{ id: 'buyer', displayName: 'Buyer', goodId: 'widget', patienceMs: 8000 }],
  spawn: { firstDelayMs: 50, intervalMs: 200, maxQueue: 2 },
};

describe('sw2d.economy - ids', () => {
  it('the contracts-exported capability id matches the packs CAPABILITY_IDS entry', () => {
    expect(ECONOMY_CAPABILITY_ID).toBe(CAPABILITY_IDS.economy);
    expect(economyPack.provides).toEqual([ECONOMY_CAPABILITY_ID]);
  });
});

describe('sw2d.economy - schema', () => {
  it('accepts a valid shop catalog', () => {
    expect(() => validateContentBundleData({ economy: SHOP })).not.toThrow();
  });

  it('rejects an unknown mode', () => {
    const bad = { ...SHOP, mode: 'bazaar' };
    expect(() => validateContentBundleData({ economy: bad })).toThrow();
  });

  it('rejects a negative stock', () => {
    const bad = { ...SHOP, goods: [{ id: 'x', displayName: 'X', price: 1, stock: -1 }] };
    expect(() => validateContentBundleData({ economy: bad })).toThrow();
  });
});

describe('sw2d.economy - shop loop', () => {
  it('spawns Pat after firstDelay, serving apple spends stock and pays cash', () => {
    const events = new FakeEventBus();
    const capabilities = new FakeCapabilityRegistry();
    const ctx = {
      events,
      capabilities,
      content: { data: { economy: { schemaId: 'x', valid: true, value: SHOP } } },
    } as unknown as GameContext;
    const installed = economyPack.install(ctx, undefined);
    const economy = capabilities.require<EconomyService>(ECONOMY_CAPABILITY_ID);

    expect(economy.queue()).toEqual([]);
    installed.update?.(50);
    expect(economy.queue()).toEqual([]);
    installed.update?.(60); // 110ms >= 100 firstDelay
    expect(economy.queue()).toHaveLength(1);
    expect(economy.queue()[0]?.goodId).toBe('apple');
    expect(economy.queue()[0]?.displayName).toBe('Pat');

    expect(economy.serve().reason).toBe('served');
    expect(economy.cash()).toBe(15);
    expect(economy.stock('apple')).toBe(0);
    expect(economy.served()).toBe(1);
    expect(economy.queue()).toHaveLength(0);
  });

  it('wrong-good is rejected and does not spend stock', () => {
    const events = new FakeEventBus();
    const capabilities = new FakeCapabilityRegistry();
    const ctx = {
      events,
      capabilities,
      content: { data: { economy: { schemaId: 'x', valid: true, value: SHOP } } },
    } as unknown as GameContext;
    const installed = economyPack.install(ctx, undefined);
    const economy = capabilities.require<EconomyService>(ECONOMY_CAPABILITY_ID);
    installed.update?.(150);
    economy.selectByDelta(1); // bread
    expect(economy.serve()).toEqual({ ok: false, reason: 'wrong-good', customerId: 'c-1', goodId: 'bread' });
    expect(economy.stock('apple')).toBe(1);
    expect(economy.served()).toBe(0);
  });

  it('restock spends cash and increments stock; cannot-afford is reported', () => {
    const events = new FakeEventBus();
    const capabilities = new FakeCapabilityRegistry();
    const ctx = {
      events,
      capabilities,
      content: { data: { economy: { schemaId: 'x', valid: true, value: SHOP } } },
    } as unknown as GameContext;
    economyPack.install(ctx, undefined);
    const economy = capabilities.require<EconomyService>(ECONOMY_CAPABILITY_ID);
    economy.selectByDelta(1); // bread, restockCost 4
    expect(economy.secondary().reason).toBe('restocked');
    expect(economy.stock('bread')).toBe(1);
    expect(economy.cash()).toBe(6);
    // Drain cash
    economy.secondary(); // cash 2
    expect(economy.secondary().reason).toBe('cannot-afford');
  });

  it('an impatient customer leaves and increments lost, never served', () => {
    const events = new FakeEventBus();
    const capabilities = new FakeCapabilityRegistry();
    const catalog: EconomyCatalog = {
      ...SHOP,
      spawn: { firstDelayMs: 100, intervalMs: 60_000, maxQueue: 1 },
    };
    const ctx = {
      events,
      capabilities,
      content: { data: { economy: { schemaId: 'x', valid: true, value: catalog } } },
    } as unknown as GameContext;
    const installed = economyPack.install(ctx, undefined);
    const economy = capabilities.require<EconomyService>(ECONOMY_CAPABILITY_ID);
    installed.update?.(150);
    expect(economy.queue()).toHaveLength(1);
    installed.update?.(5000);
    expect(economy.queue()).toHaveLength(0);
    expect(economy.lost()).toBe(1);
    expect(economy.served()).toBe(0);
  });

  it('the second spawn is Sam wanting bread - demand cycles, no RNG', () => {
    const events = new FakeEventBus();
    const capabilities = new FakeCapabilityRegistry();
    const ctx = {
      events,
      capabilities,
      content: { data: { economy: { schemaId: 'x', valid: true, value: SHOP } } },
    } as unknown as GameContext;
    const installed = economyPack.install(ctx, undefined);
    const economy = capabilities.require<EconomyService>(ECONOMY_CAPABILITY_ID);
    installed.update?.(150); // Pat
    installed.update?.(1000); // Sam
    expect(economy.queue().map((c) => c.goodId)).toEqual(['apple', 'bread']);
  });
});

describe('sw2d.economy - kitchen', () => {
  it('serve fails until the recipe finishes, then succeeds', () => {
    const events = new FakeEventBus();
    const capabilities = new FakeCapabilityRegistry();
    const ctx = {
      events,
      capabilities,
      content: { data: { economy: { schemaId: 'x', valid: true, value: KITCHEN } } },
    } as unknown as GameContext;
    const installed = economyPack.install(ctx, undefined);
    const economy = capabilities.require<EconomyService>(ECONOMY_CAPABILITY_ID);
    installed.update?.(80);
    expect(economy.queue()).toHaveLength(1);
    expect(economy.serve().reason).toBe('no-stock');
    expect(economy.secondary().reason).toBe('produced-started');
    expect(economy.producing()?.recipeId).toBe('cook-soup');
    installed.update?.(100);
    expect(economy.stock('soup')).toBe(0);
    expect(economy.secondary().reason).toBe('already-producing');
    installed.update?.(120);
    expect(economy.stock('soup')).toBe(1);
    expect(economy.produced()).toBe(1);
    expect(economy.serve().reason).toBe('served');
    expect(economy.cash()).toBe(12);
    expect(economy.served()).toBe(1);
  });
});

describe('sw2d.economy - factory auto-sell', () => {
  it('a finished widget is sold to the waiting buyer without a serve() call', () => {
    const events = new FakeEventBus();
    const capabilities = new FakeCapabilityRegistry();
    const ctx = {
      events,
      capabilities,
      content: { data: { economy: { schemaId: 'x', valid: true, value: FACTORY } } },
    } as unknown as GameContext;
    const installed = economyPack.install(ctx, undefined);
    const economy = capabilities.require<EconomyService>(ECONOMY_CAPABILITY_ID);
    installed.update?.(80); // buyer arrives
    expect(economy.queue()).toHaveLength(1);
    expect(economy.secondary().reason).toBe('produced-started');
    installed.update?.(120); // recipe completes + auto-sell
    expect(economy.served()).toBe(1);
    expect(economy.cash()).toBe(6);
    expect(economy.stock('widget')).toBe(0);
    expect(economy.queue()).toHaveLength(0);
  });
});

describe('sw2d.economy - lifecycle', () => {
  it('withdraws its capability on dispose', () => {
    const events = new FakeEventBus();
    const capabilities = new FakeCapabilityRegistry();
    const ctx = {
      events,
      capabilities,
      content: { data: { economy: { schemaId: 'x', valid: true, value: SHOP } } },
    } as unknown as GameContext;
    const installed = economyPack.install(ctx, undefined);
    expect(capabilities.has(ECONOMY_CAPABILITY_ID)).toBe(true);
    installed.dispose();
    expect(capabilities.has(ECONOMY_CAPABILITY_ID)).toBe(false);
  });

  it('duplicate good ids throw at install', () => {
    const events = new FakeEventBus();
    const capabilities = new FakeCapabilityRegistry();
    const catalog: EconomyCatalog = {
      ...SHOP,
      goods: [
        { id: 'apple', displayName: 'Apple', price: 5, stock: 1 },
        { id: 'apple', displayName: 'Also apple', price: 3, stock: 1 },
      ],
    };
    const ctx = {
      events,
      capabilities,
      content: { data: { economy: { schemaId: 'x', valid: true, value: catalog } } },
    } as unknown as GameContext;
    expect(() => economyPack.install(ctx, undefined)).toThrow(/Duplicate economy good id/);
  });

  it('maxQueue caps spawn even when dt would catch up several intervals', () => {
    const events = new FakeEventBus();
    const capabilities = new FakeCapabilityRegistry();
    const catalog: EconomyCatalog = {
      ...SHOP,
      spawn: { firstDelayMs: 0, intervalMs: 50, maxQueue: 2 },
    };
    const ctx = {
      events,
      capabilities,
      content: { data: { economy: { schemaId: 'x', valid: true, value: catalog } } },
    } as unknown as GameContext;
    const installed = economyPack.install(ctx, undefined);
    const economy = capabilities.require<EconomyService>(ECONOMY_CAPABILITY_ID);
    installed.update?.(5000);
    expect(economy.queue()).toHaveLength(2);
  });

  it('a missing content/economy.json yields an inert shop, not an error', () => {
    const events = new FakeEventBus();
    const capabilities = new FakeCapabilityRegistry();
    const ctx = { events, capabilities, content: { data: {} } } as unknown as GameContext;
    const installed = economyPack.install(ctx, undefined);
    const economy = capabilities.require<EconomyService>(ECONOMY_CAPABILITY_ID);
    installed.update?.(1000);
    expect(economy.queue()).toEqual([]);
    expect(economy.serve().reason).toBe('no-customer');
    expect(economy.goods()).toEqual([]);
  });

  it('layout customers walk from the entrance before they become servable', () => {
    const events = new FakeEventBus();
    const capabilities = new FakeCapabilityRegistry();
    const catalog: EconomyCatalog = {
      ...SHOP,
      spawn: { firstDelayMs: 0, intervalMs: 1000, maxQueue: 1 },
      layout: {
        entrance: { x: 0, y: 0 },
        counter: { x: 100, y: 0 },
        exit: { x: 200, y: 0 },
        queueSlots: [{ x: 100, y: 0 }],
        walkSpeed: 100,
      },
    };
    const ctx = {
      events,
      capabilities,
      content: { data: { economy: { schemaId: 'x', valid: true, value: catalog } } },
    } as unknown as GameContext;
    const installed = economyPack.install(ctx, undefined);
    const economy = capabilities.require<EconomyService>(ECONOMY_CAPABILITY_ID);
    installed.update?.(10);
    expect(economy.queue()).toHaveLength(0);
    expect(economy.walkers()[0]?.phase).toBe('enter');
    expect(economy.walkers()[0]?.x).toBeGreaterThan(0);
    expect(economy.serve().reason).toBe('no-customer');
    installed.update?.(2000);
    expect(economy.queue()).toHaveLength(1);
    expect(economy.walkers()[0]?.phase).toBe('wait');
    economy.setPayMultiplier(2);
    expect(economy.serve().ok).toBe(true);
    expect(economy.cash()).toBe(20);
    expect(economy.walkers()[0]?.phase).toBe('leave');
  });
});
