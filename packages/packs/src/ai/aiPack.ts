import type { EventBus, GameContext, InstalledSystemPack, SystemPackDefinition } from '@sw2d/contracts';
import { CAPABILITY_IDS, PACK_IDS } from '../ids.ts';
import type { CombatService } from '../combat/combatPack.ts';

/**
 * AI pack: lightweight agent-state orchestration groundwork.
 *
 * No pathfinding, navigation meshes, behavior trees, vision geometry, combat
 * logic or Phaser movement - this tracks *what state an agent is in*, not
 * how it gets there or what it does while there.
 *
 * Depends on the `combat` capability by id (never by importing
 * `combatPack.ts`'s implementation - `CombatService` is imported here only
 * as a type) to demonstrate a real, justified cross-pack dependency:
 * `isAgentAlive` answers a question AI state genuinely needs and combat
 * genuinely owns, rather than duplicating a second health concept.
 */

export const AI_STATES = ['idle', 'patrol', 'chase', 'flee'] as const;
export type AiState = (typeof AI_STATES)[number];

export class UnknownAiAgentError extends Error {
  constructor(agentId: string) {
    super(`No AI agent registered with id "${agentId}".`);
    this.name = 'UnknownAiAgentError';
  }
}

export class DuplicateAiAgentError extends Error {
  constructor(agentId: string) {
    super(`AI agent "${agentId}" is already registered.`);
    this.name = 'DuplicateAiAgentError';
  }
}

export class InvalidAiStateError extends Error {
  constructor(state: string) {
    super(`"${state}" is not a valid AI state. Valid states: ${AI_STATES.join(', ')}.`);
    this.name = 'InvalidAiStateError';
  }
}

export interface AiService {
  register(agentId: string, initialState?: AiState): void;
  has(agentId: string): boolean;
  state(agentId: string): AiState;
  /** No-op (no event) if `next` equals the current state. */
  setState(agentId: string, next: AiState): void;
  remove(agentId: string): void;
  list(): readonly string[];
  /** True only if the agent has a registered combat entity with current health > 0. */
  isAgentAlive(agentId: string): boolean;
}

function assertValidState(state: string): asserts state is AiState {
  if (!(AI_STATES as readonly string[]).includes(state)) throw new InvalidAiStateError(state);
}

class AiServiceImpl implements AiService {
  readonly #agents = new Map<string, AiState>();
  readonly #events: EventBus;
  readonly #combat: CombatService;

  constructor(events: EventBus, combat: CombatService) {
    this.#events = events;
    this.#combat = combat;
  }

  register(agentId: string, initialState: AiState = 'idle'): void {
    if (this.#agents.has(agentId)) throw new DuplicateAiAgentError(agentId);
    assertValidState(initialState);
    this.#agents.set(agentId, initialState);
  }

  has(agentId: string): boolean {
    return this.#agents.has(agentId);
  }

  state(agentId: string): AiState {
    const state = this.#agents.get(agentId);
    if (!state) throw new UnknownAiAgentError(agentId);
    return state;
  }

  setState(agentId: string, next: AiState): void {
    const from = this.state(agentId);
    assertValidState(next);
    if (next === from) return;
    this.#agents.set(agentId, next);
    this.#events.emit('ai:stateChanged', { agentId, from, to: next });
  }

  remove(agentId: string): void {
    this.#agents.delete(agentId);
  }

  list(): readonly string[] {
    return [...this.#agents.keys()].sort();
  }

  isAgentAlive(agentId: string): boolean {
    if (!this.has(agentId)) throw new UnknownAiAgentError(agentId);
    return this.#combat.has(agentId) && this.#combat.get(agentId).current > 0;
  }
}

export const aiPack: SystemPackDefinition<undefined, GameContext> = {
  id: PACK_IDS.ai,
  version: '0.1.0',
  provides: [CAPABILITY_IDS.ai],
  dependencies: [CAPABILITY_IDS.combat],

  install(context: GameContext): InstalledSystemPack {
    const combat = context.capabilities.require<CombatService>(CAPABILITY_IDS.combat);
    const service = new AiServiceImpl(context.events, combat);
    const handle = context.capabilities.provide(CAPABILITY_IDS.ai, service);

    return {
      id: PACK_IDS.ai,
      dispose(): void {
        handle.dispose();
      },
    };
  },
};
