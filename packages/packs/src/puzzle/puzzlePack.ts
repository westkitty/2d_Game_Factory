import type { GameContext, InstalledSystemPack, SystemPackDefinition } from '@sw2d/contracts';
import { CAPABILITY_IDS, PACK_IDS } from '../ids.ts';

/**
 * Puzzle pack: deterministic puzzle-state foundations for future grid/push/
 * logic games (Sokoban etc. are a later consumer, not implemented here).
 *
 * No universal puzzle DSL: `TState` is opaque to this pack. Config supplies
 * two functions (`createInitialState`, `isSolved`) rather than JSON data, so
 * this pack has no `configSchemaId` - functions cannot be JSON Schema
 * validated, and that is a legitimate reason for a pack to have no schema
 * (see MASTER_PROJECT.md §20 / the Phase 4 config-validation requirement).
 */

export interface PuzzleConfig<TState = unknown> {
  readonly createInitialState: () => TState;
  readonly isSolved: (state: TState) => boolean;
}

export interface PuzzleService<TState = unknown> {
  current(): TState;
  /** Pushes the prior state onto the undo history; returns the new current state. */
  apply(operation: (state: TState) => TState): TState;
  /** Pops the most recent state from history, or returns null if there is nothing to undo. */
  undo(): TState | null;
  /** Regenerates the initial state via `createInitialState()` and clears history. */
  reset(): TState;
  isSolved(): boolean;
}

class PuzzleServiceImpl<TState> implements PuzzleService<TState> {
  #state: TState;
  readonly #history: TState[] = [];
  readonly #config: PuzzleConfig<TState>;

  constructor(config: PuzzleConfig<TState>) {
    this.#config = config;
    this.#state = config.createInitialState();
  }

  current(): TState {
    return this.#state;
  }

  apply(operation: (state: TState) => TState): TState {
    this.#history.push(this.#state);
    this.#state = operation(this.#state);
    return this.#state;
  }

  undo(): TState | null {
    if (this.#history.length === 0) return null;
    this.#state = this.#history.pop()!;
    return this.#state;
  }

  reset(): TState {
    this.#history.length = 0;
    this.#state = this.#config.createInitialState();
    return this.#state;
  }

  isSolved(): boolean {
    return this.#config.isSolved(this.#state);
  }
}

export const puzzlePack: SystemPackDefinition<PuzzleConfig, GameContext> = {
  id: PACK_IDS.puzzle,
  version: '0.1.0',
  provides: [CAPABILITY_IDS.puzzle],
  dependencies: [],

  install(context: GameContext, config: PuzzleConfig): InstalledSystemPack {
    const service = new PuzzleServiceImpl(config);
    const handle = context.capabilities.provide(CAPABILITY_IDS.puzzle, service);

    return {
      id: PACK_IDS.puzzle,
      dispose(): void {
        handle.dispose();
      },
    };
  },
};
