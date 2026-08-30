/**
 * Simulation agents, needs, behavior & schedules (post-ten program Phase 18).
 *
 * The reusable basis for creatures and colonists: needs that drift, behaviours
 * chosen by utility, relationships between agents, a game-time schedule, and a
 * work-order queue with exclusive reservations.
 *
 * **Deliberately not combat AI.** `sw2d.ai` (`ai.state`) owns the small
 * state machine an enemy uses, and `sw2d.ai-perception` (Phase 11) owns vision
 * and awareness. This is a different problem: an agent here is not reacting to a
 * threat, it is deciding what it wants. Merging the two would mean a guard's
 * chase state and a colonist's hunger competing in one selector.
 *
 * Renderer-neutral and pure. Nothing here reads a clock, a renderer, or
 * `Math.random`; navigation is delegated to the certified Phase-5 `world.navigation`
 * rather than reimplemented, so there is exactly one pathfinder in the system.
 *
 * ## Vocabulary is content, not code
 *
 * Need ids are authored. There is no `hunger` enum, no built-in `sleep`, no
 * assumed `social`: a fish tank's needs are `oxygen` and `cleanliness`, and a
 * colony's are whatever the colony is about. The same is true of relationship
 * metrics - the core stores `(agentA, agentB, metricId) -> value` and takes no
 * view on whether that metric is friendship, debt or fear.
 */

import type { SeededRng } from './generation.ts';

export const SIMULATION_AGENTS_CAPABILITY_ID = 'simulation.agents';

// --- Needs ---------------------------------------------------------------

export interface NeedDefinition {
  readonly id: string;
  readonly displayName?: string;
  readonly minimum: number;
  readonly maximum: number;
  readonly initial: number;
  /** Drift per simulated second. Negative depletes, positive replenishes. */
  readonly changePerSecond: number;
  /** At or below this, the need is a warning. Must sit between minimum and critical. */
  readonly warningThreshold: number;
  /** At or below this, the need is critical. */
  readonly criticalThreshold: number;
}

export type NeedLevel = 'ok' | 'warning' | 'critical';

export interface NeedState {
  readonly id: string;
  readonly value: number;
  /** 0..1, where 1 is "as bad as this need gets". Drives behaviour utility. */
  readonly urgency: number;
  readonly level: NeedLevel;
}

/**
 * How far a need has fallen toward its floor, as 0..1.
 *
 * Normalised across the need's own range so a 0..100 need and a 0..1 need
 * produce comparable urgencies - without which a behaviour's `needWeights` would
 * silently depend on the scale an author happened to pick.
 */
export function needUrgency(definition: NeedDefinition, value: number): number {
  const span = definition.maximum - definition.minimum;
  if (span <= 0) return 0;
  const normalised = (value - definition.minimum) / span;
  const clamped = normalised < 0 ? 0 : normalised > 1 ? 1 : normalised;
  return 1 - clamped;
}

export function needLevel(definition: NeedDefinition, value: number): NeedLevel {
  if (value <= definition.criticalThreshold) return 'critical';
  if (value <= definition.warningThreshold) return 'warning';
  return 'ok';
}

// --- Behaviours ----------------------------------------------------------

/**
 * A bounded precondition. No expression language: a condition the core cannot
 * name is a condition it cannot evaluate deterministically or explain when it
 * fails.
 */
export type BehaviorCondition =
  | { readonly kind: 'need-below'; readonly needId: string; readonly value: number }
  | { readonly kind: 'need-above'; readonly needId: string; readonly value: number }
  | { readonly kind: 'has-tag'; readonly tag: string }
  | { readonly kind: 'lacks-tag'; readonly tag: string }
  | { readonly kind: 'schedule-activity'; readonly activity: string }
  | { readonly kind: 'target-available'; readonly tag: string };

