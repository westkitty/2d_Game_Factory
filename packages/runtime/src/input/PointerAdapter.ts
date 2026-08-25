import { ACTION_IDS, type ActionBindings, type ActionId, type ActionSink, type InputDeviceAdapter } from '@sw2d/contracts';

/**
 * Translates pointer/touch presses on DOM controls into semantic actions.
 *
 * Controls declare themselves with `data-sw2d-action="JUMP"`. Because they feed
 * the same action layer as the keyboard, touch play needs no duplicated game
 * logic - which is the whole reason the semantic layer exists.
 *
 * Listeners live on the container, not on each button, so adding or removing
 * controls at runtime cannot leak handlers.
 */
export class PointerAdapter implements InputDeviceAdapter {
  readonly sourceId = 'pointer' as const;
  readonly #sink: ActionSink;
  readonly #root: HTMLElement;
  #targetToActions = new Map<string, ActionId[]>();
  #activePointers = new Map<number, ActionId[]>();
  #disposed = false;

  readonly #onPointerDown = (event: Event): void => {
    const pointerEvent = event as PointerEvent;
    const actions = this.#actionsFor(pointerEvent.target);
    if (!actions) return;
    pointerEvent.preventDefault();
    const element = (pointerEvent.target as Element).closest<HTMLElement>('[data-sw2d-action]');
    element?.setPointerCapture?.(pointerEvent.pointerId);
    this.#activePointers.set(pointerEvent.pointerId, actions);
    for (const action of actions) this.#sink.setActionValue(action, 1, this.sourceId);
  };

  readonly #onPointerEnd = (event: Event): void => {
    const pointerEvent = event as PointerEvent;
    const actions = this.#activePointers.get(pointerEvent.pointerId);
    if (!actions) return;
    this.#activePointers.delete(pointerEvent.pointerId);
    for (const action of actions) {
      if (!this.#isActionStillHeld(action)) this.#sink.setActionValue(action, 0, this.sourceId);
    }
  };

  constructor(sink: ActionSink, root: HTMLElement) {
    this.#sink = sink;
    this.#root = root;
    this.#root.addEventListener('pointerdown', this.#onPointerDown);
    this.#root.addEventListener('pointerup', this.#onPointerEnd);
    this.#root.addEventListener('pointercancel', this.#onPointerEnd);
    window.addEventListener('pointerup', this.#onPointerEnd);
  }

  #actionsFor(target: EventTarget | null): ActionId[] | undefined {
    if (!(target instanceof Element)) return undefined;
    const element = target.closest<HTMLElement>('[data-sw2d-action]');
    const name = element?.dataset['sw2dAction'];
    if (!name) return undefined;
    return this.#targetToActions.get(name);
  }

  #isActionStillHeld(action: ActionId): boolean {
    for (const actions of this.#activePointers.values()) {
      if (actions.includes(action)) return true;
    }
    return false;
  }

  applyBindings(bindings: ActionBindings): void {
    const table = new Map<string, ActionId[]>();
    for (const action of ACTION_IDS) {
      for (const name of bindings[action]?.pointerTargets ?? []) {
        const existing = table.get(name);
        if (existing) existing.push(action);
        else table.set(name, [action]);
      }
    }
    this.#targetToActions = table;
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#root.removeEventListener('pointerdown', this.#onPointerDown);
    this.#root.removeEventListener('pointerup', this.#onPointerEnd);
    this.#root.removeEventListener('pointercancel', this.#onPointerEnd);
    window.removeEventListener('pointerup', this.#onPointerEnd);
    for (const actions of this.#activePointers.values()) {
      for (const action of actions) this.#sink.setActionValue(action, 0, this.sourceId);
    }
    this.#activePointers.clear();
    this.#targetToActions.clear();
  }
}
