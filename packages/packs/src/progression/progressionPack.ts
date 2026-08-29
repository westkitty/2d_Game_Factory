import type { EventBus, GameContext, InstalledSystemPack, SaveStore, SystemPackDefinition, VersionedRecord } from '@sw2d/contracts';
import { registerSchema } from '@sw2d/schemas';
import { CAPABILITY_IDS, PACK_IDS } from '../ids.ts';
import progressionConfigSchema from '../../schemas/progression-config.schema.json' with { type: 'json' };

/**
 * Progression pack: player/meta progression state - currency, XP, unlock
 * flags, item counts. Deliberately separate from the simulation pack's
 * resource ledger: progression is meta-game state carried across runs
 * (persisted through `context.saves` when `persist: true`); simulation
 * resources are moment-to-moment gameplay state. No equipment, quests,
 * skill trees or a broad RPG framework here.
 */

export const PROGRESSION_CONFIG_SCHEMA_ID = progressionConfigSchema.$id;
registerSchema(progressionConfigSchema);

export const PROGRESSION_SAVE_SLOT = 'progression';
const PROGRESSION_SAVE_VERSION = 1;

export interface ProgressionConfig {
  readonly startingCurrency?: number;
  readonly startingXp?: number;
  /** Back progression with `context.saves` so currency, XP, unlocked flags and item counts survive reloads. Default false. */
  readonly persist?: boolean;
}

interface ProgressionSaveRecord extends VersionedRecord {
  readonly schemaVersion: number;
  readonly currency: number;
  readonly xp: number;
  readonly unlockedFlags: readonly string[];
  readonly itemCounts: Readonly<Record<string, number>>;
}

export interface ProgressionService {
  currency(): number;
  /** Clamped so currency never goes negative; returns the new balance. */
  addCurrency(delta: number): number;
  xp(): number;
  addXp(delta: number): number;
  /** No-op (no event) if the flag is already unlocked. */
  unlock(flag: string): void;
  isUnlocked(flag: string): boolean;
  unlockedFlags(): readonly string[];
  itemCount(itemId: string): number;
  /** Clamped so an item count never goes negative; returns the new count. */
  addItem(itemId: string, delta: number): number;
}

class ProgressionServiceImpl implements ProgressionService {
  #currency: number;
  #xp: number;
  readonly #unlocked = new Set<string>();
  readonly #items = new Map<string, number>();
  readonly #events: EventBus;
  readonly #saves: SaveStore | undefined;

  constructor(events: EventBus, startingCurrency: number, startingXp: number, saves?: SaveStore) {
    this.#events = events;
    this.#saves = saves;
    this.#currency = startingCurrency;
    this.#xp = startingXp;

    if (saves) {
      const loaded = saves.load<ProgressionSaveRecord>(PROGRESSION_SAVE_SLOT, {
        currentVersion: PROGRESSION_SAVE_VERSION,
        createDefault: () => ({
          schemaVersion: PROGRESSION_SAVE_VERSION,
          currency: startingCurrency,
          xp: startingXp,
          unlockedFlags: [],
          itemCounts: {},
        }),
      });
      this.#currency = loaded.value.currency;
      this.#xp = loaded.value.xp;
      for (const flag of loaded.value.unlockedFlags) this.#unlocked.add(flag);
      for (const [itemId, count] of Object.entries(loaded.value.itemCounts)) {
        if (Number.isFinite(count) && count > 0) this.#items.set(itemId, Math.floor(count));
      }
    }
  }

  currency(): number {
    return this.#currency;
  }

  addCurrency(delta: number): number {
    this.#currency = Math.max(0, this.#currency + delta);
    this.#events.emit('progression:currencyChanged', { currency: this.#currency, delta });
    this.#persist();
    return this.#currency;
  }

  xp(): number {
    return this.#xp;
  }

  addXp(delta: number): number {
    this.#xp = Math.max(0, this.#xp + delta);
    this.#persist();
    return this.#xp;
  }

  unlock(flag: string): void {
    if (this.#unlocked.has(flag)) return;
    this.#unlocked.add(flag);
    this.#events.emit('progression:unlockChanged', { flag, unlocked: true });
    this.#persist();
  }

  isUnlocked(flag: string): boolean {
    return this.#unlocked.has(flag);
  }

  unlockedFlags(): readonly string[] {
    return [...this.#unlocked].sort();
  }

  itemCount(itemId: string): number {
    return this.#items.get(itemId) ?? 0;
  }

  addItem(itemId: string, delta: number): number {
    const next = Math.max(0, this.itemCount(itemId) + delta);
    this.#items.set(itemId, next);
    this.#persist();
    return next;
  }

  #persist(): void {
    if (!this.#saves) return;
    const itemCounts: Record<string, number> = {};
    for (const [k, v] of this.#items) if (v > 0) itemCounts[k] = v;
    this.#saves.save<ProgressionSaveRecord>(PROGRESSION_SAVE_SLOT, {
      schemaVersion: PROGRESSION_SAVE_VERSION,
      currency: this.#currency,
      xp: this.#xp,
      unlockedFlags: [...this.#unlocked].sort(),
      itemCounts,
    });
  }
}

export const progressionPack: SystemPackDefinition<ProgressionConfig, GameContext> = {
  id: PACK_IDS.progression,
  version: '0.1.0',
  provides: [CAPABILITY_IDS.progression],
  dependencies: [],
  configSchemaId: PROGRESSION_CONFIG_SCHEMA_ID,

  install(context: GameContext, config: ProgressionConfig): InstalledSystemPack {
    const saves = config?.persist ? context.saves : undefined;
    const service = new ProgressionServiceImpl(
      context.events,
      config?.startingCurrency ?? 0,
      config?.startingXp ?? 0,
      saves,
    );
    const handle = context.capabilities.provide(CAPABILITY_IDS.progression, service);

    return {
      id: PACK_IDS.progression,
      dispose(): void {
        handle.dispose();
      },
    };
  },
};