/** A bounded effect applied when a behaviour completes. */
export type BehaviorEffect =
  | { readonly kind: 'need-delta'; readonly needId: string; readonly delta: number }
  | { readonly kind: 'need-set'; readonly needId: string; readonly value: number }
  | { readonly kind: 'add-tag'; readonly tag: string }
  | { readonly kind: 'remove-tag'; readonly tag: string }
  | { readonly kind: 'relationship-delta'; readonly metricId: string; readonly delta: number };

export interface BehaviorDefinition {
  readonly id: string;
  readonly displayName?: string;
  /** Baseline desirability before need weighting. */
  readonly baseUtility: number;
  readonly preconditions?: readonly BehaviorCondition[];
  /** Multiplied by each need's urgency and summed into the score. */
  readonly needWeights?: Readonly<Record<string, number>>;
  /** Tags an object or agent must carry to be this behaviour's target. */
  readonly targetTags?: readonly string[];
  readonly durationMs: number;
  readonly cooldownMs?: number;
  readonly effects?: readonly BehaviorEffect[];
  /** When false, a higher-scoring behaviour cannot displace this one mid-run. */
  readonly interruptible?: boolean;
}

export type BehaviorPhase = 'idle' | 'active' | 'complete' | 'interrupted';

export interface ActiveBehavior {
  readonly behaviorId: string;
  readonly startedAtMs: number;
  readonly elapsedMs: number;
  readonly durationMs: number;
  readonly targetId: string | null;
  readonly interruptible: boolean;
}

export interface BehaviorScore {
  readonly behaviorId: string;
  readonly score: number;
  /** Null when the behaviour scored but was not eligible. */
  readonly eligible: boolean;
  readonly blockedBy: string | null;
}

/**
 * Utility score for one behaviour. Pure, and exported so a debug overlay can
 * show the same numbers the selector used rather than a re-derived guess.
 *
 *   score = baseUtility + sum over needs of (weight * urgency)
 */
export function behaviorScore(
  behavior: BehaviorDefinition,
  needs: Readonly<Record<string, NeedState>>,
): number {
  let score = behavior.baseUtility;
  for (const [needId, weight] of Object.entries(behavior.needWeights ?? {})) {
    const need = needs[needId];
    if (!need) continue;
    score += weight * need.urgency;
  }
  return score;
}

/**
 * Pick the best behaviour from already-scored candidates.
 *
 * **Ties break on behaviour id, ascending.** Not "whichever the map yielded
 * first": a Map's iteration order is insertion order, which depends on document
 * order, which would make two identical simulations differ because someone
 * reordered a JSON array.
 */
export function selectBehavior(scores: readonly BehaviorScore[]): BehaviorScore | null {
  let best: BehaviorScore | null = null;
  for (const candidate of scores) {
    if (!candidate.eligible) continue;
    if (
      best === null ||
      candidate.score > best.score ||
      (candidate.score === best.score && candidate.behaviorId < best.behaviorId)
    ) {
      best = candidate;
    }
  }
  return best;
}

// --- Schedule ------------------------------------------------------------

/** A block of the agent's day, in game-time minutes from midnight. */
export interface ScheduleBlock {
  readonly startMinute: number;
  readonly endMinute: number;
  readonly activity: string;
  readonly locationTag?: string;
}

export const MINUTES_PER_DAY = 1440;

/**
 * The block covering a game-time minute, or null.
 *
 * Wrapping blocks (`22:00`–`06:00`) are supported explicitly, because a sleep
 * schedule that cannot cross midnight is not a schedule.
 */
