import { describe, expect, it } from 'vitest';
import {
  CHESTS_CAPABILITY_ID,
  LOCKPICKING_CAPABILITY_ID,
  LOCK_TOLERANCES,
  LOOT_RARITIES,
  type ChestDefinition,
  type LootTableDefinition,
} from '../src/chests.ts';

describe('chests contracts', () => {
  it('defines stable capability ids', () => {
    expect(CHESTS_CAPABILITY_ID).toBe('loot.chests');
    expect(LOCKPICKING_CAPABILITY_ID).toBe('loot.lockpicking');
  });

  it('defines expected rarity tiers in increasing order of rarity', () => {
    expect(LOOT_RARITIES).toEqual(['common', 'uncommon', 'rare', 'epic', 'legendary']);
  });

  it('defines tight lock tolerances by difficulty', () => {
    expect(LOCK_TOLERANCES.novice).toBe(20);
    expect(LOCK_TOLERANCES.apprentice).toBe(15);
    expect(LOCK_TOLERANCES.adept).toBe(10);
    expect(LOCK_TOLERANCES.expert).toBe(6);
    expect(LOCK_TOLERANCES.master).toBe(3);
  });

  it('supports pure domain definitions without schema validators', () => {
    const table: LootTableDefinition = {
      id: 'table-wooden',
      rolls: 1,
      rarityWeights: { common: 80, uncommon: 20, rare: 0, epic: 0, legendary: 0 },
      entries: [
        { itemId: 'gold_coin', rarity: 'common', weight: 100, minQuantity: 1, maxQuantity: 5 },
      ],
    };
    expect(table.id).toBe('table-wooden');

    const chest: ChestDefinition = {
      id: 'chest-wooden',
      name: 'Wooden Chest',
      tier: 'wooden',
      lootTableId: 'table-wooden',
    };
    expect(chest.lock).toBeUndefined();
    expect(chest.trap).toBeUndefined();

    const silverChest: ChestDefinition = {
      id: 'chest-silver',
      name: 'Silver Chest',
      tier: 'silver',
      lootTableId: 'table-silver',
      lock: { kind: 'key', itemId: 'silver_key', consumeKey: true },
    };
    expect(silverChest.lock?.kind).toBe('key');
  });
});
