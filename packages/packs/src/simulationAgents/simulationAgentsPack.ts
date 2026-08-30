import type {
  ActiveBehavior,
  AgentDefinition,
  AgentState,
  BehaviorCondition,
  BehaviorDefinition,
  BehaviorScore,
  EventBus,
  GameContext,
  InstalledSystemPack,
  NeedDefinition,
  NeedLevel,
  NeedState,
  RelationshipEntry,
  ScheduleBlock,
  SimulationAgentEvent,
  SimulationAgentsDocument,
  SimulationAgentsService,
  SimulationClock,
  SystemPackDefinition,
  WorkOrder,
  WorkOrderDefinition,
} from '@sw2d/contracts';
import {
  DEFAULT_DECISION_INTERVAL_MS,
  MINUTES_PER_DAY,
  behaviorScore,
  needLevel,
  needUrgency,
  scheduleBlockAt,
  selectBehavior,
  tickNeed,
  validateSimulationAgentsDocument,
} from '@sw2d/contracts';
import { registerSchema } from '@sw2d/schemas';
import { CAPABILITY_IDS, PACK_IDS } from '../ids.ts';
import simulationAgentsConfigSchema from '../../schemas/simulation-agents-config.schema.json' with { type: 'json' };

export const SIMULATION_AGENTS_CONFIG_SCHEMA_ID = simulationAgentsConfigSchema.$id;
registerSchema(simulationAgentsConfigSchema);

export interface SimulationAgentsConfig {
  /** Spawn one agent per archetype at install, keyed by the archetype id. */
  readonly autoSpawn?: boolean;
}

export class MissingSimulationAgentsDocumentError extends Error {
  constructor() {
    super(
      'sw2d.simulation-agents requires an "agents" content document. Author content/agents.json ' +
        '(urn:sw2d:schema:content-agents:v1).',
    );
    this.name = 'MissingSimulationAgentsDocumentError';
  }
}

export class UnknownAgentDefinitionError extends Error {
  constructor(definitionId: string) {
    super(`Unknown agent definition: "${definitionId}".`);
    this.name = 'UnknownAgentDefinitionError';
  }
}

export class DuplicateAgentError extends Error {
  constructor(agentId: string) {
    super(`Agent "${agentId}" already exists.`);
    this.name = 'DuplicateAgentError';
  }
}

interface LiveAgent {
  readonly agentId: string;
  readonly def: AgentDefinition;
  alive: boolean;
  tags: Set<string>;
  needs: Map<string, number>;
  levels: Map<string, NeedLevel>;
  active: {
    behavior: BehaviorDefinition;
    startedAtMs: number;
    elapsedMs: number;
    targetId: string | null;
  } | null;
  lastCompletedBehaviorId: string | null;
  /** behaviourId -> simulated ms at which it may run again. */
  cooldowns: Map<string, number>;
  scheduleActivity: string | null;
  workOrderId: string | null;
  /** Simulated ms since this agent last re-evaluated its behaviour. */
  sinceDecisionMs: number;
}

interface LiveOrder extends WorkOrderDefinition {
  state: WorkOrder['state'];
  reservedBy: string | null;
  progressMs: number;
}

/**
 * Needs, utility behaviour, schedules, relationships and work orders.
 *
 * Two costs are deliberately separated. Needs drift every tick, which is cheap
 * arithmetic. Choosing a behaviour scores every candidate against every need,
 * which is not - so it runs on a bounded interval (`decisionIntervalMs`) rather
 * than every frame. A colony of forty agents re-deciding sixty times a second is
 * the difference between a simulation and a stall.
 */
export class SimulationAgentsServiceImpl implements SimulationAgentsService {
  readonly #doc: SimulationAgentsDocument;
  readonly #events: EventBus | undefined;
  readonly #needDefs = new Map<string, NeedDefinition>();
  readonly #behaviorDefs = new Map<string, BehaviorDefinition>();
  readonly #agentDefs = new Map<string, AgentDefinition>();
  readonly #agents = new Map<string, LiveAgent>();
  readonly #orders = new Map<string, LiveOrder>();
  readonly #relationships = new Map<string, number>();
  readonly #decisionIntervalMs: number;
  readonly #minutesPerSecond: number;

  #elapsedMs = 0;
  #gameMinutes = 0;

