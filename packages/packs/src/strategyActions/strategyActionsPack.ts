import type {
  EventBus,
  GameContext,
  InstalledSystemPack,
  OrderExecutionOutcome,
  OrderFailureReason,
  OrderGroup,
  OrderIssueRequest,
  OrderActorSnapshot,
  OrderIssueResult,
  OrderQueueMode,
  OrderRejection,
  OrderStatus,
  OrderTarget,
  OrderWorldAdapter,
  StrategyActionsDocument,
  StrategyOrder,
  StrategyOrdersService,
  StrategyTacticsService,
  SystemPackDefinition,
  TacticalActionDefinition,
  TacticalExecutionResult,
  TacticalInvalidReason,
  TacticalValidity,
} from '@sw2d/contracts';
import { orderTargetDistance, validateStrategyActionsDocument } from '@sw2d/contracts';
import { registerSchema } from '@sw2d/schemas';
import { CAPABILITY_IDS, PACK_IDS } from '../ids.ts';
import strategyActionsConfigSchema from '../../schemas/strategy-actions-config.schema.json' with { type: 'json' };

export const STRATEGY_ACTIONS_CONFIG_SCHEMA_ID = strategyActionsConfigSchema.$id;
registerSchema(strategyActionsConfigSchema);

const DEFAULT_HISTORY_LIMIT = 64;
const DEFAULT_QUEUE_MODE: OrderQueueMode = 'replace';

export interface StrategyActionsConfig {
  readonly defaultQueueMode?: OrderQueueMode;
  readonly historyLimit?: number;
}

export class MissingWorldAdapterError extends Error {
  constructor() {
    super(
      'strategy.orders has no OrderWorldAdapter. Call setWorldAdapter() before issuing orders - ' +
        'the service owns order lifecycle, the adapter owns where actors are and what a tick of work does.',
    );
    this.name = 'MissingWorldAdapterError';
  }
}

export class WorldAdapterAlreadySetError extends Error {
  constructor() {
    super('strategy.orders already has an OrderWorldAdapter. Dispose the existing handle before setting another.');
    this.name = 'WorldAdapterAlreadySetError';
  }
}

export class DuplicateOrderGroupError extends Error {
  constructor(groupId: string) {
    super(`Order group "${groupId}" is already defined.`);
    this.name = 'DuplicateOrderGroupError';
  }
}

export class UnknownOrderGroupError extends Error {
  constructor(groupId: string) {
    super(`Unknown order group: "${groupId}".`);
    this.name = 'UnknownOrderGroupError';
  }
}

interface MutableOrder {
  orderId: string;
  kind: StrategyOrder['kind'];
  actorId: string;
  target: OrderTarget;
  status: OrderStatus;
  issuedTick: number;
  startedTick: number | null;
  resolvedTick: number | null;
  priority: number;
  abilityId?: string;
  failureReason?: OrderFailureReason;
}

function freeze(order: MutableOrder): StrategyOrder {
  return Object.freeze({
    orderId: order.orderId,
    kind: order.kind,
    actorId: order.actorId,
    target: order.target,
    status: order.status,
    issuedTick: order.issuedTick,
    startedTick: order.startedTick,
    resolvedTick: order.resolvedTick,
    priority: order.priority,
    ...(order.abilityId !== undefined ? { abilityId: order.abilityId } : {}),
    ...(order.failureReason !== undefined ? { failureReason: order.failureReason } : {}),
  });
}

/** Per-actor command state. The queue is kept sorted by (priority desc, sequence asc). */
interface ActorLane {
  active: MutableOrder | null;
  queue: MutableOrder[];
}

/**
 * Order lifecycle for RTS and tactics units.
 *
 * Owns ids, queue order, status transitions, the tick counter and the failure
 * vocabulary. Delegates every world question - where is this actor, is it still
 * alive, what does one tick of "move" do - to a single `OrderWorldAdapter`, so
 * the same service drives a continuous RTS and a discrete tactics grid without
 * knowing which it is in.
 */
