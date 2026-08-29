/**
 * Strategy orders & tactical actions (capability program Phase 14).
 *
 * Renderer-neutral. Two capabilities, deliberately separate:
 *
 * - `strategy.orders` owns *command lifecycle*: what an actor has been told to
 *   do, in what order, whether it is queued/active/finished, and why it failed.
 *   It is the RTS half - continuous, tick-driven, many actors at once.
 * - `strategy.tactics` owns *bounded discrete actions*: range, cost, cooldown,
 *   uses-per-turn, target legality, and a validity verdict a UI can show before
 *   the player commits. It is the turn-based half, and it issues orders through
 *   `strategy.orders` rather than reimplementing them.
 *
 * Both sit above `sw2d.strategy` (`strategy.turns`), which keeps owning teams,
 * turn rotation and the single-entity cursor selection. Nothing here duplicates
 * that: orders address actors by explicit id or by a named group.
 *
 * Neither service moves anything, damages anything, or knows what a sprite is.
 * World effects go through one small, typed seam - `OrderWorldAdapter` - which
 * the consuming game implements. That is the whole authority split:
 *
 *   OrdersService owns   -> order records, ids, queue order, status transitions,
 *                           tick counter, failure reasons, history.
 *   The adapter owns     -> where an actor is, whether it is alive, and what one
 *                           tick of "move"/"attack"/... actually does.
 *
 * An adapter can therefore refuse or complete an order, but it can never put an
 * order into a state the service did not author, and it is never asked to
 * remember queue positions.
 *
 * Determinism rules (all enforced by the service, all observable):
 * - Order ids are `ord-<n>` from a monotonic counter that only `reset()` rewinds.
 * - `tick()` counts `update()` calls. Cooldowns and issued/resolved stamps are in
 *   ticks, never wall clock, so a fixed-step QA harness and a real browser agree.
 * - Within one tick, actors are advanced in ascending actor-id order.
 * - Within one `issue()` call, orders are created in the caller's actor order,
 *   after duplicate actor ids are dropped keeping the first occurrence.
 */

export const STRATEGY_ORDERS_CAPABILITY_ID = 'strategy.orders';
export const STRATEGY_TACTICS_CAPABILITY_ID = 'strategy.tactics';

// --- Targets -------------------------------------------------------------

/**
 * Everything an order can point at. `none` is a real member, not a null hole:
 * `hold` and `stop` are legitimately targetless, and a self-buff tactical
 * action should not have to invent a position to satisfy the type.
 */
export type OrderTarget =
  | { readonly kind: 'none' }
  | { readonly kind: 'position'; readonly x: number; readonly y: number }
  | { readonly kind: 'entity'; readonly entityId: string }
  | { readonly kind: 'region'; readonly x: number; readonly y: number; readonly width: number; readonly height: number }
  /** A normalized-ish direction. The service does not require unit length; consumers may. */
  | { readonly kind: 'direction'; readonly dx: number; readonly dy: number };

export type OrderTargetKind = OrderTarget['kind'];

export const ORDER_TARGET_KINDS: readonly OrderTargetKind[] = [
  'none',
  'position',
  'entity',
  'region',
  'direction',
];

/** Centre point of a target, or null for targets that have no position (`none`, `direction`). */
export function orderTargetPoint(target: OrderTarget): { readonly x: number; readonly y: number } | null {
  switch (target.kind) {
    case 'position':
      return { x: target.x, y: target.y };
    case 'region':
      return { x: target.x + target.width / 2, y: target.y + target.height / 2 };
    case 'entity':
    case 'direction':
    case 'none':
      return null;
  }
}

// --- Order kinds, status, failure ----------------------------------------

export type OrderKind =
  | 'move'
  | 'attack'
  | 'attack-move'
  | 'hold'
  | 'stop'
  | 'interact'
  | 'guard'
  | 'ability';

export const ORDER_KINDS: readonly OrderKind[] = [
  'move',
  'attack',
  'attack-move',
  'hold',
  'stop',
  'interact',
  'guard',
  'ability',
];

export type OrderStatus = 'queued' | 'active' | 'completed' | 'cancelled' | 'failed';

/** Terminal statuses. An order in one of these never transitions again. */
export function isResolvedOrderStatus(status: OrderStatus): boolean {
  return status === 'completed' || status === 'cancelled' || status === 'failed';
}