  constructor(doc: SimulationAgentsDocument, events?: EventBus) {
    validateSimulationAgentsDocument(doc);
    this.#doc = doc;
    this.#events = events;
    this.#decisionIntervalMs = doc.decisionIntervalMs ?? DEFAULT_DECISION_INTERVAL_MS;
    this.#minutesPerSecond = doc.minutesPerSecond ?? 0;
    for (const need of doc.needs) this.#needDefs.set(need.id, need);
    for (const behavior of doc.behaviors) this.#behaviorDefs.set(behavior.id, behavior);
    for (const agent of doc.agents) this.#agentDefs.set(agent.id, agent);
    this.#resetOrders();
  }

  definition(): SimulationAgentsDocument {
    return this.#doc;
  }

  clock(): SimulationClock {
    return {
      elapsedMs: Math.round(this.#elapsedMs * 100) / 100,
      minuteOfDay: Math.floor(this.#gameMinutes % MINUTES_PER_DAY),
      day: Math.floor(this.#gameMinutes / MINUTES_PER_DAY),
    };
  }

  // --- Agents ------------------------------------------------------------

  spawn(agentId: string, definitionId: string): AgentState {
    if (this.#agents.has(agentId)) throw new DuplicateAgentError(agentId);
    const def = this.#agentDefs.get(definitionId);
    if (!def) throw new UnknownAgentDefinitionError(definitionId);

    const needs = new Map<string, number>();
    const levels = new Map<string, NeedLevel>();
    for (const needId of def.needs) {
      const needDef = this.#needDefs.get(needId)!;
      needs.set(needId, needDef.initial);
      levels.set(needId, needLevel(needDef, needDef.initial));
    }

    this.#agents.set(agentId, {
      agentId,
      def,
      alive: true,
      tags: new Set(def.tags ?? []),
      needs,
      levels,
      active: null,
      lastCompletedBehaviorId: null,
      cooldowns: new Map(),
      scheduleActivity: null,
      workOrderId: null,
      sinceDecisionMs: Number.POSITIVE_INFINITY, // decide on the first tick
    });
    return this.agent(agentId)!;
  }

  despawn(agentId: string): boolean {
    const agent = this.#agents.get(agentId);
    if (!agent) return false;
    // A departed agent must not keep an order reserved forever.
    this.#releaseOrderOf(agent, 'agent-despawned');
    this.#agents.delete(agentId);
    return true;
  }

  agent(agentId: string): AgentState | undefined {
    const agent = this.#agents.get(agentId);
    return agent ? this.#view(agent) : undefined;
  }

  agents(): readonly AgentState[] {
    return [...this.#agents.keys()].sort().map((id) => this.#view(this.#agents.get(id)!));
  }

  #view(agent: LiveAgent): AgentState {
    const needs: Record<string, NeedState> = {};
    for (const [needId, value] of agent.needs) {
      const def = this.#needDefs.get(needId)!;
      needs[needId] = {
        id: needId,
        value: Math.round(value * 100) / 100,
        urgency: Math.round(needUrgency(def, value) * 10000) / 10000,
        level: needLevel(def, value),
      };
    }
    const active: ActiveBehavior | null = agent.active
      ? {
          behaviorId: agent.active.behavior.id,
          startedAtMs: Math.round(agent.active.startedAtMs * 100) / 100,
          elapsedMs: Math.round(agent.active.elapsedMs * 100) / 100,
          durationMs: agent.active.behavior.durationMs,
          targetId: agent.active.targetId,
          interruptible: agent.active.behavior.interruptible !== false,
        }
      : null;
    return {
      agentId: agent.agentId,
      definitionId: agent.def.id,
      alive: agent.alive,
      tags: [...agent.tags].sort(),
      needs,
      active,
      lastCompletedBehaviorId: agent.lastCompletedBehaviorId,
      scheduleActivity: agent.scheduleActivity,
      workOrderId: agent.workOrderId,
    };
  }

  // --- Needs -------------------------------------------------------------

  need(agentId: string, needId: string): NeedState | undefined {
    return this.agent(agentId)?.needs[needId];
  }

  adjustNeed(agentId: string, needId: string, delta: number): NeedState | undefined {
    const agent = this.#agents.get(agentId);
    const def = this.#needDefs.get(needId);
    if (!agent || !def || !agent.needs.has(needId)) return undefined;
    this.#setNeed(agent, def, (agent.needs.get(needId) ?? def.initial) + delta);
    return this.need(agentId, needId);
  }

  #setNeed(agent: LiveAgent, def: NeedDefinition, raw: number): void {
    const value = raw < def.minimum ? def.minimum : raw > def.maximum ? def.maximum : raw;
    agent.needs.set(def.id, value);
    const level = needLevel(def, value);
    if (agent.levels.get(def.id) !== level) {
      agent.levels.set(def.id, level);
      this.#emit({ kind: 'need-level-changed', agentId: agent.agentId, needId: def.id, level });
    }
  }

  addTag(agentId: string, tag: string): boolean {
    const agent = this.#agents.get(agentId);
    if (!agent || agent.tags.has(tag)) return false;
    agent.tags.add(tag);
    return true;
  }

  removeTag(agentId: string, tag: string): boolean {
    return this.#agents.get(agentId)?.tags.delete(tag) ?? false;
  }

  // --- Behaviour selection ----------------------------------------------

  evaluate(agentId: string): readonly BehaviorScore[] {
    const agent = this.#agents.get(agentId);
    if (!agent) return [];
    const view = this.#view(agent);
    const scores: BehaviorScore[] = [];

    for (const behaviorId of agent.def.behaviors) {
      const behavior = this.#behaviorDefs.get(behaviorId)!;
      const blockedBy = this.#blockedReason(agent, behavior, view.needs);
      scores.push({
        behaviorId,
        score: behaviorScore(behavior, view.needs),
        eligible: blockedBy === null,
        blockedBy,
      });
    }
    // Sorted by id so the reported order is stable regardless of document order.
    return scores.sort((a, b) => (a.behaviorId < b.behaviorId ? -1 : 1));
  }

  /** Why a behaviour cannot run right now, or null. Named reasons, not booleans. */
  #blockedReason(
    agent: LiveAgent,
    behavior: BehaviorDefinition,
    needs: Readonly<Record<string, NeedState>>,
  ): string | null {
    const readyAt = agent.cooldowns.get(behavior.id);
    if (readyAt !== undefined && this.#elapsedMs < readyAt) return 'cooldown';
    for (const condition of behavior.preconditions ?? []) {
      if (!this.#conditionMet(agent, condition, needs)) return `precondition:${condition.kind}`;
    }
    return null;
  }

  #conditionMet(
    agent: LiveAgent,
    condition: BehaviorCondition,
    needs: Readonly<Record<string, NeedState>>,
  ): boolean {
    switch (condition.kind) {
      case 'need-below':
        return (needs[condition.needId]?.value ?? Number.POSITIVE_INFINITY) < condition.value;
      case 'need-above':
        return (needs[condition.needId]?.value ?? Number.NEGATIVE_INFINITY) > condition.value;
      case 'has-tag':
        return agent.tags.has(condition.tag);
      case 'lacks-tag':
        return !agent.tags.has(condition.tag);
      case 'schedule-activity':
        return agent.scheduleActivity === condition.activity;
      case 'target-available':
        // A target is available when some *other* living agent carries the tag.
        for (const other of this.#agents.values()) {
          if (other.agentId !== agent.agentId && other.alive && other.tags.has(condition.tag)) return true;
        }
        return false;
    }
  }

  forceBehavior(agentId: string, behaviorId: string, targetId?: string): boolean {
    const agent = this.#agents.get(agentId);
    const behavior = this.#behaviorDefs.get(behaviorId);
    if (!agent || !behavior || !agent.alive) return false;
    if (!agent.def.behaviors.includes(behaviorId)) return false;
    const view = this.#view(agent);
    if (this.#blockedReason(agent, behavior, view.needs) !== null) return false;
    this.#start(agent, behavior, targetId ?? null);
    return true;
  }

  interrupt(agentId: string): boolean {
    const agent = this.#agents.get(agentId);
    if (!agent?.active) return false;
    this.#interrupt(agent, 'explicit');
    return true;
  }

  #start(agent: LiveAgent, behavior: BehaviorDefinition, targetId: string | null): void {
    if (agent.active) this.#interrupt(agent, 'superseded');
    agent.active = { behavior, startedAtMs: this.#elapsedMs, elapsedMs: 0, targetId };
    this.#emit({ kind: 'behavior-started', agentId: agent.agentId, behaviorId: behavior.id, targetId });
  }

  #interrupt(agent: LiveAgent, reason: string): void {
    const active = agent.active;
    if (!active) return;
    agent.active = null;
    // Effects belong to completion. An interrupted behaviour applies none.
    this.#emit({ kind: 'behavior-interrupted', agentId: agent.agentId, behaviorId: active.behavior.id, reason });
  }

  #complete(agent: LiveAgent): void {
    const active = agent.active;
    if (!active) return;
    // Clear first: an effect that re-enters must not find the behaviour still
    // active and complete it a second time.
    agent.active = null;
    const behavior = active.behavior;

    for (const effect of behavior.effects ?? []) {
      switch (effect.kind) {
        case 'need-delta': {
          const def = this.#needDefs.get(effect.needId);
          if (def && agent.needs.has(effect.needId)) {
            this.#setNeed(agent, def, (agent.needs.get(effect.needId) ?? def.initial) + effect.delta);
          }
          break;
        }
        case 'need-set': {
          const def = this.#needDefs.get(effect.needId);
          if (def && agent.needs.has(effect.needId)) this.#setNeed(agent, def, effect.value);
          break;
        }
        case 'add-tag':
          agent.tags.add(effect.tag);
          break;
        case 'remove-tag':
          agent.tags.delete(effect.tag);
          break;
        case 'relationship-delta':
          if (active.targetId) {
            this.adjustRelationship(agent.agentId, active.targetId, effect.metricId, effect.delta);
          }
          break;
      }
    }

    if (behavior.cooldownMs !== undefined && behavior.cooldownMs > 0) {
      agent.cooldowns.set(behavior.id, this.#elapsedMs + behavior.cooldownMs);
    }
    agent.lastCompletedBehaviorId = behavior.id;
    this.#emit({ kind: 'behavior-completed', agentId: agent.agentId, behaviorId: behavior.id });
  }

  // --- Relationships -----------------------------------------------------

  #relKey(fromId: string, toId: string, metricId: string): string {
    return `${fromId} ${toId} ${metricId}`;
  }

