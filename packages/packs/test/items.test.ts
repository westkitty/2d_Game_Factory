import { describe, expect, it } from 'vitest';
import { validateContentBundleData } from '@sw2d/schemas';
import type {
  GameContext,
  ItemCatalog,
  ItemsService,
  SaveSlotOptions,
  SaveStore,
  VersionedRecord,
} from '@sw2d/contracts';
import { ITEMS_CAPABILITY_ID } from '@sw2d/contracts';
import { CAPABILITY_IDS } from '../src/ids.ts';
import { itemsPack, ITEMS_SAVE_SLOT, UnknownItemError } from '../src/items/itemsPack.ts';
import { combatPack } from '../src/combat/combatPack.ts';
import { progressionPack } from '../src/progression/progressionPack.ts';
import { arcadePack } from '../src/arcade/arcadePack.ts';
import { worldPack } from '../src/world/worldPack.ts';
import { FakeCapabilityRegistry, FakeEventBus } from './testSupport.ts';

class FakeSaveStore implements SaveStore {
  readonly namespace = 'test';
  readonly store = new Map<string, VersionedRecord>();
  load<T extends VersionedRecord>(slot: string, options: SaveSlotOptions<T>) {
    const stored = this.store.get(slot) as T | undefined;
    if (stored && stored.schemaVersion === options.currentVersion) return { value: stored, outcome: 'loaded' as const };
    return { value: options.createDefault(), outcome: 'default' as const };
  }
  save<T extends VersionedRecord>(slot: string, value: T): void {
    this.store.set(slot, value);
  }
  clear(slot: string): void {
    this.store.delete(slot);
  }
}

const CATALOG: ItemCatalog = {
  schemaVersion: 1,
  items: [
    { id: 'gem', displayName: 'Gem', category: 'collectible', stackable: true, consumable: false, effects: [{ kind: 'arcade.score', amount: 10 }] },
    { id: 'coin', displayName: 'Coin', category: 'currency', stackable: true, maxCount: 3, consumable: false },
    {
      id: 'potion',
      displayName: 'Potion',
      category: 'consumable',
      stackable: true,
      consumable: true,
      quantityPerGrant: 1,
      effects: [{ kind: 'chain', effects: [{ kind: 'combat.heal', amount: 15 }, { kind: 'world.flag', flag: 'usedPotion', value: true }] }],
    },
    { id: 'key', displayName: 'Key', category: 'key', stackable: false, consumable: true, effects: [{ kind: 'world.flag', flag: 'doorUnlocked', value: true }] },
  ],
};

interface Ctx extends GameContext {
  events: FakeEventBus;
  capabilities: FakeCapabilityRegistry;
}

function makeContext(opts: { catalog?: ItemCatalog; saves?: SaveStore; withPacks?: readonly ('combat' | 'progression' | 'arcade' | 'world')[] } = {}): Ctx {
  const events = new FakeEventBus();
  const capabilities = new FakeCapabilityRegistry();
  const ctx = {
    events,
    capabilities,
    content: { data: opts.catalog ? { items: { schemaId: 'x', valid: true, value: opts.catalog } } : {} },
    saves: opts.saves,
  } as unknown as Ctx;
  for (const p of opts.withPacks ?? []) {
    if (p === 'combat') combatPack.install(ctx, undefined);
    if (p === 'progression') progressionPack.install(ctx, {});
    if (p === 'arcade') arcadePack.install(ctx, {});
    if (p === 'world') worldPack.install(ctx, undefined);
  }
  itemsPack.install(ctx, { persist: Boolean(opts.saves) });
  return ctx;
}

function svc(ctx: Ctx): ItemsService {
  return ctx.capabilities.require<ItemsService>('items.state');
}

describe('sw2d.items - ids', () => {
  it('the contracts-exported capability id matches the packs CAPABILITY_IDS entry', () => {
    expect(ITEMS_CAPABILITY_ID).toBe(CAPABILITY_IDS.items);
    expect(itemsPack.provides).toEqual([ITEMS_CAPABILITY_ID]);
  });
});

