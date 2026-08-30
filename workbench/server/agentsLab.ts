/**
 * Simulation agents authoring surface (post-ten program Phase 18).
 *
 * Reads and updates `content/agents.json`. The editable fields are the ones a
 * creator tunes by feel and re-tunes constantly: how fast each need drifts,
 * where its warning and critical thresholds sit, and how strongly each behaviour
 * is pulled by each need.
 *
 * **Preconditions, effects and schedules are reported, not edited.** They are
 * structural - changing them changes what the simulation *can* do, not how it
 * feels - and a form that let a creator wire an arbitrary condition graph here
 * would be a visual scripting environment, which this deliberately is not. The
 * panel does surface the thing tuning needs and JSON hides: how long each need
 * takes to reach its thresholds at the authored rate.
 *
 * Validates against urn:sw2d:schema:content-agents:v1 and then against the
 * contract's semantic gate, and writes atomically with path containment checks.
 */

import { existsSync, readFileSync } from 'node:fs';
import type { SimulationAgentsDocument } from '@sw2d/contracts';
import { validateSimulationAgentsDocument } from '@sw2d/contracts';
import { validateContentBundleData, validateDocumentOrThrow } from '@sw2d/schemas';
import { gameRoot, resolveContained } from './paths.ts';
import { writeJsonAtomic } from './atomicJson.ts';
import { SecurityError } from './security.ts';

export interface NeedSummary {
  readonly id: string;
  readonly displayName: string;
  readonly minimum: number;
  readonly maximum: number;
  readonly initial: number;
  readonly changePerSecond: number;
  readonly warningThreshold: number;
  readonly criticalThreshold: number;
  /** Seconds from the initial value to each threshold at the authored rate. */
  readonly secondsToWarning: number | null;
  readonly secondsToCritical: number | null;
}

export interface BehaviorSummary {
  readonly id: string;
  readonly displayName: string;
  readonly baseUtility: number;
  readonly needWeights: Readonly<Record<string, number>>;
  readonly durationMs: number;
  readonly cooldownMs: number;
  readonly interruptible: boolean;
  readonly preconditionCount: number;
  readonly effectCount: number;
}

export interface AgentsInspectResult {
  readonly document: SimulationAgentsDocument;
  readonly needs: readonly NeedSummary[];
  readonly behaviors: readonly BehaviorSummary[];
  readonly agentCount: number;
  readonly workOrderCount: number;
  readonly decisionIntervalMs: number;
}

export interface AgentsUpdateResult {
  readonly ok: boolean;
  readonly document: SimulationAgentsDocument;
}

/** How long a need takes to fall from `initial` to `threshold`, or null if it never does. */
function secondsToThreshold(initial: number, threshold: number, changePerSecond: number): number | null {
  if (changePerSecond >= 0) return null; // this need never falls
  if (initial <= threshold) return 0;
  return Math.round(((initial - threshold) / -changePerSecond) * 100) / 100;
}

function loadDocument(gameId: string): SimulationAgentsDocument {
  const full = resolveContained(gameRoot(gameId), 'content', 'agents.json');
  if (!existsSync(full)) {
    throw new SecurityError(404, `No content/agents.json in "${gameId}".`);
  }
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(full, 'utf8'));
  } catch {
    throw new SecurityError(400, `content/agents.json in "${gameId}" is not valid JSON.`);
  }
  const validated = validateContentBundleData({ agents: raw }).agents!.value as SimulationAgentsDocument;
  validateSimulationAgentsDocument(validated);
  return validated;
}

export function inspectAgents(gameId: string): AgentsInspectResult {
  const document = loadDocument(gameId);
  return {
    document,
    decisionIntervalMs: document.decisionIntervalMs ?? 250,
    agentCount: document.agents.length,
    workOrderCount: document.workOrders?.length ?? 0,
    needs: document.needs.map((need) => ({
      id: need.id,
      displayName: need.displayName ?? need.id,
      minimum: need.minimum,
      maximum: need.maximum,
      initial: need.initial,
      changePerSecond: need.changePerSecond,
      warningThreshold: need.warningThreshold,
      criticalThreshold: need.criticalThreshold,
      secondsToWarning: secondsToThreshold(need.initial, need.warningThreshold, need.changePerSecond),
      secondsToCritical: secondsToThreshold(need.initial, need.criticalThreshold, need.changePerSecond),
    })),
    behaviors: document.behaviors.map((behavior) => ({
      id: behavior.id,
      displayName: behavior.displayName ?? behavior.id,
      baseUtility: behavior.baseUtility,
      needWeights: behavior.needWeights ?? {},
      durationMs: behavior.durationMs,
      cooldownMs: behavior.cooldownMs ?? 0,
      interruptible: behavior.interruptible !== false,
      preconditionCount: behavior.preconditions?.length ?? 0,
      effectCount: behavior.effects?.length ?? 0,
    })),
  };
}

export function updateAgents(gameId: string, payload: unknown): AgentsUpdateResult {
  if (typeof payload !== 'object' || payload === null) {
    throw new SecurityError(400, 'Agents update payload must be a SimulationAgentsDocument object.');
  }
  const validated = validateDocumentOrThrow('agents', 'content/agents.json', payload) as SimulationAgentsDocument;
  // The schema cannot see a dangling need reference, threshold ordering, or a
  // schedule block that covers zero minutes.
  try {
    validateSimulationAgentsDocument(validated);
  } catch (error) {
    throw new SecurityError(400, error instanceof Error ? error.message : String(error));
  }
  const target = resolveContained(gameRoot(gameId), 'content', 'agents.json');
  writeJsonAtomic(target, validated);
  return { ok: true, document: validated };
}
