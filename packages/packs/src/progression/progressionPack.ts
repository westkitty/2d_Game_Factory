import type { EventBus, GameContext, InstalledSystemPack, SystemPackDefinition } from '@sw2d/contracts';
import { registerSchema } from '@sw2d/schemas';
import { CAPABILITY_IDS, PACK_IDS } from '../ids.ts';
import progressionConfigSchema from '../../schemas/progression-config.schema.json';

/**
 * Progression pack: player/meta progression state - currency, XP, unlock
 * flags, item counts. Deliberately separate from the simulation pack's
 * resource ledger: progression is meta-game state carried across runs
 * (later, persisted through `context.saves`); simulation resources are
 * moment-to-moment gameplay state. No equipment, quests, skill trees or a
 * broad RPG framework here.
 */

export const PROGRESSION_CONFIG_SCHEMA_ID = progressionConfigSchema.$id;
registerSchema(progressionConfigSchema);

export interface ProgressionConfig {
  readonly startingCurrency?: number;
  readonly startingXp?: number;
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

  constructor(events: EventBus, startingCurrency: number, startingXp: number) {
    this.#events = events;
    this.#currency = startingCurrency;
    this.#xp = startingXp;
  }

  currency(): number {
    return this.#currency;
  }

  addCurrency(delta: number): number {
    this.#currency = Math.max(0, this.#currency + delta);
    this.#events.emit('progression:currencyChanged', { currency: this.#currency, delta });
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
    if (this.#unlocked.has(flag)) return;
    this.#unlocked.add(flag);
    this.#events.emit('progression:unlockChanged', { flag, unlocked: true });
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
    return next;
  }
}

export const progressionPack: SystemPackDefinition<ProgressionConfig, GameContext> = {
  id: PACK_IDS.progression,
  version: '0.1.0',
  provides: [CAPABILITY_IDS.progression],
  dependencies: [],
  configSchemaId: PROGRESSION_CONFIG_SCHEMA_ID,

  install(context: GameContext, config: ProgressionConfig): InstalledSystemPack {
    const service = new ProgressionServiceImpl(context.events, config?.startingCurrency ?? 0, config?.startingXp ?? 0);
    const handle = context.capabilities.provide(CAPABILITY_IDS.progression, service);

    return {
      id: PACK_IDS.progression,
      dispose(): void {
        handle.dispose();
      },
    };
  },
};