describe('sw2d.items - schema', () => {
  it('accepts a valid item catalog as a content document', () => {
    expect(() => validateContentBundleData({ items: CATALOG })).not.toThrow();
  });

  it('rejects an unknown effect kind', () => {
    const bad = { schemaVersion: 1, items: [{ id: 'x', displayName: 'X', category: 'c', stackable: true, consumable: false, effects: [{ kind: 'teleport', amount: 1 }] }] };
    expect(() => validateContentBundleData({ items: bad })).toThrow();
  });

  it('rejects a nested chain (chains do not nest)', () => {
    const bad = { schemaVersion: 1, items: [{ id: 'x', displayName: 'X', category: 'c', stackable: true, consumable: false, effects: [{ kind: 'chain', effects: [{ kind: 'chain', effects: [] }] }] }] };
    expect(() => validateContentBundleData({ items: bad })).toThrow();
  });
});

describe('sw2d.items - inventory', () => {
  it('installs and exposes the validated definitions', () => {
    const items = svc(makeContext({ catalog: CATALOG }));
    expect(items.definitionIds()).toEqual(['coin', 'gem', 'key', 'potion']);
    expect(items.lookup('gem')?.displayName).toBe('Gem');
    expect(items.lookup('nope')).toBeUndefined();
  });

  it('grant/remove clamp to maxCount and to zero, and emit items:countChanged', () => {
    const ctx = makeContext({ catalog: CATALOG });
    const items = svc(ctx);
    const changes: unknown[] = [];
    ctx.events.on('items:countChanged', (p) => changes.push(p));

    expect(items.grant('coin', 2).count).toBe(2);
    expect(items.grant('coin', 5).count).toBe(3); // maxCount 3
    expect(items.grant('coin', 1).granted).toBe(0); // already capped, no event
    expect(items.remove('coin', 10).count).toBe(0);
    expect(changes).toEqual([
      { itemId: 'coin', count: 2, delta: 2 },
      { itemId: 'coin', count: 3, delta: 1 },
      { itemId: 'coin', count: 0, delta: -3 },
    ]);
  });

  it('grant/remove throw for an unknown item id', () => {
    const items = svc(makeContext({ catalog: CATALOG }));
    expect(() => items.grant('ghost')).toThrow(UnknownItemError);
    expect(() => items.remove('ghost')).toThrow(UnknownItemError);
  });

  it('quantityPerGrant is the default step', () => {
    const items = svc(makeContext({ catalog: { schemaVersion: 1, items: [{ id: 'ammo', displayName: 'Ammo', category: 'c', stackable: true, consumable: false, quantityPerGrant: 5 }] } }));
    expect(items.grant('ammo').count).toBe(5);
  });
});