export function scheduleBlockAt(
  blocks: readonly ScheduleBlock[],
  minuteOfDay: number,
): ScheduleBlock | null {
  const minute = ((minuteOfDay % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  for (const block of blocks) {
    if (block.startMinute <= block.endMinute) {
      if (minute >= block.startMinute && minute < block.endMinute) return block;
    } else if (minute >= block.startMinute || minute < block.endMinute) {
      return block;
    }
  }
  return null;
}

// --- Agents --------------------------------------------------------------

export interface AgentDefinition {
  readonly id: string;
  readonly displayName?: string;
  readonly tags?: readonly string[];
  /** Need ids this archetype has. Every one must exist in the document. */
  readonly needs: readonly string[];
  readonly behaviors: readonly string[];
  readonly schedule?: readonly ScheduleBlock[];
  /** Free-form numeric traits a game may read. The core does not interpret them. */
  readonly traits?: Readonly<Record<string, number>>;
  readonly homeLocationTag?: string;
}

export interface AgentState {
  readonly agentId: string;
  readonly definitionId: string;
  readonly alive: boolean;
  readonly tags: readonly string[];
  readonly needs: Readonly<Record<string, NeedState>>;
  readonly active: ActiveBehavior | null;
  readonly lastCompletedBehaviorId: string | null;
  readonly scheduleActivity: string | null;
  /** Work order this agent currently owns, if any. */
  readonly workOrderId: string | null;
}

// --- Work orders ---------------------------------------------------------

export type WorkOrderState = 'open' | 'reserved' | 'active' | 'complete' | 'cancelled';

export interface WorkOrderDefinition {
  readonly id: string;
  readonly kind: string;
  readonly priority: number;
  /** Every listed tag must be carried by an agent for it to take this order. */
  readonly requiredAgentTags?: readonly string[];
  readonly targetId?: string;
  readonly locationTag?: string;
  readonly durationMs: number;
}

export interface WorkOrder extends WorkOrderDefinition {
  readonly state: WorkOrderState;
  readonly reservedBy: string | null;
  readonly progressMs: number;
}

// --- Relationships -------------------------------------------------------

export interface RelationshipEntry {
  readonly fromId: string;
  readonly toId: string;
  readonly metricId: string;
  readonly value: number;
}

// --- Document ------------------------------------------------------------

export interface SimulationAgentsDocument {
  readonly schemaVersion: 1;
  readonly needs: readonly NeedDefinition[];
  readonly behaviors: readonly BehaviorDefinition[];
  readonly agents: readonly AgentDefinition[];
  readonly workOrders?: readonly WorkOrderDefinition[];
  /**
   * How often the selector re-evaluates, in simulated milliseconds. Needs drift
   * every tick; choosing a behaviour is far more expensive and does not need to.
   */
  readonly decisionIntervalMs?: number;
  /** Game minutes advanced per simulated second. Omit to leave the clock still. */
  readonly minutesPerSecond?: number;
}

export const DEFAULT_DECISION_INTERVAL_MS = 250;

// --- Service -------------------------------------------------------------

export interface SimulationClock {
  /** Total simulated milliseconds since the service was created or reset. */
  readonly elapsedMs: number;
  /** Game-time minute of day, 0..1439. */
  readonly minuteOfDay: number;
  readonly day: number;
}

export interface SimulationAgentsService {
  definition(): SimulationAgentsDocument;
  clock(): SimulationClock;

  /** Spawn an agent from an archetype. Throws on an unknown definition or duplicate id. */
  spawn(agentId: string, definitionId: string): AgentState;
  despawn(agentId: string): boolean;
  agent(agentId: string): AgentState | undefined;
  agents(): readonly AgentState[];

  need(agentId: string, needId: string): NeedState | undefined;
  adjustNeed(agentId: string, needId: string, delta: number): NeedState | undefined;

  addTag(agentId: string, tag: string): boolean;
  removeTag(agentId: string, tag: string): boolean;

  /** Scores every behaviour this agent could run right now, with reasons. */
  evaluate(agentId: string): readonly BehaviorScore[];
  /** Force a behaviour, bypassing selection. Returns false when it is not eligible. */
  forceBehavior(agentId: string, behaviorId: string, targetId?: string): boolean;
  /** Stop the active behaviour without applying its effects. */
  interrupt(agentId: string): boolean;

  relationship(fromId: string, toId: string, metricId: string): number;
  setRelationship(fromId: string, toId: string, metricId: string, value: number): void;
  adjustRelationship(fromId: string, toId: string, metricId: string, delta: number): number;
  relationships(): readonly RelationshipEntry[];

  workOrders(): readonly WorkOrder[];
  workOrder(orderId: string): WorkOrder | undefined;
  /** Claim an open order for an agent. Exclusive: a reserved order has one owner. */
  reserveWorkOrder(orderId: string, agentId: string): boolean;
  releaseWorkOrder(orderId: string): boolean;
  cancelWorkOrder(orderId: string): boolean;
  /** The highest-priority open order this agent is tagged for, or null. */
  nextWorkOrderFor(agentId: string): WorkOrder | undefined;

  reset(): void;
}

// --- Events --------------------------------------------------------------

export type SimulationAgentEvent =
  | { readonly kind: 'behavior-started'; readonly agentId: string; readonly behaviorId: string; readonly targetId: string | null }
  | { readonly kind: 'behavior-completed'; readonly agentId: string; readonly behaviorId: string }
  | { readonly kind: 'behavior-interrupted'; readonly agentId: string; readonly behaviorId: string; readonly reason: string }
  | { readonly kind: 'need-level-changed'; readonly agentId: string; readonly needId: string; readonly level: NeedLevel }
  | { readonly kind: 'schedule-changed'; readonly agentId: string; readonly activity: string | null }
  | { readonly kind: 'work-order-reserved'; readonly orderId: string; readonly agentId: string }
  | { readonly kind: 'work-order-completed'; readonly orderId: string; readonly agentId: string }
  | { readonly kind: 'work-order-released'; readonly orderId: string; readonly reason: string };

// --- Validation ----------------------------------------------------------

export class InvalidSimulationAgentsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidSimulationAgentsError';
  }
}