export class StrategyOrdersServiceImpl implements StrategyOrdersService {
  readonly #orders = new Map<string, MutableOrder>();
  readonly #lanes = new Map<string, ActorLane>();
  readonly #groups = new Map<string, readonly string[]>();
  readonly #history: MutableOrder[] = [];
  readonly #historyLimit: number;
  readonly #defaultQueueMode: OrderQueueMode;

  readonly #events: EventBus | undefined;

  #adapter: OrderWorldAdapter | null = null;
  #nextOrderId = 1;
  #tick = 0;

  constructor(config?: StrategyActionsConfig, events?: EventBus) {
    this.#historyLimit = config?.historyLimit ?? DEFAULT_HISTORY_LIMIT;
    this.#defaultQueueMode = config?.defaultQueueMode ?? DEFAULT_QUEUE_MODE;
    this.#events = events;
  }

  setWorldAdapter(adapter: OrderWorldAdapter): { dispose(): void } {
    if (this.#adapter) throw new WorldAdapterAlreadySetError();
    this.#adapter = adapter;
    return {
      dispose: () => {
        if (this.#adapter === adapter) this.#adapter = null;
      },
    };
  }

  hasWorldAdapter(): boolean {
    return this.#adapter !== null;
  }

  actorSnapshot(actorId: string): OrderActorSnapshot | undefined {
    return this.#adapter?.actor(actorId);
  }

  tick(): number {
    return this.#tick;
  }

  // --- Issuing ----------------------------------------------------------

  issue(request: OrderIssueRequest): OrderIssueResult {
    const adapter = this.#adapter;
    if (!adapter) throw new MissingWorldAdapterError();

    const actors = this.#resolveActors(request);
    const accepted: StrategyOrder[] = [];
    const rejected: OrderRejection[] = [];
    const queueMode = request.queueMode ?? this.#defaultQueueMode;

    const targetRejection = this.#validateTarget(request, adapter);

    for (const actorId of actors) {
      const snapshot = adapter.actor(actorId);
      if (!snapshot || !snapshot.alive) {
        rejected.push({ actorId, reason: 'actor-removed', detail: `Actor "${actorId}" is not present or not alive.` });
        continue;
      }
      if (targetRejection) {
        rejected.push({ actorId, ...targetRejection });
        continue;
      }
      accepted.push(this.#enqueue(actorId, request, queueMode));
    }

    return { accepted, rejected };
  }

  #validateTarget(
    request: OrderIssueRequest,
    adapter: OrderWorldAdapter,
  ): { reason: OrderFailureReason; detail: string } | null {
    const target = request.target ?? { kind: 'none' as const };
    if (target.kind === 'entity') {
      const found = adapter.actor(target.entityId);
      if (!found) {
        return { reason: 'invalid-target', detail: `No such entity: "${target.entityId}".` };
      }
      if (!found.alive) {
        return { reason: 'target-lost', detail: `Entity "${target.entityId}" is not alive.` };
      }
    }
    if (target.kind === 'region' && (target.width <= 0 || target.height <= 0)) {
      return { reason: 'invalid-target', detail: 'Region target must have positive width and height.' };
    }
    if (target.kind === 'direction' && target.dx === 0 && target.dy === 0) {
      return { reason: 'invalid-target', detail: 'Direction target must be non-zero.' };
    }
    // Kinds that structurally require a target.
    if (target.kind === 'none' && (request.kind === 'move' || request.kind === 'attack' || request.kind === 'interact')) {
      return { reason: 'invalid-target', detail: `Order kind "${request.kind}" requires a target.` };
    }
    if (request.kind === 'attack' && target.kind !== 'entity') {
      return { reason: 'invalid-target', detail: 'An "attack" order must target an entity.' };
    }
    return null;
  }

  #resolveActors(request: OrderIssueRequest): readonly string[] {
    const out: string[] = [];
    const seen = new Set<string>();
    const push = (id: string): void => {
      if (seen.has(id)) return;
      seen.add(id);
      out.push(id);
    };
    for (const id of request.actors ?? []) push(id);
    if (request.groupId !== undefined) {
      const group = this.#groups.get(request.groupId);
      if (!group) throw new UnknownOrderGroupError(request.groupId);
      for (const id of group) push(id);
    }
    return out;
  }

  #enqueue(actorId: string, request: OrderIssueRequest, queueMode: OrderQueueMode): StrategyOrder {
    const lane = this.#lane(actorId);
    const order: MutableOrder = {
      orderId: `ord-${this.#nextOrderId++}`,
      kind: request.kind,
      actorId,
      target: request.target ?? { kind: 'none' },
      status: 'queued',
      issuedTick: this.#tick,
      startedTick: null,
      resolvedTick: null,
      priority: request.priority ?? 0,
      ...(request.abilityId !== undefined ? { abilityId: request.abilityId } : {}),
    };
    this.#orders.set(order.orderId, order);
    this.#events?.emit('orders:issued', {
      orderId: order.orderId,
      actorId: order.actorId,
      kind: order.kind,
      tick: this.#tick,
    });

    // `stop` is not a queued command - it is the cancellation itself, expressed
    // as an order so the history records who asked and when.
    if (request.kind === 'stop') {
      this.#clearLane(lane, 'superseded');
      this.#resolve(order, 'completed');
      return freeze(order);
    }

    if (queueMode === 'replace') {
      this.#clearLane(lane, 'superseded');
      lane.queue.push(order);
    } else if (queueMode === 'front') {
      lane.queue.unshift(order);
    } else {
      lane.queue.push(order);
    }
    this.#sortLane(lane);
    return freeze(order);
  }

  #lane(actorId: string): ActorLane {
    let lane = this.#lanes.get(actorId);
    if (!lane) {
      lane = { active: null, queue: [] };
      this.#lanes.set(actorId, lane);
    }
    return lane;
  }

  /**
   * Higher priority first; ties broken by the order in which they entered the
   * lane. `front` inserts at index 0 and therefore wins its priority tie, which
   * is exactly what "jump the queue" means.
   */
  #sortLane(lane: ActorLane): void {
    const seq = new Map<string, number>();
    lane.queue.forEach((o, i) => seq.set(o.orderId, i));
    lane.queue.sort((a, b) => b.priority - a.priority || seq.get(a.orderId)! - seq.get(b.orderId)!);
  }

  #clearLane(lane: ActorLane, reason: OrderFailureReason): void {
    if (lane.active) {
      const active = lane.active;
      lane.active = null;
      this.#adapter?.end?.(freeze(active), 'cancelled');
      this.#resolve(active, 'cancelled', reason);
    }
    const queued = lane.queue.splice(0, lane.queue.length);
    for (const order of queued) this.#resolve(order, 'cancelled', reason);
  }

  #resolve(order: MutableOrder, status: OrderStatus, reason?: OrderFailureReason): void {
    order.status = status;
    order.resolvedTick = this.#tick;
    if (reason !== undefined) order.failureReason = reason;
    this.#history.push(order);
    while (this.#history.length > this.#historyLimit) this.#history.shift();
    if (status === 'completed' || status === 'cancelled' || status === 'failed') {
      this.#events?.emit('orders:resolved', {
        orderId: order.orderId,
        actorId: order.actorId,
        status,
        reason: order.failureReason ?? null,
        tick: this.#tick,
      });
    }
  }

  // --- Cancellation -----------------------------------------------------

  cancel(orderId: string): boolean {
    const order = this.#orders.get(orderId);
    if (!order || order.status === 'completed' || order.status === 'cancelled' || order.status === 'failed') {
      return false;
    }
    const lane = this.#lane(order.actorId);
    if (lane.active === order) {
      lane.active = null;
      this.#adapter?.end?.(freeze(order), 'cancelled');
    } else {
      const index = lane.queue.indexOf(order);
      if (index >= 0) lane.queue.splice(index, 1);
    }
    this.#resolve(order, 'cancelled');
    return true;
  }

  stop(actorId: string): number {
    const lane = this.#lanes.get(actorId);
    if (!lane) return 0;
    const count = (lane.active ? 1 : 0) + lane.queue.length;
    this.#clearLane(lane, 'superseded');
    return count;
  }

  // --- Reads ------------------------------------------------------------

  order(orderId: string): StrategyOrder | undefined {
    const order = this.#orders.get(orderId);
    return order ? freeze(order) : undefined;
  }

  active(actorId: string): StrategyOrder | undefined {
    const lane = this.#lanes.get(actorId);
    return lane?.active ? freeze(lane.active) : undefined;
  }

  queue(actorId: string): readonly StrategyOrder[] {
    return (this.#lanes.get(actorId)?.queue ?? []).map(freeze);
  }

  pending(): readonly StrategyOrder[] {
    const out: StrategyOrder[] = [];
    for (const actorId of this.actors()) {
      const lane = this.#lanes.get(actorId)!;
      if (lane.active) out.push(freeze(lane.active));
      for (const order of lane.queue) out.push(freeze(order));
    }
    return out;
  }

  history(): readonly StrategyOrder[] {
    return this.#history.map(freeze);
  }

  actors(): readonly string[] {
    const ids: string[] = [];
    for (const [actorId, lane] of this.#lanes) {
      if (lane.active || lane.queue.length > 0) ids.push(actorId);
    }
    return ids.sort();
  }

  // --- Groups -----------------------------------------------------------

  defineGroup(groupId: string, actorIds: readonly string[]): OrderGroup {
    if (this.#groups.has(groupId)) throw new DuplicateOrderGroupError(groupId);
    const deduped: string[] = [];
    const seen = new Set<string>();
    for (const id of actorIds) {
      if (seen.has(id)) continue;
      seen.add(id);
      deduped.push(id);
    }
    this.#groups.set(groupId, deduped);
    return { groupId, actorIds: deduped };
  }

  group(groupId: string): OrderGroup | undefined {
    const actorIds = this.#groups.get(groupId);
    return actorIds ? { groupId, actorIds } : undefined;
  }

  removeGroup(groupId: string): boolean {
    return this.#groups.delete(groupId);
  }

  groupIds(): readonly string[] {
    return [...this.#groups.keys()].sort();
  }

  // --- Tick -------------------------------------------------------------

  /**
   * One simulation step. Deterministic: the tick counter advances first, then
   * every actor with work is advanced in ascending actor-id order, so two runs
   * with the same issue sequence produce the same transitions regardless of the
   * order lanes happened to be created in.
   */
  update(deltaMs: number): void {
    const adapter = this.#adapter;
    if (!adapter) return;
    this.#tick += 1;

    for (const actorId of this.actors()) {
      const lane = this.#lanes.get(actorId);
      if (!lane) continue;

      const snapshot = adapter.actor(actorId);
      if (!snapshot || !snapshot.alive) {
        this.#failLane(lane, 'actor-removed');
        continue;
      }

      if (!lane.active) {
        const next = lane.queue.shift();
        if (!next) continue;
        lane.active = next;
        next.status = 'active';
        next.startedTick = this.#tick;
        const begun = adapter.begin?.(freeze(next)) ?? { progress: 'running' as const };
        if (this.#settle(lane, begun)) continue;
      }

      const current = lane.active;
      if (!current) continue;

      // A target that has died or been removed since the order was issued fails
      // the order rather than silently completing it.
      if (current.target.kind === 'entity') {
        const target = adapter.actor(current.target.entityId);
        if (!target || !target.alive) {
          lane.active = null;
          adapter.end?.(freeze(current), 'failed');
          this.#resolve(current, 'failed', 'target-lost');
          continue;
        }
      }

      this.#settle(lane, adapter.advance(freeze(current), deltaMs));
    }
  }

  /** Applies an adapter outcome to the lane's active order. Returns true if the order resolved. */
  #settle(lane: ActorLane, outcome: OrderExecutionOutcome): boolean {
    const current = lane.active;
    if (!current) return true;
    if (outcome.progress === 'running') return false;
    lane.active = null;
    if (outcome.progress === 'complete') {
      this.#adapter?.end?.(freeze(current), 'completed');
      this.#resolve(current, 'completed');
    } else {
      this.#adapter?.end?.(freeze(current), 'failed');
      this.#resolve(current, 'failed', outcome.reason ?? 'not-permitted');
    }
    return true;
  }

  #failLane(lane: ActorLane, reason: OrderFailureReason): void {
    if (lane.active) {
      const active = lane.active;
      lane.active = null;
      this.#adapter?.end?.(freeze(active), 'failed');
      this.#resolve(active, 'failed', reason);
    }
    const queued = lane.queue.splice(0, lane.queue.length);
    for (const order of queued) this.#resolve(order, 'failed', reason);
  }

  reset(): void {
    this.#orders.clear();
    this.#lanes.clear();
    this.#groups.clear();
    this.#history.length = 0;
    this.#nextOrderId = 1;
    this.#tick = 0;
  }
}

// --- Tactics -------------------------------------------------------------

interface ActorTacticalState {
  points: number;
  /** actionId -> tick at which it becomes usable again. */
  readonly cooldownUntil: Map<string, number>;
  /** actionId -> uses spent since the last refresh. */
  readonly usesSpent: Map<string, number>;
}

/**
 * Bounded discrete actions on top of the order lifecycle.
 *
 * Answers "may this actor do this here, and what would it cost" before anything
 * happens, then - on `execute` - spends the points, starts the cooldown and
 * issues the corresponding order through `strategy.orders`. It never mutates
 * world state itself and never authors order status.
 */
export class StrategyTacticsServiceImpl implements StrategyTacticsService {
  readonly #orders: StrategyOrdersServiceImpl;
  readonly #actions = new Map<string, TacticalActionDefinition>();
  readonly #pointsPerTurn: number;
  readonly #state = new Map<string, ActorTacticalState>();
  readonly #events: EventBus | undefined;

  constructor(orders: StrategyOrdersServiceImpl, doc: StrategyActionsDocument | undefined, events?: EventBus) {
    this.#orders = orders;
    this.#events = events;
    this.#pointsPerTurn = doc?.actionPointsPerTurn ?? 0;
    if (doc) {
      validateStrategyActionsDocument(doc);
      for (const action of doc.actions) this.#actions.set(action.id, Object.freeze({ ...action }));
    }
  }

  definitions(): readonly TacticalActionDefinition[] {
    return [...this.#actions.values()].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  }

  definition(actionId: string): TacticalActionDefinition | undefined {
    return this.#actions.get(actionId);
  }

  #actorState(actorId: string): ActorTacticalState {
    let state = this.#state.get(actorId);
    if (!state) {
      state = { points: this.#pointsPerTurn, cooldownUntil: new Map(), usesSpent: new Map() };
      this.#state.set(actorId, state);
    }
    return state;
  }

  #cost(action: TacticalActionDefinition): number {
    return action.cost ?? 0;
  }

  points(actorId: string): number {
    return this.#actorState(actorId).points;
  }

  setPoints(actorId: string, points: number): void {
    this.#actorState(actorId).points = Math.max(0, points);
  }

  refresh(actorId?: string): void {
    const ids = actorId !== undefined ? [actorId] : [...this.#state.keys()];
    for (const id of ids) {
      const state = this.#actorState(id);
      state.points = this.#pointsPerTurn;
      state.usesSpent.clear();
    }
  }

  cooldown(actionId: string, actorId: string): number {
    const until = this.#actorState(actorId).cooldownUntil.get(actionId) ?? 0;
    return Math.max(0, until - this.#orders.tick());
  }

  usesRemaining(actionId: string, actorId: string): number {
    const action = this.#actions.get(actionId);
    if (!action || action.usesPerTurn === undefined) return Number.POSITIVE_INFINITY;
    const spent = this.#actorState(actorId).usesSpent.get(actionId) ?? 0;
    return Math.max(0, action.usesPerTurn - spent);
  }

  available(actorId: string): readonly string[] {
    const out: string[] = [];
    for (const action of this.definitions()) {
      const verdict = this.#preflight(action, actorId);
      if (verdict === null) out.push(action.id);
    }
    return out;
  }

  /** Actor-only legality (team, points, cooldown, uses). Null when the actor could act. */
  #preflight(action: TacticalActionDefinition, actorId: string): TacticalInvalidReason | null {
    if (!this.#orders.hasWorldAdapter()) return 'no-world-adapter';
    const snapshot = this.#locate(actorId);
    if (!snapshot) return 'unknown-actor';
    if (!snapshot.alive) return 'actor-removed';
    if (action.requiresTeam !== undefined && snapshot.teamId !== action.requiresTeam) return 'wrong-team';
    if (this.cooldown(action.id, actorId) > 0) return 'on-cooldown';
    if (this.usesRemaining(action.id, actorId) <= 0) return 'no-uses-remaining';
    if (this.#cost(action) > this.points(actorId)) return 'insufficient-points';
    return null;
  }

  /**
   * The tactics service reads the world through the same adapter the orders
   * service holds, so there is exactly one answer to "where is this actor".
   */
  #locate(actorId: string): OrderActorSnapshot | undefined {
    return this.#orders.actorSnapshot(actorId);
  }

  validate(actionId: string, actorId: string, target: OrderTarget): TacticalValidity {
    const action = this.#actions.get(actionId);
    if (!action) {
      return { valid: false, reason: 'unknown-action', remainingCooldown: 0, remainingUses: 0, cost: 0, points: this.points(actorId) };
    }
    const base = {
      remainingCooldown: this.cooldown(actionId, actorId),
      remainingUses: this.usesRemaining(actionId, actorId),
      cost: this.#cost(action),
      points: this.points(actorId),
    };

    const preflight = this.#preflight(action, actorId);
    if (preflight !== null) return { valid: false, reason: preflight, ...base };

    if (target.kind !== action.targeting) {
      return { valid: false, reason: 'invalid-target', ...base };
    }

    const actor = this.#locate(actorId)!;
    const filterReason = this.#checkFilter(action, actorId, target);
    if (filterReason !== null) return { valid: false, reason: filterReason, ...base };

    const distance = orderTargetDistance(actor, target, (id) => {
      const found = this.#locate(id);
      return found ? { x: found.x, y: found.y } : undefined;
    });

    if (distance === null) {
      // Targetless and direction actions have no distance to check.
      return { valid: true, ...base };
    }
    if (distance > action.range) {
      return { valid: false, reason: 'out-of-range', distance, ...base };
    }
    if (action.minRange !== undefined && distance < action.minRange) {
      return { valid: false, reason: 'too-close', distance, ...base };
    }
    return { valid: true, distance, ...base };
  }

  #checkFilter(action: TacticalActionDefinition, actorId: string, target: OrderTarget): TacticalInvalidReason | null {
    const filter = action.targetFilter ?? 'any';
    if (filter === 'any') return null;
    if (target.kind !== 'entity') {
      // A team filter is meaningless for a position/region/direction target;
      // 'self' and 'empty' are the two that still constrain those.
      if (filter === 'self') return 'invalid-target';
      return null;
    }
    const targetId = target.entityId;
    if (filter === 'self') return targetId === actorId ? null : 'invalid-target';
    if (filter === 'empty') return 'invalid-target';

    const self = this.#locate(actorId);
    const other = this.#locate(targetId);
    if (!other) return 'target-lost';
    if (!other.alive) return 'target-lost';
    const sameTeam = self?.teamId !== undefined && self.teamId === other.teamId;
    if (filter === 'ally' && !sameTeam) return 'invalid-target';
    if (filter === 'enemy' && sameTeam) return 'invalid-target';
    return null;
  }

  execute(actionId: string, actorId: string, target: OrderTarget): TacticalExecutionResult {
    const verdict = this.validate(actionId, actorId, target);
    const tick = this.#orders.tick();
    if (!verdict.valid) {
      return {
        ok: false,
        actionId,
        actorId,
        ...(verdict.reason !== undefined ? { reason: verdict.reason } : {}),
        spent: 0,
        cooldownUntilTick: tick,
      };
    }

    const action = this.#actions.get(actionId)!;
    const state = this.#actorState(actorId);
    const cost = this.#cost(action);

    const issued = this.#orders.issue({
      kind: action.orderKind ?? 'ability',
      actors: [actorId],
      target,
      queueMode: 'replace',
      abilityId: action.id,
    });

    const order = issued.accepted[0];
    if (!order) {
      // The orders service refused it (dead actor, illegal target for that order
      // kind). Nothing is spent and no cooldown starts.
      const rejection = issued.rejected[0];
      return {
        ok: false,
        actionId,
        actorId,
        reason: rejection?.reason === 'target-lost' ? 'target-lost' : 'invalid-target',
        spent: 0,
        cooldownUntilTick: tick,
      };
    }

    state.points = Math.max(0, state.points - cost);
    state.usesSpent.set(actionId, (state.usesSpent.get(actionId) ?? 0) + 1);
    const cooldownUntilTick = tick + (action.cooldownTicks ?? 0);
    if (action.cooldownTicks !== undefined && action.cooldownTicks > 0) {
      state.cooldownUntil.set(actionId, cooldownUntilTick);
    }

    this.#events?.emit('tactics:executed', { actionId, actorId, spent: cost, orderId: order.orderId });
    return { ok: true, actionId, actorId, spent: cost, cooldownUntilTick, orderId: order.orderId };
  }

  reset(): void {
    this.#state.clear();
  }
}

export const strategyActionsPack: SystemPackDefinition<StrategyActionsConfig, GameContext> = {
  id: PACK_IDS.strategyActions,
  version: '0.1.0',
  provides: [CAPABILITY_IDS.strategyOrders, CAPABILITY_IDS.strategyTactics],
  // Order lifecycle composes with turn/team state but does not require it: a
  // continuous RTS installs this pack without sw2d.strategy.
  dependencies: [],
  configSchemaId: STRATEGY_ACTIONS_CONFIG_SCHEMA_ID,

  install(context: GameContext, config: StrategyActionsConfig): InstalledSystemPack {
    const doc = context.content.data['strategy-actions']?.value as StrategyActionsDocument | undefined;
    const orders = new StrategyOrdersServiceImpl(config, context.events);
    const tactics = new StrategyTacticsServiceImpl(orders, doc, context.events);

    const ordersHandle = context.capabilities.provide(CAPABILITY_IDS.strategyOrders, orders);
    const tacticsHandle = context.capabilities.provide(CAPABILITY_IDS.strategyTactics, tactics);

    return {
      id: PACK_IDS.strategyActions,
      update(deltaMs: number): void {
        orders.update(deltaMs);
      },
      dispose(): void {
        orders.reset();
        tactics.reset();
        tacticsHandle.dispose();
        ordersHandle.dispose();
      },
    };
  },
};

export type { StrategyOrdersService, StrategyTacticsService } from '@sw2d/contracts';
