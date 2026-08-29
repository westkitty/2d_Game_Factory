import type {
  ChestDefinition,
  ChestDropRecord,
  ChestInstance,
  ChestOpenResult,
  ChestsService,
  GameContext,
  EventBus,
  InstalledSystemPack,
  ItemsService,
  LockDifficulty,
  LockpickAttempt,
  LockpickResult,
  LockpickingService,
  LockpickingSession,
  LootTableDefinition,
  SystemPackDefinition,
} from '@sw2d/contracts';
import {
  LOCK_TOLERANCES,
  LOOT_RARITIES,
  createRng,
  normalizeSeed,
} from '@sw2d/contracts';
import { CAPABILITY_IDS, PACK_IDS } from '../ids.ts';

export class LockpickingServiceImpl implements LockpickingService {
  startSession(difficulty: LockDifficulty, seed?: unknown, instanceId?: string): LockpickingSession {
    const base = normalizeSeed(seed ?? 42);
    const inst = normalizeSeed(instanceId ?? 'default');
    const purpose = normalizeSeed('lock');
    const lockSeed = (base + inst + purpose) >>> 0;
    const rng = createRng(lockSeed);
    // Deterministic sweet spot angle in [-80, 80] degrees
    const sweetSpotAngle = Math.round((rng.nextFloat() - 0.5) * 160);
    const tolerance = LOCK_TOLERANCES[difficulty] ?? 10;

    return {
      difficulty,
      sweetSpotAngle,
      tolerance,
      pickHealth: 100,
      isBroken: false,
      isUnlocked: false,
    };
  }

  tryTurn(session: LockpickingSession, attempt: LockpickAttempt): LockpickResult {
    if (session.isBroken) {
      return {
        success: false,
        maxRotation: 0,
        pickDamage: 0,
        pickHealth: 0,
        isBroken: true,
        isUnlocked: false,
      };
    }

    if (session.isUnlocked) {
      return {
        success: true,
        maxRotation: 90,
        pickDamage: 0,
        pickHealth: session.pickHealth,
        isBroken: false,
        isUnlocked: true,
      };
    }

    const pickAngle = Math.max(-90, Math.min(90, attempt.pickAngle));
    const wrenchRotation = Math.max(0, Math.min(90, attempt.wrenchRotation));
    const error = Math.abs(pickAngle - session.sweetSpotAngle);

    let maxRotation = 90;
    if (error > session.tolerance) {
      maxRotation = Math.max(0, Math.round(90 - (error - session.tolerance) * 3));
    }

    let pickDamage = 0;
    if (wrenchRotation > maxRotation) {
      const excess = wrenchRotation - maxRotation;
      pickDamage = Math.min(100, Math.round(15 + excess * 0.5));
      session.pickHealth = Math.max(0, session.pickHealth - pickDamage);
      if (session.pickHealth <= 0) {
        session.isBroken = true;
      }
    }

    const success = !session.isBroken && wrenchRotation >= 90 && error <= session.tolerance;
    if (success) {
      session.isUnlocked = true;
    }

    return {
      success,
      maxRotation,
      pickDamage,
      pickHealth: session.pickHealth,
      isBroken: session.isBroken,
      isUnlocked: session.isUnlocked,
    };
  }
}

