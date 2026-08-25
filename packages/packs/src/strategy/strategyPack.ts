import type { EventBus, GameContext, InstalledSystemPack, SystemPackDefinition } from '@sw2d/contracts';
import { CAPABILITY_IDS, PACK_IDS } from '../ids.ts';

/**
 * Strategy pack: the minimal turn/team/selection basis future strategy
 * systems build on - teams, active turn, selection, turn advance. No
 * pathfinding, movement-range flood fills, attack resolution, RTS commands,
 * placement grids or economy here.
 */

export class DuplicateTeamError extends Error {
  constructor(teamId: string) {
    super(`Team "${teamId}" is already registered.`);
    this.name = 'DuplicateTeamError';
  }
}

export class NoTeamsRegisteredError extends Error {
  constructor() {
    super('Cannot advance a turn with no registered teams.');
    this.name = 'NoTeamsRegisteredError';
  }
}

export interface StrategyService {
  registerTeam(teamId: string): void;
  teams(): readonly string[];
  /** The team whose turn it currently is, or null before the first `advanceTurn()`. */
  activeTeam(): string | null;
  /** Round-robins to the next registered team, in registration order. Throws if no teams are registered. */
  advanceTurn(): string;
  turnNumber(): number;
  select(entityId: string): void;
  deselect(): void;
  selected(): string | null;
}

class StrategyServiceImpl implements StrategyService {
  readonly #teams: string[] = [];
  #activeIndex = -1;
  #turnNumber = 0;
  #selected: string | null = null;
  readonly #events: EventBus;

  constructor(events: EventBus) {
    this.#events = events;
  }

  registerTeam(teamId: string): void {
    if (this.#teams.includes(teamId)) throw new DuplicateTeamError(teamId);
    this.#teams.push(teamId);
  }

  teams(): readonly string[] {
    return [...this.#teams];
  }

  activeTeam(): string | null {
    return this.#activeIndex === -1 ? null : (this.#teams[this.#activeIndex] ?? null);
  }

  advanceTurn(): string {
    if (this.#teams.length === 0) throw new NoTeamsRegisteredError();
    this.#activeIndex = (this.#activeIndex + 1) % this.#teams.length;
    this.#turnNumber += 1;
    const team = this.#teams[this.#activeIndex]!;
    this.#events.emit('strategy:turnChanged', { team, turnNumber: this.#turnNumber });
    return team;
  }

  turnNumber(): number {
    return this.#turnNumber;
  }

  select(entityId: string): void {
    this.#selected = entityId;
  }

  deselect(): void {
    this.#selected = null;
  }

  selected(): string | null {
    return this.#selected;
  }
}

export const strategyPack: SystemPackDefinition<undefined, GameContext> = {
  id: PACK_IDS.strategy,
  version: '0.1.0',
  provides: [CAPABILITY_IDS.strategy],
  dependencies: [],

  install(context: GameContext): InstalledSystemPack {
    const service = new StrategyServiceImpl(context.events);
    const handle = context.capabilities.provide(CAPABILITY_IDS.strategy, service);

    return {
      id: PACK_IDS.strategy,
      dispose(): void {
        handle.dispose();
      },
    };
  },
};
