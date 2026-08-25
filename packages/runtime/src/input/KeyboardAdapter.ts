import { ACTION_IDS, type ActionBindings, type ActionId, type ActionSink, type InputDeviceAdapter } from '@sw2d/contracts';

/**
 * Translates physical keys into semantic actions.
 *
 * Listeners are attached exactly once at construction and removed on dispose;
 * re-binding rebuilds the lookup table only. That is why remapping - and
 * restarting - cannot accumulate handlers.
 */
export class KeyboardAdapter implements InputDeviceAdapter {
  readonly sourceId = 'keyboard' as const;
  readonly #sink: ActionSink;
  readonly #target: EventTarget;
  #codeToActions = new Map<string, ActionId[]>();
  #held = new Set<string>();
  #disposed = false;

  readonly #onKeyDown = (event: Event): void => {
    const keyboardEvent = event as KeyboardEvent;
    if (keyboardEvent.repeat) return;
    const actions = this.#codeToActions.get(keyboardEvent.code);
    if (!actions) return;
    // Claim only keys we actually bind, so browser shortcuts keep working.
    keyboardEvent.preventDefault();
    this.#held.add(keyboardEvent.code);
    for (const action of actions) this.#sink.setActionValue(action, 1, this.sourceId);
  };

  readonly #onKeyUp = (event: Event): void => {
    const keyboardEvent = event as KeyboardEvent;
    const actions = this.#codeToActions.get(keyboardEvent.code);
    if (!actions) return;
    this.#held.delete(keyboardEvent.code);
    for (const action of actions) {
      if (!this.#isActionStillHeld(action)) this.#sink.setActionValue(action, 0, this.sourceId);
    }
  };

  /** A focus loss can hide the keyup, which would leave an action stuck down. */
  readonly #onBlur = (): void => {
    this.#held.clear();
    for (const action of ACTION_IDS) this.#sink.setActionValue(action, 0, this.sourceId);
  };

  constructor(sink: ActionSink, target: EventTarget = window) {
    this.#sink = sink;
    this.#target = target;
    this.#target.addEventListener('keydown', this.#onKeyDown);
    this.#target.addEventListener('keyup', this.#onKeyUp);
    window.addEventListener('blur', this.#onBlur);
  }

  #isActionStillHeld(action: ActionId): boolean {
    for (const code of this.#held) {
      if (this.#codeToActions.get(code)?.includes(action)) return true;
    }
    return false;
  }

  applyBindings(bindings: ActionBindings): void {
    const table = new Map<string, ActionId[]>();
    for (const action of ACTION_IDS) {
      for (const code of bindings[action]?.keyboard ?? []) {
        const existing = table.get(code);
        if (existing) existing.push(action);
        else table.set(code, [action]);
      }
    }
    this.#codeToActions = table;
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#target.removeEventListener('keydown', this.#onKeyDown);
    this.#target.removeEventListener('keyup', this.#onKeyUp);
    window.removeEventListener('blur', this.#onBlur);
    this.#onBlur();
    this.#codeToActions.clear();
  }
}