  relationship(fromId: string, toId: string, metricId: string): number {
    return this.#relationships.get(this.#relKey(fromId, toId, metricId)) ?? 0;
  }

  setRelationship(fromId: string, toId: string, metricId: string, value: number): void {
    this.#relationships.set(this.#relKey(fromId, toId, metricId), value);
  }

  adjustRelationship(fromId: string, toId: string, metricId: string, delta: number): number {
    const next = this.relationship(fromId, toId, metricId) + delta;
    this.setRelationship(fromId, toId, metricId, next);
    return next;
  }

  relationships(): readonly RelationshipEntry[] {
    return [...this.#relationships.entries()]
      .map(([key, value]) => {
        const [fromId, toId, metricId] = key.split(' ');
        return { fromId: fromId!, toId: toId!, metricId: metricId!, value };
      })
      .sort((a, b) =>
        a.fromId !== b.fromId
          ? a.fromId < b.fromId
            ? -1
            : 1
          : a.toId !== b.toId
            ? a.toId < b.toId
              ? -1
              : 1
            : a.metricId < b.metricId
              ? -1
              : 1,
      );
  }

  // --- Work orders -------------------------------------------------------

  #resetOrders(): void {
    this.#orders.clear();
    for (const order of this.#doc.workOrders ?? []) {
      this.#orders.set(order.id, { ...order, state: 'open', reservedBy: null, progressMs: 0 });
    }
  }

