import type {
  EconomyCatalog,
  EconomyDemand,
  EconomyGood,
  EconomyMode,
  EconomyProduction,
  EconomyRecipe,
  EconomySecondaryResult,
  EconomyServeResult,
  EconomyService,
  EventBus,
  GameContext,
  InstalledSystemPack,
  QueuedCustomer,
  SystemPackDefinition,
} from '@sw2d/contracts';
import { CAPABILITY_IDS, PACK_IDS } from '../ids.ts';

/**
 * Economy pack: stock, a demand queue, transaction settlement and production
 * jobs (Category-C Wave 1). Definitions come from validated
 * `content/economy.json`. No Phaser, no wall clock, no RNG - spawn order is
 * the authored demand list cycling by spawn index.
 *
 * Deliberately not folded into `sw2d.simulation`: that pack is a resource
 * ledger + timed-job primitive. This one owns customer/demand/transaction
 * semantics that three management recipes share.
 */

interface MutableGood {
  readonly id: string;
  readonly displayName: string;
  readonly price: number;
  readonly restockCost: number;
  stock: number;
}

interface MutableCustomer {
  readonly instanceId: string;
  readonly templateId: string;
  readonly displayName: string;
  readonly goodId: string;
  readonly pay: number;
  remainingMs: number;
}

class EconomyServiceImpl implements EconomyService {
  readonly #mode: EconomyMode;
  readonly #autoSell: boolean;
  #cash: number;
  readonly #goods: MutableGood[] = [];
  readonly #goodsById = new Map<string, MutableGood>();
  readonly #recipes: EconomyRecipe[] = [];
  readonly #recipesById = new Map<string, EconomyRecipe>();
  readonly #demand: EconomyDemand[] = [];
  readonly #spawn: { firstDelayMs: number; intervalMs: number; maxQueue: number };
  readonly #queue: MutableCustomer[] = [];
  readonly #events: EventBus;
  #served = 0;
  #lost = 0;
  #produced = 0;
  #selected = 0;
  #spawned = 0;
  #untilNextSpawnMs: number;
  #production: { recipeId: string; remainingMs: number; totalMs: number } | null = null;
  #lastResult: string | null = null;