export type OrderFailureReason =
  /** The request itself was malformed or pointed at something that never existed. */
  | 'invalid-target'
  /** The target existed when issued and has since died or been removed. */
  | 'target-lost'
  /** The ordered actor died or was removed. */
  | 'actor-removed'
  | 'out-of-range'
  /** The adapter could not find a route. */
  | 'unreachable'
  | 'insufficient-resource'
  | 'on-cooldown'
  /** Rules said no: wrong team, no such ability, adapter refused. */
  | 'not-permitted'
  /** Displaced by a later `replace` order rather than failing on its own merits. */
  | 'superseded';

/** How a newly issued order interacts with what the actor is already doing. */
export type OrderQueueMode =
  /** Default. Cancel the active order and the whole queue, then run this one. */
  | 'replace'
  /** Run after everything already queued. */
  | 'append'
  /** Jump the queue, but let the currently active order finish first. */
  | 'front';

export const ORDER_QUEUE_MODES: readonly OrderQueueMode[] = ['replace', 'append', 'front'];

// --- Order record --------------------------------------------------------

export interface StrategyOrder {
  readonly orderId: string;
  readonly kind: OrderKind;
  readonly actorId: string;
  readonly target: OrderTarget;
  readonly status: OrderStatus;
  /** Tick the order was created on. */
  readonly issuedTick: number;
  /** Tick it first became `active`, or null while still queued. */
  readonly startedTick: number | null;
  /** Tick it reached a terminal status, or null while it is queued or active. */
  readonly resolvedTick: number | null;
  /** Higher runs first among queued orders of the same actor. Default 0. */
  readonly priority: number;
  /** Set for `kind: 'ability'` orders issued through `strategy.tactics`. */
  readonly abilityId?: string;
  /** Only ever set alongside a `failed` or `cancelled` status. */
  readonly failureReason?: OrderFailureReason;
}

export interface OrderIssueRequest {
  readonly kind: OrderKind;
  /** Explicit actors. Duplicates are dropped keeping the first occurrence. */
  readonly actors?: readonly string[];
  /** A group registered with `defineGroup`. Merged after `actors`, then deduplicated. */
  readonly groupId?: string;
  /** Defaults to `{ kind: 'none' }`. */
  readonly target?: OrderTarget;
  /** Defaults to the pack's configured queue mode (`'replace'` unless overridden). */
  readonly queueMode?: OrderQueueMode;
  readonly priority?: number;
  readonly abilityId?: string;
}

export interface OrderRejection {
  readonly actorId: string;
  readonly reason: OrderFailureReason;
  readonly detail?: string;
}

export interface OrderIssueResult {
  /** One order per accepted actor, in the resolved actor order. */
  readonly accepted: readonly StrategyOrder[];
  readonly rejected: readonly OrderRejection[];
}

// --- World adapter (the authority seam) ----------------------------------

export interface OrderActorSnapshot {
  readonly actorId: string;
  readonly x: number;
  readonly y: number;
  readonly alive: boolean;
  readonly teamId?: string;
}

export type OrderProgress = 'running' | 'complete' | 'failed';

export interface OrderExecutionOutcome {
  readonly progress: OrderProgress;
  /** Required when `progress === 'failed'`; ignored otherwise. */
  readonly reason?: OrderFailureReason;
}

/**
 * The one seam between order bookkeeping and the game world.
 *
 * Implementations must be pure with respect to the order record: they receive a
 * frozen snapshot and report progress. They must not mutate the order, and the
 * service never asks them about queueing, priority or ids.
 */
export interface OrderWorldAdapter {
  /** Unknown or removed actors return undefined; the service then fails their orders with `actor-removed`. */
  actor(actorId: string): OrderActorSnapshot | undefined;
  /** Called once when an order becomes active, before its first `advance`. */
  begin?(order: StrategyOrder): OrderExecutionOutcome;
  /** Called once per tick while an order is active. */
  advance(order: StrategyOrder, deltaMs: number): OrderExecutionOutcome;
  /** Called when an active order leaves `active` for any reason, including completion. */
  end?(order: StrategyOrder, status: OrderStatus): void;
}

// --- Groups --------------------------------------------------------------

export interface OrderGroup {
  readonly groupId: string;
  readonly actorIds: readonly string[];
}

// --- Orders service ------------------------------------------------------

export interface StrategyOrdersService {
  /** Install the world seam. One adapter at a time; dispose to detach. */
  setWorldAdapter(adapter: OrderWorldAdapter): { dispose(): void };
  hasWorldAdapter(): boolean;

  /**
   * The adapter's current view of an actor, or undefined when there is no
   * adapter or the adapter does not know the actor. Exposed because the order
   * service is the single authority on "where is this actor" - `strategy.tactics`
   * and any range indicator read it here rather than keeping a second answer.
   */
  actorSnapshot(actorId: string): OrderActorSnapshot | undefined;

