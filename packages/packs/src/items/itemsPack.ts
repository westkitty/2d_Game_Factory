import type {
  ApplyEffectsResult,
  CapabilityRegistry,
  EffectDefinition,
  EffectKind,
  EventBus,
  GameContext,
  InstalledSystemPack,
  ItemCatalog,
  ItemConsumeResult,
  ItemDefinition,
  ItemEffectContext,
  ItemGrantResult,
  ItemsService,
  LeafEffectDefinition,
  SaveStore,
  SkippedEffect,
  SystemPackDefinition,
  VersionedRecord,
} from '@sw2d/contracts';
import { EFFECT_CAPABILITY_REQUIREMENT } from '@sw2d/contracts';
import { registerSchema } from '@sw2d/schemas';
import { CAPABILITY_IDS, PACK_IDS } from '../ids.ts';
import itemsConfigSchema from '../../schemas/items-config.schema.json' with { type: 'json' };
import type { CombatService } from '../combat/combatPack.ts';
import type { ProgressionService } from '../progression/progressionPack.ts';
import type { ArcadeService } from '../arcade/arcadePack.ts';
import type { SimulationService } from '../simulation/simulationPack.ts';
import type { WorldService } from '../world/worldPack.ts';

/**
 * Items pack: the one canonical data-driven item / effect / inventory model
 * (capability program Phase 2).
 *
 * Definitions come from validated content (`content/items.json`, schema
 * `item-catalog`); this pack turns them into a live inventory plus a bounded
 * effect executor. It has no hard pack dependencies - an effect whose target
 * capability is absent is skipped and reported, never a throw. Inventory
 * counts persist through `context.saves`; definitions never do.
 */

export const ITEMS_SAVE_SLOT = 'items';
export const ITEMS_CONFIG_SCHEMA_ID = itemsConfigSchema.$id;
registerSchema(itemsConfigSchema);
const ITEMS_SAVE_VERSION = 1;

export interface ItemsConfig {
  /** Back the inventory with `context.saves` so counts survive a browser reload. Default false (in-memory, resets on restart). */
  readonly persist?: boolean;
}

interface ItemsSave extends VersionedRecord {
  readonly counts: Readonly<Record<string, number>>;
}

export class UnknownItemError extends Error {
  constructor(itemId: string) {
    super(`No item defined with id "${itemId}" in content/items.json.`);
    this.name = 'UnknownItemError';
  }
}

class ItemsServiceImpl implements ItemsService {
  readonly #defs = new Map<string, ItemDefinition>();
  readonly #counts = new Map<string, number>();
  readonly #events: EventBus;
  readonly #capabilities: CapabilityRegistry;
  readonly #saves: SaveStore | undefined;

