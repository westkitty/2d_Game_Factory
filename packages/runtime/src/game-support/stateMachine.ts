/**
 * A simple state machine for game logic.
 *
 * Provides a type-safe finite state machine with transitions, guards,
 * and entry/exit actions. Useful for game states (menu, playing, paused,
 * game over), character states (idle, walking, jumping), and any other
 * discrete state logic.
 *
 * Pure and deterministic - transitions are triggered by explicit events.
 */

export interface StateMachineConfig<S extends string, E extends string> {
  readonly initial: S;
  readonly states: Readonly<Record<S, StateConfig<S, E>>>;
}

export interface StateConfig<S extends string, E extends string> {
  readonly on?: Readonly<Partial<Record<E, Transition<S>>>>;
  readonly onEntry?: () => void;
  readonly onExit?: () => void;
}

export interface Transition<S extends string> {
  readonly target: S;
  readonly guard?: () => boolean;
  readonly action?: () => void;
}

export interface StateMachine<S extends string, E extends string> {
  /** Get the current state. */
  readonly current: S;

  /** Send an event to the state machine. Returns true if a transition occurred. */
  send(event: E): boolean;

  /** Check if an event would cause a transition from the current state. */
  can(event: E): boolean;

  /** Get all events that would cause a transition from the current state. */
  readonly availableEvents: readonly E[];

  /** Force a state (for testing/debugging). Bypasses guards. */
  forceState(state: S): void;

  /** Get the transition history (last N transitions). */
  readonly history: readonly { from: S; to: S; event: E; timestamp: number }[];
}

/**
 * Creates a state machine from a configuration.
 */
export function createStateMachine<S extends string, E extends string>(
  config: StateMachineConfig<S, E>,
): StateMachine<S, E> {
  let currentState = config.initial;
  const history: { from: S; to: S; event: E; timestamp: number }[] = [];
  const MAX_HISTORY = 50;

  // Fire entry action for initial state
  config.states[config.initial]?.onEntry?.();

  function send(event: E): boolean {
    const stateConfig = config.states[currentState];
    if (!stateConfig) return false;

    const transition = stateConfig.on?.[event];
    if (!transition) return false;

    // Check guard
    if (transition.guard && !transition.guard()) return false;

    const from = currentState;
    const to = transition.target;

    // Exit current state
    stateConfig.onExit?.();

    // Execute transition action
    transition.action?.();

    // Enter new state
    currentState = to;
    config.states[to]?.onEntry?.();

    // Record history
    history.push({ from, to, event, timestamp: Date.now() });
    if (history.length > MAX_HISTORY) history.shift();

    return true;
  }

  function can(event: E): boolean {
    const stateConfig = config.states[currentState];
    if (!stateConfig) return false;

    const transition = stateConfig.on?.[event];
    if (!transition) return false;

    return !transition.guard || transition.guard();
  }

  return {
    get current() {
      return currentState;
    },
    send,
    can,
    get availableEvents() {
      const stateConfig = config.states[currentState];
      if (!stateConfig?.on) return [];
      return (Object.keys(stateConfig.on) as E[]).filter((event) => can(event));
    },
    forceState(state: S) {
      if (state in config.states) {
        config.states[currentState]?.onExit?.();
        currentState = state;
        config.states[state]?.onEntry?.();
      }
    },
    get history() {
      return history;
    },
  };
}