  issue(request: OrderIssueRequest): OrderIssueResult;
  /** Cancels one order whether queued or active. Returns false if unknown or already resolved. */
  cancel(orderId: string): boolean;
  /** Cancels the active order and the whole queue for an actor. Returns how many were cancelled. */
  stop(actorId: string): number;

  order(orderId: string): StrategyOrder | undefined;
  /** The order currently executing for an actor, if any. */
  active(actorId: string): StrategyOrder | undefined;
  /** Pending orders for an actor, in execution order. Excludes the active one. */
  queue(actorId: string): readonly StrategyOrder[];
  /** Every unresolved order (active + queued), in ascending actor id then execution order. */
  pending(): readonly StrategyOrder[];
  /** Resolved orders, newest last, bounded by the pack's `historyLimit`. */
  history(): readonly StrategyOrder[];
  /** Actors with at least one unresolved order, ascending. */
  actors(): readonly string[];

  defineGroup(groupId: string, actorIds: readonly string[]): OrderGroup;
  group(groupId: string): OrderGroup | undefined;
  removeGroup(groupId: string): boolean;
  groupIds(): readonly string[];

  /** Number of `update()` calls since install or the last `reset()`. */
  tick(): number;
  /** Drops every order, group, the history and the tick counter. Keeps the adapter. */
  reset(): void;
}

// --- Tactical actions ----------------------------------------------------

export type TacticalTargeting = OrderTargetKind;

/** Which actors an action may legally be pointed at, relative to the acting unit. */
export type TacticalTargetFilter = 'any' | 'ally' | 'enemy' | 'self' | 'empty';

export const TACTICAL_TARGET_FILTERS: readonly TacticalTargetFilter[] = [
  'any',
  'ally',
  'enemy',
  'self',
  'empty',
];

export interface TacticalActionDefinition {
  readonly id: string;
  readonly displayName?: string;
  /** Order raised on success. Defaults to `'ability'`. */
  readonly orderKind?: OrderKind;
  readonly targeting: TacticalTargeting;
  /** World-unit reach. 0 means self / targetless only. */
  readonly range: number;
  /** Optional lower bound - a mortar that cannot fire at its own feet. */
  readonly minRange?: number;
  /** Action points spent. Defaults to 1 for a costed system, 0 for a free action. */
  readonly cost?: number;
  /** Ticks before the same actor may use this action again. */
  readonly cooldownTicks?: number;
  /** Hard cap per turn refresh, independent of points. */
  readonly usesPerTurn?: number;
  /** Only actors on this team may use it. */
  readonly requiresTeam?: string;
  readonly targetFilter?: TacticalTargetFilter;
}

export interface StrategyActionsDocument {
  readonly schemaVersion: 1;
  /** Points restored to every actor by `refresh()`. Defaults to 0 (uncosted). */
  readonly actionPointsPerTurn?: number;
  readonly actions: readonly TacticalActionDefinition[];
}

export type TacticalInvalidReason =
  | 'unknown-action'
  | 'unknown-actor'
  | 'actor-removed'
  | 'invalid-target'
  | 'target-lost'
  | 'out-of-range'
  | 'too-close'
  | 'on-cooldown'
  | 'no-uses-remaining'
  | 'insufficient-points'
  | 'wrong-team'
  | 'no-world-adapter';

/**
 * The answer a targeting UI needs *before* the player commits: legal or not,
 * why not, and the numbers it wants to show (distance, remaining cooldown,
 * remaining uses, what it would cost).
 */
export interface TacticalValidity {
  readonly valid: boolean;
  readonly reason?: TacticalInvalidReason;
  /** Distance from actor to target, when both have positions. */
  readonly distance?: number;
  readonly remainingCooldown: number;
  readonly remainingUses: number;
  readonly cost: number;
  readonly points: number;
}

export interface TacticalExecutionResult {
  readonly ok: boolean;
  readonly actionId: string;
  readonly actorId: string;
  readonly reason?: TacticalInvalidReason;
  /** Action points actually spent. 0 on failure. */
  readonly spent: number;
  /** Tick at which the action becomes usable again. Equal to the current tick when uncooled. */
  readonly cooldownUntilTick: number;
  /** The order raised on success, if the action produced one. */
  readonly orderId?: string;
}