  workOrders(): readonly WorkOrder[] {
    return [...this.#orders.values()]
      .map((order) => ({ ...order, progressMs: Math.round(order.progressMs * 100) / 100 }))
      .sort((a, b) => (a.id < b.id ? -1 : 1));
  }

  workOrder(orderId: string): WorkOrder | undefined {
    const order = this.#orders.get(orderId);
    return order ? { ...order, progressMs: Math.round(order.progressMs * 100) / 100 } : undefined;
  }

  reserveWorkOrder(orderId: string, agentId: string): boolean {
    const order = this.#orders.get(orderId);
    const agent = this.#agents.get(agentId);
    if (!order || !agent || !agent.alive) return false;
    // Exclusive by construction: only an open order can be claimed at all.
    if (order.state !== 'open') return false;
    if (agent.workOrderId !== null) return false;
    for (const tag of order.requiredAgentTags ?? []) {
      if (!agent.tags.has(tag)) return false;
    }
    order.state = 'reserved';
    order.reservedBy = agentId;
    agent.workOrderId = orderId;
    this.#emit({ kind: 'work-order-reserved', orderId, agentId });
    return true;
  }

  releaseWorkOrder(orderId: string): boolean {
    const order = this.#orders.get(orderId);
    if (!order || (order.state !== 'reserved' && order.state !== 'active')) return false;
    const owner = order.reservedBy;
    order.state = 'open';
    order.reservedBy = null;
    order.progressMs = 0;
    if (owner) {
      const agent = this.#agents.get(owner);
      if (agent) agent.workOrderId = null;
    }
    this.#emit({ kind: 'work-order-released', orderId, reason: 'released' });
    return true;
  }

  cancelWorkOrder(orderId: string): boolean {
    const order = this.#orders.get(orderId);
    if (!order || order.state === 'complete' || order.state === 'cancelled') return false;
    const owner = order.reservedBy;
    order.state = 'cancelled';
    order.reservedBy = null;
    if (owner) {
      const agent = this.#agents.get(owner);
      if (agent) agent.workOrderId = null;
    }
    this.#emit({ kind: 'work-order-released', orderId, reason: 'cancelled' });
    return true;
  }

  nextWorkOrderFor(agentId: string): WorkOrder | undefined {
    const agent = this.#agents.get(agentId);
    if (!agent || !agent.alive) return undefined;
    let best: LiveOrder | undefined;
    for (const order of this.#orders.values()) {
      if (order.state !== 'open') continue;
      if ((order.requiredAgentTags ?? []).some((tag) => !agent.tags.has(tag))) continue;
      // Highest priority wins; ties break on id so the choice is stable.
      if (!best || order.priority > best.priority || (order.priority === best.priority && order.id < best.id)) {
        best = order;
      }
    }
    return best ? { ...best } : undefined;
  }

  #releaseOrderOf(agent: LiveAgent, reason: string): void {
    if (agent.workOrderId === null) return;
    const order = this.#orders.get(agent.workOrderId);
    agent.workOrderId = null;
    if (!order || order.state === 'complete' || order.state === 'cancelled') return;
    order.state = 'open';
    order.reservedBy = null;
    order.progressMs = 0;
    this.#emit({ kind: 'work-order-released', orderId: order.id, reason });
  }

