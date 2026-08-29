import { describe, expect, it, vi } from 'vitest';
import type {
  ChestDefinition,
  GameContext,
  ItemDefinition,
  ItemsService,
  LootTableDefinition,
} from '@sw2d/contracts';
import {
  CAPABILITY_IDS,
  PACK_IDS,
} from '../src/ids.ts';
import {
  ChestsServiceImpl,
  LockpickingServiceImpl,
  dungeonChestsPack,
  validateSemanticLootAndChests,
} from '../src/dungeonChests/dungeonChestsPack.ts';

function createMockItems(inventory: Record<string, number> = {}): ItemsService {
  const held = { ...inventory };
  const items: Record<string, ItemDefinition> = {
    silver_key: { id: 'silver_key', displayName: 'Silver Key', category: 'keys', stackable: true, consumable: true },
    gold_coin: { id: 'gold_coin', displayName: 'Gold Coin', category: 'currency', stackable: true, consumable: false },
    potion: { id: 'potion', displayName: 'Health Potion', category: 'consumable', stackable: true, consumable: true },
    epic_sword: { id: 'epic_sword', displayName: 'Epic Sword', category: 'equipment', stackable: false, consumable: false },
  };

  return {
    lookup: (id: string) => items[id],
    definitionIds: () => Object.keys(items),
    count: (id: string) => held[id] ?? 0,
    inventory: () => ({ ...held }),
    grant: (id: string, qty = 1) => {
      held[id] = (held[id] ?? 0) + qty;
      return { itemId: id, count: held[id], granted: qty };
    },
    remove: (id: string, qty = 1) => {
      const current = held[id] ?? 0;
      const removed = Math.min(current, qty);
      held[id] = current - removed;
      return { itemId: id, count: held[id], granted: removed };
    },
    canConsume: (id: string) => (held[id] ?? 0) > 0,
    consume: () => ({ itemId: '', count: 0, consumed: true, effects: { applied: [], skipped: [] } }),
    applyEffects: () => ({ applied: [], skipped: [] }),
  };
}

describe('LockpickingServiceImpl', () => {
  const service = new LockpickingServiceImpl();

  it('determines deterministic sweet spot within [-80, 80] for same seed and instance', () => {
    const s1 = service.startSession('novice', 100, 'chest-1');
    const s2 = service.startSession('novice', 100, 'chest-1');
    expect(s1.sweetSpotAngle).toBe(s2.sweetSpotAngle);
    expect(s1.tolerance).toBe(20);
    expect(s1.pickHealth).toBe(100);
    expect(s1.isBroken).toBe(false);
  });

  it('succeeds at exact sweet spot and tolerance boundary without damage', () => {
    const session = service.startSession('novice', 42, 'chest-test');
    // Exact sweet spot
    const res1 = service.tryTurn(session, {
      pickAngle: session.sweetSpotAngle,
      wrenchRotation: 90,
    });
    expect(res1.success).toBe(true);
    expect(res1.maxRotation).toBe(90);
    expect(res1.pickDamage).toBe(0);
    expect(session.isUnlocked).toBe(true);

    // Exact tolerance boundary
    const session2 = service.startSession('novice', 42, 'chest-test');
    const res2 = service.tryTurn(session2, {
      pickAngle: session2.sweetSpotAngle + session2.tolerance,
      wrenchRotation: 90,
    });
    expect(res2.success).toBe(true);
    expect(res2.maxRotation).toBe(90);
    expect(res2.pickDamage).toBe(0);
  });

  it('jams rotation and damages pick when outside tolerance', () => {
    const session = service.startSession('expert', 42, 'chest-expert'); // tolerance = 6
    // Angle far off
    const badAngle = session.sweetSpotAngle + 30; // error = 30 > 6
    const res = service.tryTurn(session, {
      pickAngle: badAngle,
      wrenchRotation: 90,
    });
    expect(res.success).toBe(false);
    // Jam formula: 90 - (30 - 6) * 3 = 90 - 72 = 18
    expect(res.maxRotation).toBe(18);
    expect(res.pickDamage).toBeGreaterThan(0);
    expect(session.pickHealth).toBeLessThan(100);
  });

  it('breaks pick when cumulative damage reduces health to 0', () => {
    const session = service.startSession('master', 42, 'chest-master'); // tolerance = 3
    const badAngle = session.sweetSpotAngle + 60;
    while (!session.isBroken) {
      service.tryTurn(session, { pickAngle: badAngle, wrenchRotation: 90 });
    }
    expect(session.isBroken).toBe(true);
    expect(session.pickHealth).toBe(0);

    // Turning a broken pick fails immediately with 0 max rotation
    const turnBroken = service.tryTurn(session, { pickAngle: session.sweetSpotAngle, wrenchRotation: 90 });
    expect(turnBroken.success).toBe(false);
    expect(turnBroken.isBroken).toBe(true);
  });
});