export function validateSemanticLootAndChests(
  tables: readonly LootTableDefinition[],
  chests: readonly ChestDefinition[],
  items?: ItemsService,
): void {
  const tableIds = new Set<string>();
  const tableMap = new Map<string, LootTableDefinition>();

  for (const table of tables) {
    if (tableIds.has(table.id)) {
      throw new Error(`Duplicate loot table id "${table.id}"`);
    }
    tableIds.add(table.id);
    tableMap.set(table.id, table);

    let totalRarityWeight = 0;
    for (const r of LOOT_RARITIES) {
      totalRarityWeight += table.rarityWeights[r] ?? 0;
    }
    if (totalRarityWeight <= 0) {
      throw new Error(`Loot table "${table.id}" has no positive rarity weights`);
    }

    for (const r of LOOT_RARITIES) {
      if ((table.rarityWeights[r] ?? 0) > 0) {
        const matching = table.entries.filter((e) => e.rarity === r);
        if (matching.length === 0) {
          throw new Error(`Loot table "${table.id}" has positive weight for rarity "${r}" but no entries`);
        }
      }
    }

    for (const entry of table.entries) {
      if (entry.weight <= 0) {
        throw new Error(`Loot table "${table.id}" entry "${entry.itemId}" has weight <= 0`);
      }
      const minQ = entry.minQuantity ?? 1;
      const maxQ = entry.maxQuantity ?? minQ;
      if (minQ < 1 || maxQ < minQ) {
        throw new Error(`Loot table "${table.id}" entry "${entry.itemId}" has invalid quantity range [${minQ}, ${maxQ}]`);
      }
      if (items && !items.lookup(entry.itemId)) {
        throw new Error(`Loot table "${table.id}" references unknown item "${entry.itemId}" not defined in ItemsService`);
      }
    }
  }

  const chestIds = new Set<string>();
  for (const chest of chests) {
    if (chestIds.has(chest.id)) {
      throw new Error(`Duplicate chest id "${chest.id}"`);
    }
    chestIds.add(chest.id);

    if (!tableMap.has(chest.lootTableId)) {
      throw new Error(`Chest type "${chest.id}" references unknown loot table "${chest.lootTableId}"`);
    }

    if (chest.lock?.kind === 'key' && items) {
      if (!items.lookup(chest.lock.itemId)) {
        throw new Error(`Chest type "${chest.id}" references unknown key item "${chest.lock.itemId}" not defined in ItemsService`);
      }
    }
  }
}

export interface ChestsServiceOptions {
  readonly seed?: unknown;
  readonly items?: ItemsService | undefined;
  readonly events?: EventBus | undefined;
}

export class ChestsServiceImpl implements ChestsService {
  readonly #lootTables = new Map<string, LootTableDefinition>();
  readonly #chestTypes = new Map<string, ChestDefinition>();
  readonly #chests = new Map<string, ChestInstance>();
  readonly #baseSeed: unknown;
  readonly #items?: ItemsService | undefined;
  readonly #events?: EventBus | undefined;

  constructor(options?: ChestsServiceOptions) {
    this.#baseSeed = options?.seed ?? 1337;
    this.#items = options?.items;
    this.#events = options?.events;
  }