  // --- Tick --------------------------------------------------------------

  /**
   * Advance the simulation. Needs drift every call; behaviour selection runs on
   * the bounded decision interval.
   */
  update(deltaMs: number): readonly SimulationAgentEvent[] {
    if (deltaMs <= 0) return [];
    const drained = this.#pending.splice(0, this.#pending.length);
    void drained; // anything queued outside a tick is reported with this one

    this.#elapsedMs += deltaMs;
    this.#gameMinutes += (deltaMs / 1000) * this.#minutesPerSecond;
    const deltaSeconds = deltaMs / 1000;
    const minute = Math.floor(this.#gameMinutes % MINUTES_PER_DAY);

    // Deterministic order: ascending agent id, so two runs with the same inputs
    // resolve contention (work orders, targets) identically.
    for (const agentId of [...this.#agents.keys()].sort()) {
      const agent = this.#agents.get(agentId)!;
      if (!agent.alive) continue;

      for (const [needId, value] of agent.needs) {
        this.#setNeed(agent, this.#needDefs.get(needId)!, tickNeed(this.#needDefs.get(needId)!, value, deltaSeconds));
      }

      this.#advanceSchedule(agent, minute);

      if (agent.active) {
        agent.active.elapsedMs += deltaMs;
        if (agent.active.elapsedMs >= agent.active.behavior.durationMs) this.#complete(agent);
      }

      agent.sinceDecisionMs += deltaMs;
      if (agent.sinceDecisionMs >= this.#decisionIntervalMs) {
        agent.sinceDecisionMs = 0;
        this.#decide(agent);
      }

      this.#advanceWork(agent, deltaMs);
    }

    return this.#pending.splice(0, this.#pending.length);
  }

  #advanceSchedule(agent: LiveAgent, minute: number): void {
    const blocks: readonly ScheduleBlock[] = agent.def.schedule ?? [];
    if (blocks.length === 0) return;
    const activity = scheduleBlockAt(blocks, minute)?.activity ?? null;
    if (activity !== agent.scheduleActivity) {
      agent.scheduleActivity = activity;
      this.#emit({ kind: 'schedule-changed', agentId: agent.agentId, activity });
    }
  }

  #decide(agent: LiveAgent): void {
    // A non-interruptible behaviour finishes what it started.
    if (agent.active && agent.active.behavior.interruptible === false) return;

    const scores = this.evaluate(agent.agentId);
    const best = selectBehavior(scores);
    if (!best) return;
    if (agent.active) {
      // Only a strictly better behaviour displaces a running one; equal scores
      // leave it alone, so an agent does not thrash between two equal options.
      const current = scores.find((entry) => entry.behaviorId === agent.active!.behavior.id);
      if (best.behaviorId === agent.active.behavior.id) return;
      if (current && best.score <= current.score) return;
    }
    this.#start(agent, this.#behaviorDefs.get(best.behaviorId)!, this.#pickTarget(agent, best.behaviorId));
  }