/** Semantic checks the JSON schema cannot express: id uniqueness and cross-references. */
export function validateSimulationAgentsDocument(doc: SimulationAgentsDocument): void {
  const needIds = new Set<string>();
  for (const need of doc.needs) {
    if (needIds.has(need.id)) throw new InvalidSimulationAgentsError(`Duplicate need id: "${need.id}".`);
    needIds.add(need.id);
    if (!(need.maximum > need.minimum)) {
      throw new InvalidSimulationAgentsError(
        `Need "${need.id}": maximum (${need.maximum}) must exceed minimum (${need.minimum}).`,
      );
    }
    if (need.initial < need.minimum || need.initial > need.maximum) {
      throw new InvalidSimulationAgentsError(
        `Need "${need.id}": initial (${need.initial}) must be within [${need.minimum}, ${need.maximum}].`,
      );
    }
    if (need.criticalThreshold > need.warningThreshold) {
      throw new InvalidSimulationAgentsError(
        `Need "${need.id}": criticalThreshold (${need.criticalThreshold}) must not exceed ` +
          `warningThreshold (${need.warningThreshold}) - critical is the worse state.`,
      );
    }
    for (const [name, value] of [
      ['warningThreshold', need.warningThreshold],
      ['criticalThreshold', need.criticalThreshold],
    ] as const) {
      if (value < need.minimum || value > need.maximum) {
        throw new InvalidSimulationAgentsError(
          `Need "${need.id}": ${name} (${value}) must be within [${need.minimum}, ${need.maximum}].`,
        );
      }
    }
  }

  const behaviorIds = new Set<string>();
  for (const behavior of doc.behaviors) {
    if (behaviorIds.has(behavior.id)) {
      throw new InvalidSimulationAgentsError(`Duplicate behavior id: "${behavior.id}".`);
    }
    behaviorIds.add(behavior.id);
    if (!(behavior.durationMs > 0)) {
      throw new InvalidSimulationAgentsError(`Behavior "${behavior.id}": durationMs must be > 0.`);
    }
    if (behavior.cooldownMs !== undefined && behavior.cooldownMs < 0) {
      throw new InvalidSimulationAgentsError(`Behavior "${behavior.id}": cooldownMs must be >= 0.`);
    }
    for (const needId of Object.keys(behavior.needWeights ?? {})) {
      if (!needIds.has(needId)) {
        throw new InvalidSimulationAgentsError(
          `Behavior "${behavior.id}" weights unknown need "${needId}".`,
        );
      }
    }
    for (const condition of behavior.preconditions ?? []) {
      if ((condition.kind === 'need-below' || condition.kind === 'need-above') && !needIds.has(condition.needId)) {
        throw new InvalidSimulationAgentsError(
          `Behavior "${behavior.id}" has a precondition on unknown need "${condition.needId}".`,
        );
      }
    }
    for (const effect of behavior.effects ?? []) {
      if ((effect.kind === 'need-delta' || effect.kind === 'need-set') && !needIds.has(effect.needId)) {
        throw new InvalidSimulationAgentsError(
          `Behavior "${behavior.id}" has an effect on unknown need "${effect.needId}".`,
        );
      }
    }
  }

  const agentIds = new Set<string>();
  for (const agent of doc.agents) {
    if (agentIds.has(agent.id)) throw new InvalidSimulationAgentsError(`Duplicate agent id: "${agent.id}".`);
    agentIds.add(agent.id);
    if (agent.needs.length === 0) {
      throw new InvalidSimulationAgentsError(`Agent "${agent.id}" must declare at least one need.`);
    }
    for (const needId of agent.needs) {
      if (!needIds.has(needId)) {
        throw new InvalidSimulationAgentsError(`Agent "${agent.id}" references unknown need "${needId}".`);
      }
    }
    for (const behaviorId of agent.behaviors) {
      if (!behaviorIds.has(behaviorId)) {
        throw new InvalidSimulationAgentsError(
          `Agent "${agent.id}" references unknown behavior "${behaviorId}".`,
        );
      }
    }
    for (const block of agent.schedule ?? []) {
      for (const [name, value] of [
        ['startMinute', block.startMinute],
        ['endMinute', block.endMinute],
      ] as const) {
        if (!Number.isInteger(value) || value < 0 || value >= MINUTES_PER_DAY) {
          throw new InvalidSimulationAgentsError(
            `Agent "${agent.id}": schedule ${name} must be an integer in [0, ${MINUTES_PER_DAY}) (got ${value}).`,
          );
        }
      }
      if (block.startMinute === block.endMinute) {
        throw new InvalidSimulationAgentsError(
          `Agent "${agent.id}": a schedule block covering zero minutes is never active.`,
        );
      }
    }
  }

  const orderIds = new Set<string>();
  for (const order of doc.workOrders ?? []) {
    if (orderIds.has(order.id)) throw new InvalidSimulationAgentsError(`Duplicate work order id: "${order.id}".`);
    orderIds.add(order.id);
    if (!(order.durationMs > 0)) {
      throw new InvalidSimulationAgentsError(`Work order "${order.id}": durationMs must be > 0.`);
    }
  }

  if (doc.decisionIntervalMs !== undefined && !(doc.decisionIntervalMs > 0)) {
    throw new InvalidSimulationAgentsError('decisionIntervalMs must be > 0.');
  }
  if (doc.minutesPerSecond !== undefined && doc.minutesPerSecond < 0) {
    throw new InvalidSimulationAgentsError('minutesPerSecond must be >= 0.');
  }
}

/**
 * Advance one need. Pure, exported, and the only place the drift rule lives.
 *
 *   new = clamp(old + changePerSecond * deltaSeconds, minimum, maximum)
 */
export function tickNeed(definition: NeedDefinition, value: number, deltaSeconds: number): number {
  const next = value + definition.changePerSecond * deltaSeconds;
  return next < definition.minimum ? definition.minimum : next > definition.maximum ? definition.maximum : next;
}

/** A deterministic pick among equally-scored candidates, for a game that wants variety. */
export function tieBreakBySeed<T extends { readonly behaviorId: string }>(
  candidates: readonly T[],
  rng: SeededRng,
): T | null {
  if (candidates.length === 0) return null;
  const ordered = [...candidates].sort((a, b) => (a.behaviorId < b.behaviorId ? -1 : 1));
  return ordered[rng.nextInt(ordered.length)] ?? null;
}