  registerLootTable(table: LootTableDefinition): void {
    validateSemanticLootAndChests([table], [], this.#items);
    this.#lootTables.set(table.id, Object.freeze({ ...table }));
  }

  registerChestType(def: ChestDefinition): void {
    validateSemanticLootAndChests(Array.from(this.#lootTables.values()), [def], this.#items);
    this.#chestTypes.set(def.id, Object.freeze({ ...def }));
  }

  spawnChest(instanceId: string, typeId: string, position: { readonly x: number; readonly y: number }): ChestInstance {
    const def = this.#chestTypes.get(typeId);
    if (!def) {
      throw new Error(`Cannot spawn chest: unknown chest type "${typeId}"`);
    }
    const instance: ChestInstance = {
      id: instanceId,
      typeId,
      x: position.x,
      y: position.y,
      isOpen: false,
      isLocked: Boolean(def.lock),
    };
    this.#chests.set(instanceId, instance);
    return instance;
  }

  getChest(instanceId: string): ChestInstance | undefined {
    return this.#chests.get(instanceId);
  }

  listChests(): readonly ChestInstance[] {
    return Array.from(this.#chests.values());
  }

  unlockChest(instanceId: string): boolean {
    const inst = this.#chests.get(instanceId);
    if (!inst) return false;
    (inst as { isLocked: boolean }).isLocked = false;
    return true;
  }

  openChest(instanceId: string, options?: { readonly bypassLock?: boolean }): ChestOpenResult {
    const inst = this.#chests.get(instanceId);
    if (!inst) {
      return { success: false, status: 'unknown_chest', trapTriggered: false, drops: [] };
    }

    if (inst.isOpen) {
      return { success: false, status: 'already_open', trapTriggered: false, drops: [] };
    }

    const def = this.#chestTypes.get(inst.typeId);
    if (!def) {
      return { success: false, status: 'unknown_chest', trapTriggered: false, drops: [] };
    }

    if (inst.isLocked && !options?.bypassLock) {
      if (def.lock?.kind === 'key') {
        if (this.#items) {
          const count = this.#items.count(def.lock.itemId);
          if (count <= 0) {
            return { success: false, status: 'locked_needs_key', trapTriggered: false, drops: [] };
          }
          if (def.lock.consumeKey) {
            this.#items.remove(def.lock.itemId, 1);
          }
          (inst as { isLocked: boolean }).isLocked = false;
        } else {
          return { success: false, status: 'locked_needs_key', trapTriggered: false, drops: [] };
        }
      } else if (def.lock?.kind === 'pick') {
        return { success: false, status: 'locked_needs_pick', trapTriggered: false, drops: [] };
      }
    }

    (inst as { isOpen: boolean }).isOpen = true;

    let trapTriggered = false;
    let trapEffectId: string | undefined = undefined;
    if (def.trap) {
      trapTriggered = true;
      trapEffectId = def.trap.effectId;
      this.#events?.emit('loot:trapTriggered', {
        instanceId,
        chestTypeId: def.id,
        effectId: def.trap.effectId,
      });
    }

    const table = this.#lootTables.get(def.lootTableId);
    const drops: ChestDropRecord[] = [];

    if (table) {
      const lootSeed =
        (normalizeSeed(this.#baseSeed) + normalizeSeed(instanceId) + normalizeSeed('loot')) >>> 0;
      const rng = createRng(lootSeed);
      const rolls = table.rolls ?? 1;

      for (let i = 0; i < rolls; i++) {
        // Stage 1: roll rarity tier from positive rarity weights
        const activeRarities = LOOT_RARITIES.filter((r) => (table.rarityWeights[r] ?? 0) > 0);
        const rolledRarity = rng.weightedChoose(
          activeRarities.map((r) => ({ value: r, weight: table.rarityWeights[r]! })),
        );

        // Stage 2: roll item matching the selected rarity tier
        const matching = table.entries.filter((e) => e.rarity === rolledRarity);
        const entry = rng.weightedChoose(matching.map((e) => ({ value: e, weight: e.weight })));

        // Stage 3: roll quantity in [minQuantity, maxQuantity]
        const minQ = entry.minQuantity ?? 1;
        const maxQ = entry.maxQuantity ?? minQ;
        const qty = minQ + (maxQ > minQ ? rng.nextInt(maxQ - minQ + 1) : 0);

        let granted = qty;
        if (this.#items) {
          const grantRes = this.#items.grant(entry.itemId, qty);
          granted = grantRes.granted;
        }

        drops.push({ itemId: entry.itemId, quantity: granted, rarity: rolledRarity });
      }
    }

    this.#events?.emit('loot:chestOpened', {
      instanceId,
      chestTypeId: def.id,
      drops: drops.map((d) => ({ itemId: d.itemId, quantity: d.quantity })),
    });

    return {
      success: true,
      status: 'opened',
      trapTriggered,
      trapEffectId,
      drops,
    };
  }
}

export const dungeonChestsPack: SystemPackDefinition = {
  id: PACK_IDS.dungeonChests,
  version: '0.1.0',
  provides: [CAPABILITY_IDS.chests, CAPABILITY_IDS.lockpicking],
  dependencies: [CAPABILITY_IDS.items],

  install(context: GameContext, _config?: unknown): InstalledSystemPack {
    const items = context.capabilities.require<ItemsService>(CAPABILITY_IDS.items);
    const chestsService = new ChestsServiceImpl({
      seed: 1337,
      items,
      events: context.events,
    });
    const lockpickingService = new LockpickingServiceImpl();

    const lootTablesRaw = context.content?.data?.['loot-tables'];
    const lootTablesData = ((lootTablesRaw as any)?.value ?? lootTablesRaw) as
      | { tables?: readonly LootTableDefinition[] }
      | undefined;
    const chestTypesRaw = context.content?.data?.['chest-types'];
    const chestTypesData = ((chestTypesRaw as any)?.value ?? chestTypesRaw) as
      | { chestTypes?: readonly ChestDefinition[] }
      | undefined;

    if (lootTablesData?.tables) {
      for (const table of lootTablesData.tables) {
        chestsService.registerLootTable(table);
      }
    }

    if (chestTypesData?.chestTypes) {
      for (const chest of chestTypesData.chestTypes) {
        chestsService.registerChestType(chest);
      }
    }

    const chestsHandle = context.capabilities.provide(CAPABILITY_IDS.chests, chestsService);
    const lockpickingHandle = context.capabilities.provide(
      CAPABILITY_IDS.lockpicking,
      lockpickingService,
    );

    return {
      id: PACK_IDS.dungeonChests,
      dispose(): void {
        chestsHandle.dispose();
        lockpickingHandle.dispose();
      },
    };
  },
};