  /** The first *other* living agent carrying every target tag, by ascending id. */
  #pickTarget(agent: LiveAgent, behaviorId: string): string | null {
    const tags = this.#behaviorDefs.get(behaviorId)?.targetTags ?? [];
    if (tags.length === 0) return null;
    for (const otherId of [...this.#agents.keys()].sort()) {
      if (otherId === agent.agentId) continue;
      const other = this.#agents.get(otherId)!;
      if (!other.alive) continue;
      if (tags.every((tag) => other.tags.has(tag))) return otherId;
    }
    return null;
  }

  #advanceWork(agent: LiveAgent, deltaMs: number): void {
    if (agent.workOrderId === null) return;
    const order = this.#orders.get(agent.workOrderId);
    if (!order) {
      agent.workOrderId = null;
      return;
    }
    if (order.state === 'reserved') order.state = 'active';
    if (order.state !== 'active') return;

    order.progressMs += deltaMs;
    if (order.progressMs < order.durationMs) return;
    order.state = 'complete';
    order.reservedBy = null;
    agent.workOrderId = null;
    this.#emit({ kind: 'work-order-completed', orderId: order.id, agentId: agent.agentId });
  }

  readonly #pending: SimulationAgentEvent[] = [];

  #emit(event: SimulationAgentEvent): void {
    this.#pending.push(event);
    switch (event.kind) {
      case 'behavior-started':
        this.#events?.emit('agents:behaviorStarted', { agentId: event.agentId, behaviorId: event.behaviorId });
        break;
      case 'behavior-completed':
        this.#events?.emit('agents:behaviorCompleted', { agentId: event.agentId, behaviorId: event.behaviorId });
        break;
      case 'need-level-changed':
        this.#events?.emit('agents:needLevelChanged', {
          agentId: event.agentId,
          needId: event.needId,
          level: event.level,
        });
        break;
      case 'work-order-completed':
        this.#events?.emit('agents:workOrderCompleted', { orderId: event.orderId, agentId: event.agentId });
        break;
      default:
        break;
    }
  }

  reset(): void {
    this.#agents.clear();
    this.#relationships.clear();
    this.#pending.length = 0;
    this.#elapsedMs = 0;
    this.#gameMinutes = 0;
    this.#resetOrders();
  }
}

export const simulationAgentsPack: SystemPackDefinition<SimulationAgentsConfig, GameContext> = {
  id: PACK_IDS.simulationAgents,
  version: '0.1.0',
  provides: [CAPABILITY_IDS.simulationAgents],
  dependencies: [],
  configSchemaId: SIMULATION_AGENTS_CONFIG_SCHEMA_ID,

  install(context: GameContext, config: SimulationAgentsConfig): InstalledSystemPack {
    const doc = context.content.data['agents']?.value as SimulationAgentsDocument | undefined;
    if (!doc) throw new MissingSimulationAgentsDocumentError();

    const service = new SimulationAgentsServiceImpl(doc, context.events);
    if (config?.autoSpawn) {
      for (const def of doc.agents) service.spawn(def.id, def.id);
    }
    const handle = context.capabilities.provide(CAPABILITY_IDS.simulationAgents, service);

    return {
      id: PACK_IDS.simulationAgents,
      update(deltaMs: number): void {
        service.update(deltaMs);
      },
      dispose(): void {
        handle.dispose();
      },
    };
  },
};

export type { SimulationAgentsService } from '@sw2d/contracts';