describe('sw2d.items - effects', () => {
  it('applies effects in order when every capability is present', () => {
    const ctx = makeContext({ catalog: CATALOG, withPacks: ['combat', 'world'] });
    ctx.capabilities.require<import('../src/combat/combatPack.ts').CombatService>('combat.health').register('hero', 30);
    ctx.capabilities.require<import('../src/combat/combatPack.ts').CombatService>('combat.health').damage('hero', 20, 0);
    const items = svc(ctx);
    items.grant('potion');
    const result = items.consume('potion', 1, { combatTargetId: 'hero', nowMs: 0 });
    expect(result.consumed).toBe(true);
    expect(result.effects.applied).toEqual(['combat.heal', 'world.flag']);
    expect(result.effects.skipped).toEqual([]);
    expect(ctx.capabilities.require<import('../src/combat/combatPack.ts').CombatService>('combat.health').get('hero').current).toBe(25);
    expect(ctx.capabilities.require<import('../src/world/worldPack.ts').WorldService>('world.state').hasFlag('usedPotion')).toBe(true);
  });

  it('skips an effect whose capability is absent - deterministically, no throw', () => {
    const ctx = makeContext({ catalog: CATALOG }); // no combat, no world
    const items = svc(ctx);
    items.grant('potion');
    const result = items.consume('potion', 1, { combatTargetId: 'hero', nowMs: 0 });
    expect(result.consumed).toBe(true);
    expect(result.effects.applied).toEqual([]);
    expect(result.effects.skipped).toEqual([
      { kind: 'combat.heal', reason: 'missing-capability', capability: 'combat.health' },
      { kind: 'world.flag', reason: 'missing-capability', capability: 'world.state' },
    ]);
  });

  it('skips combat.heal when no combat target is supplied', () => {
    const ctx = makeContext({ catalog: CATALOG, withPacks: ['combat', 'world'] });
    const items = svc(ctx);
    items.grant('potion');
    const result = items.consume('potion', 1, {}); // no combatTargetId
    expect(result.effects.applied).toEqual(['world.flag']);
    expect(result.effects.skipped).toEqual([{ kind: 'combat.heal', reason: 'missing-context' }]);
  });

  it('canConsume / consume respect consumable flag and count', () => {
    const items = svc(makeContext({ catalog: CATALOG, withPacks: ['arcade'] }));
    items.grant('gem'); // not consumable
    expect(items.canConsume('gem')).toBe(false);
    expect(items.consume('gem').consumed).toBe(false);
    expect(items.count('gem')).toBe(1);

    expect(items.canConsume('key')).toBe(false); // none held
    items.grant('key');
    expect(items.canConsume('key')).toBe(true);
    expect(items.consume('key').consumed).toBe(true);
    expect(items.count('key')).toBe(0);
  });
});

describe('sw2d.items - persistence', () => {
  it('inventory counts round-trip through the save store across a reinstall', () => {
    const saves = new FakeSaveStore();
    const first = svc(makeContext({ catalog: CATALOG, saves }));
    first.grant('coin', 2);
    first.grant('gem', 1);
    expect(saves.store.get(ITEMS_SAVE_SLOT)).toEqual({ schemaVersion: 1, counts: { coin: 2, gem: 1 } });

    // A fresh install (a new run) reads the persisted counts back.
    const second = svc(makeContext({ catalog: CATALOG, saves }));
    expect(second.inventory()).toEqual({ coin: 2, gem: 1 });
  });

  it('does not persist when no save store is supplied (in-memory only)', () => {
    const a = svc(makeContext({ catalog: CATALOG }));
    a.grant('coin', 1);
    const b = svc(makeContext({ catalog: CATALOG }));
    expect(b.inventory()).toEqual({});
  });

  it('with config { persist: false } (the default), a save store present on the context is ignored - inventory resets on reinstall', () => {
    const saves = new FakeSaveStore();
    const events = new FakeEventBus();
    const capabilities = new FakeCapabilityRegistry();
    const ctx = { events, capabilities, content: { data: { items: { schemaId: 'x', valid: true, value: CATALOG } } }, saves } as unknown as Ctx;
    const first = itemsPack.install(ctx, {});
    capabilities.require<ItemsService>('items.state').grant('coin', 2);
    first.dispose();
    expect(saves.store.get(ITEMS_SAVE_SLOT)).toBeUndefined();
    itemsPack.install(ctx, {});
    expect(capabilities.require<ItemsService>('items.state').inventory()).toEqual({});
  });
});

describe('sw2d.items - lifecycle', () => {
  it('withdraws its capability on dispose and re-registers cleanly on reinstall', () => {
    const events = new FakeEventBus();
    const capabilities = new FakeCapabilityRegistry();
    const ctx = { events, capabilities, content: { data: { items: { schemaId: 'x', valid: true, value: CATALOG } } }, saves: undefined } as unknown as Ctx;

    const first = itemsPack.install(ctx, {});
    expect(capabilities.has('items.state')).toBe(true);
    first.dispose();
    expect(capabilities.has('items.state')).toBe(false);
    const second = itemsPack.install(ctx, {});
    expect(capabilities.has('items.state')).toBe(true);
    second.dispose();
  });

  it('a missing content/items.json yields an empty catalog, not an error', () => {
    const items = svc(makeContext({}));
    expect(items.definitionIds()).toEqual([]);
    expect(() => items.grant('anything')).toThrow(UnknownItemError);
  });
});