describe('ChestsServiceImpl', () => {
  const commonTable: LootTableDefinition = {
    id: 'table-common',
    rolls: 1,
    rarityWeights: { common: 100, uncommon: 0, rare: 0, epic: 0, legendary: 0 },
    entries: [
      { itemId: 'gold_coin', rarity: 'common', weight: 100, minQuantity: 5, maxQuantity: 10 },
    ],
  };

  const rareTable: LootTableDefinition = {
    id: 'table-rare',
    rolls: 2,
    rarityWeights: { common: 0, uncommon: 70, rare: 30, epic: 0, legendary: 0 },
    entries: [
      { itemId: 'potion', rarity: 'uncommon', weight: 100, minQuantity: 1, maxQuantity: 2 },
      { itemId: 'epic_sword', rarity: 'rare', weight: 100, minQuantity: 1, maxQuantity: 1 },
    ],
  };

  const woodenDef: ChestDefinition = {
    id: 'wooden',
    name: 'Wooden Chest',
    tier: 'wooden',
    lootTableId: 'table-common',
  };

  const silverDef: ChestDefinition = {
    id: 'silver',
    name: 'Silver Chest',
    tier: 'silver',
    lootTableId: 'table-common',
    lock: { kind: 'key', itemId: 'silver_key', consumeKey: true },
  };

  const goldDef: ChestDefinition = {
    id: 'gold',
    name: 'Gold Chest',
    tier: 'gold',
    lootTableId: 'table-rare',
    lock: { kind: 'pick', difficulty: 'adept' },
  };

  const trapDef: ChestDefinition = {
    id: 'trap',
    name: 'Trap Mimic',
    tier: 'wooden',
    lootTableId: 'table-common',
    trap: { effectId: 'poison_cloud' },
  };

  it('opens unlocked wooden chest and is strictly idempotent', () => {
    const items = createMockItems();
    const service = new ChestsServiceImpl({ seed: 777, items });
    service.registerLootTable(commonTable);
    service.registerChestType(woodenDef);

    service.spawnChest('wood-1', 'wooden', { x: 10, y: 20 });
    const firstOpen = service.openChest('wood-1');
    expect(firstOpen.success).toBe(true);
    expect(firstOpen.status).toBe('opened');
    expect(firstOpen.drops).toHaveLength(1);
    expect(firstOpen.drops[0]?.itemId).toBe('gold_coin');
    const grantedCoins = items.count('gold_coin');
    expect(grantedCoins).toBeGreaterThanOrEqual(5);

    // Second open attempt must report already_open, no drops, no duplication
    const secondOpen = service.openChest('wood-1');
    expect(secondOpen.success).toBe(false);
    expect(secondOpen.status).toBe('already_open');
    expect(secondOpen.drops).toHaveLength(0);
    expect(items.count('gold_coin')).toBe(grantedCoins);
  });

  it('rejects locked silver chest without key and unlocks when key is present', () => {
    const items = createMockItems();
    const service = new ChestsServiceImpl({ seed: 777, items });
    service.registerLootTable(commonTable);
    service.registerChestType(silverDef);

    service.spawnChest('silver-1', 'silver', { x: 30, y: 40 });
    const lockedRes = service.openChest('silver-1');
    expect(lockedRes.success).toBe(false);
    expect(lockedRes.status).toBe('locked_needs_key');

    // Grant silver key
    items.grant('silver_key', 1);
    expect(items.count('silver_key')).toBe(1);

    const openRes = service.openChest('silver-1');
    expect(openRes.success).toBe(true);
    expect(openRes.status).toBe('opened');
    // Key should be consumed
    expect(items.count('silver_key')).toBe(0);
  });

  it('handles pick-locked chest unlocking and rare/epic drops', () => {
    const items = createMockItems();
    const service = new ChestsServiceImpl({ seed: 888, items });
    service.registerLootTable(rareTable);
    service.registerChestType(goldDef);

    service.spawnChest('gold-1', 'gold', { x: 50, y: 60 });
    const lockedRes = service.openChest('gold-1');
    expect(lockedRes.success).toBe(false);
    expect(lockedRes.status).toBe('locked_needs_pick');

    // Unlock via lockpick success
    service.unlockChest('gold-1');
    const openRes = service.openChest('gold-1');
    expect(openRes.success).toBe(true);
    expect(openRes.status).toBe('opened');
    expect(openRes.drops.length).toBe(2);
  });

  it('triggers trap when opening trap chest and emits event', () => {
    const events = { emit: vi.fn(), on: vi.fn(), listenerCounts: vi.fn() } as any;
    const service = new ChestsServiceImpl({ seed: 999, events });
    service.registerLootTable(commonTable);
    service.registerChestType(trapDef);

    service.spawnChest('trap-1', 'trap', { x: 0, y: 0 });
    const openRes = service.openChest('trap-1');
    expect(openRes.success).toBe(true);
    expect(openRes.trapTriggered).toBe(true);
    expect(openRes.trapEffectId).toBe('poison_cloud');
    expect(events.emit).toHaveBeenCalledWith('loot:trapTriggered', {
      instanceId: 'trap-1',
      chestTypeId: 'trap',
      effectId: 'poison_cloud',
    });
  });

  it('guarantees open-order independence across multiple chests', () => {
    // Open A then B
    const items1 = createMockItems();
    const s1 = new ChestsServiceImpl({ seed: 12345, items: items1 });
    s1.registerLootTable(rareTable);
    s1.registerChestType(goldDef);
    s1.spawnChest('chest-A', 'gold', { x: 0, y: 0 });
    s1.spawnChest('chest-B', 'gold', { x: 10, y: 10 });
    s1.unlockChest('chest-A');
    s1.unlockChest('chest-B');

    const a1 = s1.openChest('chest-A');
    const b1 = s1.openChest('chest-B');

    // In a new instance with the same seed, open B then A
    const items2 = createMockItems();
    const s2 = new ChestsServiceImpl({ seed: 12345, items: items2 });
    s2.registerLootTable(rareTable);
    s2.registerChestType(goldDef);
    s2.spawnChest('chest-A', 'gold', { x: 0, y: 0 });
    s2.spawnChest('chest-B', 'gold', { x: 10, y: 10 });
    s2.unlockChest('chest-A');
    s2.unlockChest('chest-B');

    const b2 = s2.openChest('chest-B');
    const a2 = s2.openChest('chest-A');

    expect(a1.drops).toEqual(a2.drops);
    expect(b1.drops).toEqual(b2.drops);
  });

  it('rejects invalid semantic definitions with descriptive errors', () => {
    const items = createMockItems();

    // Unknown loot table in chest
    expect(() =>
      validateSemanticLootAndChests(
        [commonTable],
        [{ id: 'c1', name: 'C1', tier: 'wood', lootTableId: 'nonexistent' }],
        items,
      ),
    ).toThrow('references unknown loot table');

    // Unknown item in loot table
    expect(() =>
      validateSemanticLootAndChests(
        [
          {
            id: 'bad-table',
            rarityWeights: { common: 100, uncommon: 0, rare: 0, epic: 0, legendary: 0 },
            entries: [{ itemId: 'imaginary_sword', rarity: 'common', weight: 10 }],
          },
        ],
        [],
        items,
      ),
    ).toThrow('references unknown item "imaginary_sword"');

    // Zero rarity weight
    expect(() =>
      validateSemanticLootAndChests(
        [
          {
            id: 'zero-weight',
            rarityWeights: { common: 0, uncommon: 0, rare: 0, epic: 0, legendary: 0 },
            entries: [{ itemId: 'gold_coin', rarity: 'common', weight: 10 }],
          },
        ],
        [],
        items,
      ),
    ).toThrow('has no positive rarity weights');
  });

  it('dungeonChestsPack installs into GameContext and provides capabilities', () => {
    const items = createMockItems();
    const provided = new Map<string, unknown>();
    const mockContext: GameContext = {
      capabilities: {
        require: vi.fn().mockImplementation((id: string) => {
          if (id === CAPABILITY_IDS.items) return items;
          throw new Error(`Unexpected require ${id}`);
        }),
        provide: vi.fn().mockImplementation((id: string, service: unknown) => {
          provided.set(id, service);
          return { dispose: vi.fn() };
        }),
        get: vi.fn(),
      } as any,
      content: { data: {} } as any,
      events: { emit: vi.fn(), on: vi.fn() } as any,
    } as any;

    const installed = dungeonChestsPack.install(mockContext, {});
    expect(installed.id).toBe(PACK_IDS.dungeonChests);
    expect(provided.has(CAPABILITY_IDS.chests)).toBe(true);
    expect(provided.has(CAPABILITY_IDS.lockpicking)).toBe(true);
  });
});
