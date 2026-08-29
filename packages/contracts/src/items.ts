/**
 * Data-driven items, effects and pickups.
 *
 * One canonical item/effect model so collectathons, pickups, keys, power-ups,
 * kart items and future inventory systems do not invent incompatible schemas.
 *
 * Definitions are validated serialized content (`content/items.json`,
 * schema `item-catalog`); the reusable `ItemsService` (`sw2d.items`) consumes
 * them. Effects are a **bounded discriminated union** - built-in kinds only,
 * no embedded scripting language. Each kind names the capability it needs;
 * an effect whose capability is absent is skipped deterministically and
 * reported, never silently dropped and never a throw.
 */

/** Capability id the `sw2d.items` pack publishes. Mirrors `CAPABILITY_IDS.items` in `@sw2d/packs`. */
export const ITEMS_CAPABILITY_ID = 'items.state';

/** Coarse grouping, for UI filtering and pickup behaviour. Open-ended string, not an enum. */
export type ItemCategory = string;

// --- Effects (bounded union) ---------------------------------------------

export interface HealEffect {
  readonly kind: 'combat.heal';
  /** Health restored on the effect's combat target. */
  readonly amount: number;
}
export interface InvulnerableEffect {
  readonly kind: 'combat.invulnerable';
  readonly durationMs: number;
}
export interface CurrencyEffect {
  readonly kind: 'progression.currency';
  /** May be negative (a cost). Clamped at zero by the progression service. */
  readonly amount: number;
}
export interface XpEffect {
  readonly kind: 'progression.xp';
  readonly amount: number;
}
export interface ProgressionItemEffect {
  readonly kind: 'progression.item';
  readonly itemId: string;
  readonly amount: number;
}
export interface ScoreEffect {
  readonly kind: 'arcade.score';
  readonly amount: number;
}
export interface ResourceEffect {
  readonly kind: 'simulation.resource';
  readonly resourceId: string;
  readonly amount: number;
}
export interface WorldFlagEffect {
  readonly kind: 'world.flag';
  readonly flag: string;
  readonly value: boolean;
}
export interface ChainEffect {
  readonly kind: 'chain';
  /** Applied in array order, deterministically. */
  readonly effects: readonly LeafEffectDefinition[];
}

/** Every effect except `chain` (chains do not nest, to keep the model bounded). */
export type LeafEffectDefinition =
  | HealEffect
  | InvulnerableEffect
  | CurrencyEffect
  | XpEffect
  | ProgressionItemEffect
  | ScoreEffect
  | ResourceEffect
  | WorldFlagEffect;

export type EffectDefinition = LeafEffectDefinition | ChainEffect;

export type EffectKind = EffectDefinition['kind'];

/**
 * Which capability id each effect kind requires. `chain` requires nothing of
 * its own - each child is checked individually.
 */
export const EFFECT_CAPABILITY_REQUIREMENT: Readonly<Record<Exclude<EffectKind, 'chain'>, string>> = {
  'combat.heal': 'combat.health',
  'combat.invulnerable': 'combat.health',
  'progression.currency': 'progression.state',
  'progression.xp': 'progression.state',
  'progression.item': 'progression.state',
  'arcade.score': 'arcade.score',
  'simulation.resource': 'simulation.resources',
  'world.flag': 'world.state',
};

// --- Item definitions --------------------------------------------------

export interface ItemDefinition {
  readonly id: string;
  readonly displayName: string;
  readonly category: ItemCategory;
  readonly tags?: readonly string[];
  /** Semantic asset role for presentation (authoring-only; runtime resolves it through the theme). */
  readonly assetRole?: string;
  /** Whether multiple units share one inventory slot. Purely descriptive today. */
  readonly stackable: boolean;
  /** Cap on the held count. Omit for no cap. */
  readonly maxCount?: number;
  /** Units added per pickup / grant when a caller does not specify one. Default 1. */
  readonly quantityPerGrant?: number;
  /** True if consuming the item removes one unit and applies its effects. */
  readonly consumable: boolean;
  /** Effects applied when the item is consumed (or on pickup, if the game chooses). */
  readonly effects?: readonly EffectDefinition[];
  /** Arbitrary author metadata carried through untouched. */
  readonly metadata?: Readonly<Record<string, string | number | boolean>>;
}

/** The validated `content/items.json` document. */
export interface ItemCatalog {
  readonly schemaVersion: number;
  readonly items: readonly ItemDefinition[];
}

// --- Service ---------------------------------------------------------

/** Context an effect application may need (a combat target, a simulation clock). */
export interface ItemEffectContext {
  /** Combat entity id that `combat.heal` / `combat.invulnerable` act on. */
  readonly combatTargetId?: string;
  /** Caller-supplied simulation time for `combat.invulnerable`. Never the wall clock. */
  readonly nowMs?: number;
}

export interface SkippedEffect {
  readonly kind: EffectKind;
  /** `'missing-capability'` (with `capability`) or `'missing-context'` (e.g. no combat target). */
  readonly reason: 'missing-capability' | 'missing-context';
  readonly capability?: string;
}

export interface ApplyEffectsResult {
  readonly applied: readonly EffectKind[];
  readonly skipped: readonly SkippedEffect[];
}

export interface ItemGrantResult {
  readonly itemId: string;
  readonly count: number;
  readonly granted: number;
}

export interface ItemConsumeResult {
  readonly itemId: string;
  readonly count: number;
  readonly consumed: boolean;
  readonly effects: ApplyEffectsResult;
}

export interface ItemsService {
  /** The validated definition, or undefined for an unknown id. */
  lookup(itemId: string): ItemDefinition | undefined;
  /** Every defined item id, sorted. */
  definitionIds(): readonly string[];
  count(itemId: string): number;
  /** All held items with a positive count, `{ itemId: count }`. */
  inventory(): Readonly<Record<string, number>>;
  /** Adds `quantity` (default the item's `quantityPerGrant`), clamped to `maxCount`. Throws for an unknown id. */
  grant(itemId: string, quantity?: number): ItemGrantResult;
  /** Removes up to `quantity` units, clamped at zero. Throws for an unknown id. */
  remove(itemId: string, quantity?: number): ItemGrantResult;
  /** Whether at least `quantity` units are held and the item is consumable. */
  canConsume(itemId: string, quantity?: number): boolean;
  /** Removes one unit (or `quantity`) and applies the item's effects. No-op result if not consumable / insufficient. */
  consume(itemId: string, quantity?: number, effectContext?: ItemEffectContext): ItemConsumeResult;
  /** Apply an arbitrary effect list directly (used for on-pickup effects and by other systems). */
  applyEffects(effects: readonly EffectDefinition[], effectContext?: ItemEffectContext): ApplyEffectsResult;
}
