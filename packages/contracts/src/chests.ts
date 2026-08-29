/**
 * Pure domain contracts for procedural dungeon chests, lockpicking and
 * weighted rarity-tier loot.
 *
 * Renderer-neutral, validator-agnostic domain interfaces and types.
 */

export const CHESTS_CAPABILITY_ID = 'loot.chests';
export const LOCKPICKING_CAPABILITY_ID = 'loot.lockpicking';

export type ChestTier = 'wooden' | 'silver' | 'gold' | 'celestial' | string;

export type LootRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

export const LOOT_RARITIES: readonly LootRarity[] = [
  'common',
  'uncommon',
  'rare',
  'epic',
  'legendary',
];

export interface LootItemDrop {
  readonly itemId: string;
  readonly rarity: LootRarity;
  readonly weight: number;
  readonly minQuantity?: number;
  readonly maxQuantity?: number;
}

export interface LootTableDefinition {
  readonly id: string;
  readonly rolls?: number;
  readonly rarityWeights: Readonly<Record<LootRarity, number>>;
  readonly entries: readonly LootItemDrop[];
}

export interface LootTablesDocument {
  readonly schemaVersion: number;
  readonly tables: readonly LootTableDefinition[];
}

export type LockDifficulty = 'novice' | 'apprentice' | 'adept' | 'expert' | 'master';

export const LOCK_TOLERANCES: Readonly<Record<LockDifficulty, number>> = {
  novice: 20,
  apprentice: 15,
  adept: 10,
  expert: 6,
  master: 3,
};

export type ChestLockDefinition =
  | {
      readonly kind: 'key';
      readonly itemId: string;
      readonly consumeKey?: boolean;
    }
  | {
      readonly kind: 'pick';
      readonly difficulty: LockDifficulty;
    };

export interface ChestTrapDefinition {
  readonly effectId: string;
}

export interface ChestDefinition {
  readonly id: string;
  readonly name: string;
  readonly tier: ChestTier;
  readonly lootTableId: string;
  readonly lock?: ChestLockDefinition;
  readonly trap?: ChestTrapDefinition;
}

export interface ChestTypesDocument {
  readonly schemaVersion: number;
  readonly chestTypes: readonly ChestDefinition[];
}

export interface ChestInstance {
  readonly id: string;
  readonly typeId: string;
  readonly x: number;
  readonly y: number;
  readonly isOpen: boolean;
  readonly isLocked: boolean;
}

export type ChestOpenStatus =
  | 'opened'
  | 'already_open'
  | 'locked_needs_key'
  | 'locked_needs_pick'
  | 'unknown_chest';

export interface ChestDropRecord {
  readonly itemId: string;
  readonly quantity: number;
  readonly rarity: LootRarity;
}

export interface ChestOpenResult {
  readonly success: boolean;
  readonly status: ChestOpenStatus;
  readonly trapTriggered: boolean;
  readonly trapEffectId?: string | undefined;
  readonly drops: readonly ChestDropRecord[];
}

export interface LockpickingSession {
  readonly difficulty: LockDifficulty;
  readonly sweetSpotAngle: number;
  readonly tolerance: number;
  pickHealth: number;
  isBroken: boolean;
  isUnlocked: boolean;
}

export interface LockpickAttempt {
  readonly pickAngle: number;
  readonly wrenchRotation: number;
}

export interface LockpickResult {
  readonly success: boolean;
  readonly maxRotation: number;
  readonly pickDamage: number;
  readonly pickHealth: number;
  readonly isBroken: boolean;
  readonly isUnlocked: boolean;
}

export interface ChestsService {
  registerChestType(def: ChestDefinition): void;
  registerLootTable(table: LootTableDefinition): void;
  spawnChest(instanceId: string, typeId: string, position: { readonly x: number; readonly y: number }): ChestInstance;
  getChest(instanceId: string): ChestInstance | undefined;
  listChests(): readonly ChestInstance[];
  openChest(instanceId: string, options?: { readonly bypassLock?: boolean }): ChestOpenResult;
  unlockChest(instanceId: string): boolean;
}

export interface LockpickingService {
  startSession(difficulty: LockDifficulty, seed?: unknown, instanceId?: string): LockpickingSession;
  tryTurn(session: LockpickingSession, attempt: LockpickAttempt): LockpickResult;
}
