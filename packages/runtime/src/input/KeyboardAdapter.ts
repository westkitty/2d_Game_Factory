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
  readonly #blurTarget: EventTarget;
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

  constructor(sink: ActionSink, target: EventTarget = globalThis.window ?? new EventTarget()) {
    this.#sink = sink;
    this.#target = target;
    // Focus loss is a window-level fact, but the adapter must also work against an
    // injected target with no window at all (a unit test, or a per-player channel
    // constructed before the game has one). Falling back to the target keeps the
    // listener count symmetric with dispose in both cases.
    this.#blurTarget = globalThis.window ?? target;
    this.#target.addEventListener('keydown', this.#onKeyDown);
    this.#target.addEventListener('keyup', this.#onKeyUp);
    this.#blurTarget.addEventListener('blur', this.#onBlur);
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
    this.#blurTarget.removeEventListener('blur', this.#onBlur);
    this.#onBlur();
    this.#codeToActions.clear();
  }
}