  constructor(events: EventBus, catalog: EconomyCatalog | undefined) {
    this.#events = events;
    this.#mode = catalog?.mode ?? 'shop';
    this.#autoSell = catalog?.autoSell === true;
    this.#cash = catalog?.cash ?? 0;
    this.#spawn = catalog?.spawn ?? { firstDelayMs: 0, intervalMs: 1000, maxQueue: 0 };
    this.#untilNextSpawnMs = this.#spawn.firstDelayMs;
    for (const good of catalog?.goods ?? []) {
      if (this.#goodsById.has(good.id)) throw new Error(`Duplicate economy good id "${good.id}" in content/economy.json.`);
      const live: MutableGood = {
        id: good.id,
        displayName: good.displayName,
        price: good.price,
        restockCost: good.restockCost ?? 0,
        stock: Math.max(0, Math.floor(good.stock)),
      };
      this.#goods.push(live);
      this.#goodsById.set(live.id, live);
    }
    for (const recipe of catalog?.recipes ?? []) {
      if (this.#recipesById.has(recipe.id)) throw new Error(`Duplicate economy recipe id "${recipe.id}" in content/economy.json.`);
      this.#recipes.push(recipe);
      this.#recipesById.set(recipe.id, recipe);
    }
    this.#demand = [...(catalog?.demand ?? [])];
  }

  mode(): EconomyMode {
    return this.#mode;
  }

  cash(): number {
    return this.#cash;
  }

  stock(goodId: string): number {
    return this.#goodsById.get(goodId)?.stock ?? 0;
  }

  goods(): readonly EconomyGood[] {
    return this.#goods.map((g) => ({ id: g.id, displayName: g.displayName, price: g.price, restockCost: g.restockCost, stock: g.stock }));
  }

  recipes(): readonly EconomyRecipe[] {
    return this.#recipes;
  }

  queue(): readonly QueuedCustomer[] {
    return this.#queue.map((c) => ({
      instanceId: c.instanceId,
      templateId: c.templateId,
      displayName: c.displayName,
      goodId: c.goodId,
      pay: c.pay,
      remainingMs: c.remainingMs,
    }));
  }

  served(): number {
    return this.#served;
  }

  lost(): number {
    return this.#lost;
  }

  produced(): number {
    return this.#produced;
  }

  selectedIndex(): number {
    return this.#selected;
  }

  selectByDelta(delta: number): number {
    const len = this.#selectionPool().length;
    if (len === 0) {
      this.#selected = 0;
      return 0;
    }
    this.#selected = ((this.#selected + delta) % len + len) % len;
    return this.#selected;
  }

  serve(): EconomyServeResult {
    const customer = this.#queue[0];
    if (!customer) {
      this.#lastResult = 'no-customer';
      return { ok: false, reason: 'no-customer' };
    }
    if (this.#mode === 'shop') {
      const good = this.#selectionPool()[this.#selected] as MutableGood | undefined;
      if (!good) {
        this.#lastResult = 'unknown-good';
        return { ok: false, reason: 'unknown-good' };
      }
      if (good.id !== customer.goodId) {
        this.#lastResult = 'wrong-good';
        return { ok: false, reason: 'wrong-good', customerId: customer.instanceId, goodId: good.id };
      }
      return this.#settle(customer);
    }
    return this.#settle(customer);
  }

  secondary(): EconomySecondaryResult {
    if (this.#mode === 'shop') {
      const good = this.#goods[this.#selected];
      if (!good) {
        this.#lastResult = 'no-selection';
        return { ok: false, reason: 'no-selection' };
      }
      if (this.#cash < good.restockCost) {
        this.#lastResult = 'cannot-afford';
        return { ok: false, reason: 'cannot-afford', goodId: good.id };
      }
      this.#cash -= good.restockCost;
      good.stock += 1;
      this.#lastResult = 'restocked';
      this.#events.emit('economy:stockChanged', { goodId: good.id, stock: good.stock, cash: this.#cash });
      return { ok: true, reason: 'restocked', goodId: good.id };
    }
    const recipe = this.#recipes[this.#selected];
    if (!recipe) {
      this.#lastResult = 'no-selection';
      return { ok: false, reason: 'no-selection' };
    }
    if (this.#production) {
      this.#lastResult = 'already-producing';
      return { ok: false, reason: 'already-producing', recipeId: recipe.id };
    }
    if (!this.#recipesById.has(recipe.id)) {
      this.#lastResult = 'unknown-recipe';
      return { ok: false, reason: 'unknown-recipe', recipeId: recipe.id };
    }
    for (const input of recipe.input ?? []) {
      const held = this.#goodsById.get(input.goodId);
      if (!held || held.stock < input.count) {
        this.#lastResult = 'missing-input';
        return { ok: false, reason: 'missing-input', recipeId: recipe.id };
      }
    }
    for (const input of recipe.input ?? []) {
      const held = this.#goodsById.get(input.goodId)!;
      held.stock -= input.count;
    }
    this.#production = { recipeId: recipe.id, remainingMs: recipe.durationMs, totalMs: recipe.durationMs };
    this.#lastResult = 'produced-started';
    return { ok: true, reason: 'produced-started', recipeId: recipe.id };
  }

  producing(): EconomyProduction | null {
    return this.#production;
  }

  lastResult(): string | null {
    return this.#lastResult;
  }

  tick(deltaMs: number): void {
    const dt = Number.isFinite(deltaMs) && deltaMs > 0 ? deltaMs : 0;
    this.#tickProduction(dt);
    this.#tickQueue(dt);
    this.#tickSpawn(dt);
    if (this.#autoSell) this.#tickAutoSell();
  }

  #selectionPool(): readonly { id: string }[] {
    return this.#mode === 'shop' ? this.#goods : this.#recipes;
  }

  #settle(customer: MutableCustomer): EconomyServeResult {
    const good = this.#goodsById.get(customer.goodId);
    if (!good) {
      this.#lastResult = 'unknown-good';
      return { ok: false, reason: 'unknown-good', customerId: customer.instanceId, goodId: customer.goodId };
    }
    if (good.stock <= 0) {
      this.#lastResult = 'no-stock';
      return { ok: false, reason: 'no-stock', customerId: customer.instanceId, goodId: good.id };
    }
    good.stock -= 1;
    this.#cash += customer.pay;
    this.#queue.shift();
    this.#served += 1;
    this.#lastResult = 'served';
    this.#events.emit('economy:served', {
      customerId: customer.instanceId,
      goodId: good.id,
      cash: this.#cash,
      stock: good.stock,
    });
    return { ok: true, reason: 'served', customerId: customer.instanceId, goodId: good.id };
  }

  #tickProduction(dt: number): void {
    if (!this.#production) return;
    this.#production.remainingMs = Math.max(0, this.#production.remainingMs - dt);
    if (this.#production.remainingMs > 0) return;
    const recipe = this.#recipesById.get(this.#production.recipeId);
    this.#production = null;
    if (!recipe) return;
    const output = this.#goodsById.get(recipe.outputGoodId);
    if (!output) return;
    output.stock += recipe.outputCount;
    this.#produced += recipe.outputCount;
    this.#lastResult = 'produced';
    this.#events.emit('economy:stockChanged', { goodId: output.id, stock: output.stock, cash: this.#cash });
  }

  #tickQueue(dt: number): void {
    for (let i = this.#queue.length - 1; i >= 0; i--) {
      const customer = this.#queue[i]!;
      customer.remainingMs = Math.max(0, customer.remainingMs - dt);
      if (customer.remainingMs > 0) continue;
      this.#queue.splice(i, 1);
      this.#lost += 1;
      this.#events.emit('economy:customerLeft', { customerId: customer.instanceId, reason: 'impatient' });
    }
  }

  #tickSpawn(dt: number): void {
    if (this.#demand.length === 0 || this.#spawn.maxQueue <= 0) return;
    this.#untilNextSpawnMs -= dt;
    while (this.#untilNextSpawnMs <= 0 && this.#queue.length < this.#spawn.maxQueue) {
      const template = this.#demand[this.#spawned % this.#demand.length]!;
      this.#spawned += 1;
      this.#untilNextSpawnMs += this.#spawn.intervalMs;
      const good = this.#goodsById.get(template.goodId);
      if (!good) continue;
      const instanceId = `c-${this.#spawned}`;
      this.#queue.push({
        instanceId,
        templateId: template.id,
        displayName: template.displayName,
        goodId: template.goodId,
        pay: template.pay ?? good.price,
        remainingMs: template.patienceMs,
      });
      this.#events.emit('economy:customerArrived', { customerId: instanceId, goodId: template.goodId, queueLength: this.#queue.length });
    }
    if (this.#untilNextSpawnMs < 0) this.#untilNextSpawnMs = 0;
  }

  #tickAutoSell(): void {
    // Serve every waiting customer whose good is in stock, front-first.
    // Bounded: at most the current queue length per tick so a restock storm
    // cannot loop forever.
    let guard = this.#queue.length;
    while (guard-- > 0) {
      const customer = this.#queue[0];
      if (!customer) return;
      const good = this.#goodsById.get(customer.goodId);
      if (!good || good.stock <= 0) return;
      this.#settle(customer);
    }
  }
}

export const economyPack: SystemPackDefinition<undefined, GameContext> = {
  id: PACK_IDS.economy,
  version: '0.1.0',
  provides: [CAPABILITY_IDS.economy],
  dependencies: [],

  install(context: GameContext): InstalledSystemPack {
    const catalog = context.content?.data?.['economy']?.value as EconomyCatalog | undefined;
    const service = new EconomyServiceImpl(context.events, catalog);
    const handle = context.capabilities.provide(CAPABILITY_IDS.economy, service);
    return {
      id: PACK_IDS.economy,
      update(deltaMs: number): void {
        service.tick(deltaMs);
      },
      dispose(): void {
        handle.dispose();
      },
    };
  },
};

export type { EconomyService };