  constructor(
    events: EventBus,
    capabilities: CapabilityRegistry,
    catalog: ItemCatalog | undefined,
    saves: SaveStore | undefined,
  ) {
    this.#events = events;
    this.#capabilities = capabilities;
    this.#saves = saves;
    for (const def of catalog?.items ?? []) {
      if (this.#defs.has(def.id)) throw new Error(`Duplicate item id "${def.id}" in content/items.json.`);
      this.#defs.set(def.id, def);
    }
    if (saves) {
      const loaded = saves.load<ItemsSave>(ITEMS_SAVE_SLOT, {
        currentVersion: ITEMS_SAVE_VERSION,
        createDefault: () => ({ schemaVersion: ITEMS_SAVE_VERSION, counts: {} }),
      });
      for (const [id, count] of Object.entries(loaded.value.counts)) {
        if (Number.isFinite(count) && count > 0) this.#counts.set(id, Math.floor(count));
      }
    }
  }

  lookup(itemId: string): ItemDefinition | undefined {
    return this.#defs.get(itemId);
  }

  definitionIds(): readonly string[] {
    return [...this.#defs.keys()].sort();
  }

  count(itemId: string): number {
    return this.#counts.get(itemId) ?? 0;
  }

  inventory(): Readonly<Record<string, number>> {
    const out: Record<string, number> = {};
    for (const [id, count] of this.#counts) if (count > 0) out[id] = count;
    return out;
  }

  grant(itemId: string, quantity?: number): ItemGrantResult {
    const def = this.#require(itemId);
    const step = quantity ?? def.quantityPerGrant ?? 1;
    const current = this.count(itemId);
    const cap = def.maxCount ?? Number.POSITIVE_INFINITY;
    const next = Math.max(0, Math.min(cap, current + step));
    return this.#set(itemId, next, next - current);
  }

  remove(itemId: string, quantity?: number): ItemGrantResult {
    this.#require(itemId);
    const step = quantity ?? 1;
    const current = this.count(itemId);
    const next = Math.max(0, current - step);
    return this.#set(itemId, next, next - current);
  }

  canConsume(itemId: string, quantity?: number): boolean {
    const def = this.#defs.get(itemId);
    return Boolean(def?.consumable) && this.count(itemId) >= (quantity ?? 1);
  }

  consume(itemId: string, quantity?: number, effectContext?: ItemEffectContext): ItemConsumeResult {
    const def = this.#require(itemId);
    const step = quantity ?? 1;
    if (!def.consumable || this.count(itemId) < step) {
      return { itemId, count: this.count(itemId), consumed: false, effects: { applied: [], skipped: [] } };
    }
    this.remove(itemId, step);
    const effects = this.applyEffects(def.effects ?? [], effectContext);
    this.#events.emit('items:consumed', { itemId, count: this.count(itemId) });
    return { itemId, count: this.count(itemId), consumed: true, effects };
  }

  applyEffects(effects: readonly EffectDefinition[], effectContext?: ItemEffectContext): ApplyEffectsResult {
    const applied: EffectKind[] = [];
    const skipped: SkippedEffect[] = [];
    for (const effect of effects) {
      if (effect.kind === 'chain') {
        for (const leaf of effect.effects) this.#applyLeaf(leaf, effectContext, applied, skipped);
      } else {
        this.#applyLeaf(effect, effectContext, applied, skipped);
      }
    }
    return { applied, skipped };
  }

  #applyLeaf(
    effect: LeafEffectDefinition,
    ctx: ItemEffectContext | undefined,
    applied: EffectKind[],
    skipped: SkippedEffect[],
  ): void {
    const capability = EFFECT_CAPABILITY_REQUIREMENT[effect.kind];
    if (!this.#capabilities.has(capability)) {
      skipped.push({ kind: effect.kind, reason: 'missing-capability', capability });
      return;
    }
    switch (effect.kind) {
      case 'combat.heal': {
        if (!ctx?.combatTargetId) return skipMissingContext(effect.kind, skipped);
        this.#capabilities.require<CombatService>(capability).heal(ctx.combatTargetId, effect.amount);
        break;
      }
      case 'combat.invulnerable': {
        if (!ctx?.combatTargetId || ctx.nowMs === undefined) return skipMissingContext(effect.kind, skipped);
        this.#capabilities.require<CombatService>(capability).setInvulnerableFor(ctx.combatTargetId, effect.durationMs, ctx.nowMs);
        break;
      }
      case 'progression.currency':
        this.#capabilities.require<ProgressionService>(capability).addCurrency(effect.amount);
        break;
      case 'progression.xp':
        this.#capabilities.require<ProgressionService>(capability).addXp(effect.amount);
        break;
      case 'progression.item':
        this.#capabilities.require<ProgressionService>(capability).addItem(effect.itemId, effect.amount);
        break;
      case 'arcade.score':
        this.#capabilities.require<ArcadeService>(capability).addScore(effect.amount);
        break;
      case 'simulation.resource':
        this.#capabilities.require<SimulationService>(capability).addResource(effect.resourceId, effect.amount);
        break;
      case 'world.flag':
        this.#capabilities.require<WorldService>(capability).setFlag(effect.flag, effect.value);
        break;
    }
    applied.push(effect.kind);
  }

  #require(itemId: string): ItemDefinition {
    const def = this.#defs.get(itemId);
    if (!def) throw new UnknownItemError(itemId);
    return def;
  }

  #set(itemId: string, next: number, delta: number): ItemGrantResult {
    if (delta !== 0) {
      if (next === 0) this.#counts.delete(itemId);
      else this.#counts.set(itemId, next);
      this.#events.emit('items:countChanged', { itemId, count: next, delta });
      this.#persist();
    }
    return { itemId, count: next, granted: delta };
  }

  #persist(): void {
    this.#saves?.save<ItemsSave>(ITEMS_SAVE_SLOT, { schemaVersion: ITEMS_SAVE_VERSION, counts: this.inventory() });
  }
}

function skipMissingContext(kind: EffectKind, skipped: SkippedEffect[]): void {
  skipped.push({ kind, reason: 'missing-context' });
}

export const itemsPack: SystemPackDefinition<ItemsConfig, GameContext> = {
  id: PACK_IDS.items,
  version: '0.1.0',
  provides: [CAPABILITY_IDS.items],
  dependencies: [],
  configSchemaId: ITEMS_CONFIG_SCHEMA_ID,

  install(context: GameContext, config: ItemsConfig): InstalledSystemPack {
    const catalog = context.content.data['items']?.value as ItemCatalog | undefined;
    const saves = config?.persist ? context.saves : undefined;
    const service = new ItemsServiceImpl(context.events, context.capabilities, catalog, saves);
    const handle = context.capabilities.provide(CAPABILITY_IDS.items, service);
    return {
      id: PACK_IDS.items,
      dispose(): void {
        handle.dispose();
      },
    };
  },
};

export type { ItemsService } from '@sw2d/contracts';