export interface StrategyTacticsService {
  definitions(): readonly TacticalActionDefinition[];
  definition(actionId: string): TacticalActionDefinition | undefined;
  /** Action ids this actor could use right now (team, points, cooldown, uses), ascending. */
  available(actorId: string): readonly string[];
  validate(actionId: string, actorId: string, target: OrderTarget): TacticalValidity;
  /** Validates, spends, starts the cooldown, and issues the action's order. */
  execute(actionId: string, actorId: string, target: OrderTarget): TacticalExecutionResult;

  points(actorId: string): number;
  setPoints(actorId: string, points: number): void;
  /** Turn refresh: restore points and per-turn uses for one actor, or all of them. */
  refresh(actorId?: string): void;
  /** Ticks until this actor may use this action again. 0 when ready. */
  cooldown(actionId: string, actorId: string): number;
  /** Uses left this turn. `Infinity` when the action declares no `usesPerTurn`. */
  usesRemaining(actionId: string, actorId: string): number;
  reset(): void;
}

// --- Document validation -------------------------------------------------

export class InvalidStrategyActionsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidStrategyActionsError';
  }
}

/**
 * Semantic checks the JSON schema cannot express: unique ids, and range/cost
 * relationships that are only wrong relative to another field. Shape and enum
 * membership are the schema's job (`content-strategy-actions:v1`); this is the
 * second gate, run by the pack at install time so a malformed catalog fails at
 * boot with a located message instead of mid-battle.
 */
export function validateStrategyActionsDocument(doc: StrategyActionsDocument): void {
  if (!Array.isArray(doc.actions)) {
    throw new InvalidStrategyActionsError('actions must be an array.');
  }
  if (doc.actionPointsPerTurn !== undefined && (!Number.isFinite(doc.actionPointsPerTurn) || doc.actionPointsPerTurn < 0)) {
    throw new InvalidStrategyActionsError(`actionPointsPerTurn must be >= 0 (got ${String(doc.actionPointsPerTurn)}).`);
  }
  const seen = new Set<string>();
  for (const action of doc.actions) {
    if (seen.has(action.id)) {
      throw new InvalidStrategyActionsError(`Duplicate tactical action id: "${action.id}".`);
    }
    seen.add(action.id);
    if (!Number.isFinite(action.range) || action.range < 0) {
      throw new InvalidStrategyActionsError(`Action "${action.id}": range must be >= 0 (got ${String(action.range)}).`);
    }
    if (action.minRange !== undefined) {
      if (!Number.isFinite(action.minRange) || action.minRange < 0) {
        throw new InvalidStrategyActionsError(`Action "${action.id}": minRange must be >= 0 (got ${String(action.minRange)}).`);
      }
      if (action.minRange > action.range) {
        throw new InvalidStrategyActionsError(
          `Action "${action.id}": minRange (${action.minRange}) must not exceed range (${action.range}).`,
        );
      }
    }
    if (action.cost !== undefined && (!Number.isFinite(action.cost) || action.cost < 0)) {
      throw new InvalidStrategyActionsError(`Action "${action.id}": cost must be >= 0 (got ${String(action.cost)}).`);
    }
    if (action.cooldownTicks !== undefined && (!Number.isInteger(action.cooldownTicks) || action.cooldownTicks < 0)) {
      throw new InvalidStrategyActionsError(
        `Action "${action.id}": cooldownTicks must be a non-negative integer (got ${String(action.cooldownTicks)}).`,
      );
    }
    if (action.usesPerTurn !== undefined && (!Number.isInteger(action.usesPerTurn) || action.usesPerTurn < 1)) {
      throw new InvalidStrategyActionsError(
        `Action "${action.id}": usesPerTurn must be an integer >= 1 (got ${String(action.usesPerTurn)}).`,
      );
    }
    if (action.targeting === 'none' && action.range > 0) {
      throw new InvalidStrategyActionsError(
        `Action "${action.id}": targeting "none" cannot declare a range (got ${action.range}).`,
      );
    }
  }
}

/**
 * Distance between an actor and a target, or null when the pair has no
 * comparable geometry (`none`/`direction` targets, or an entity the adapter
 * cannot locate). Pure; shared by the tactics service and by consumers that
 * want to draw a range indicator without duplicating the rule.
 */
export function orderTargetDistance(
  from: { readonly x: number; readonly y: number },
  target: OrderTarget,
  locate: (entityId: string) => { readonly x: number; readonly y: number } | undefined,
): number | null {
  if (target.kind === 'entity') {
    const at = locate(target.entityId);
    return at ? Math.hypot(at.x - from.x, at.y - from.y) : null;
  }
  const point = orderTargetPoint(target);
  return point ? Math.hypot(point.x - from.x, point.y - from.y) : null;
}
