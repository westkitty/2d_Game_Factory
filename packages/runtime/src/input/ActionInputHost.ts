import {
  ACTION_IDS,
  type ActionBindings,
  type ActionId,
  type ActionInput,
  type ActionSink,
  type ActionState,
  type Disposable,
  type InputDeviceAdapter,
  type InputSourceId,
} from '@sw2d/contracts';

const IDLE_STATE: ActionState = {
  down: false,
  justPressed: false,
  justReleased: false,
  value: 0,
  source: null,
};

function zeroed(): Record<ActionId, number> {
  const record = {} as Record<ActionId, number>;
  for (const action of ACTION_IDS) record[action] = 0;
  return record;
}

/**
 * The single owner of semantic action state.
 *
 * Adapters push raw values in; gameplay reads edges out. Only this host advances
 * a frame, so two systems reading `justPressed` in the same frame always agree -
 * a class of bug that a shared mutable "pressed keys" set cannot avoid, and the
 * exact failure that broke pause and menus in the c_chase reference build.
 *
 * A press and release inside a single frame is latched rather than dropped, so
 * fast taps on menus are never swallowed.
 */
export class ActionInputHost implements ActionInput, ActionSink, Disposable {
  #raw = zeroed();
  #peak = zeroed();
  #current = zeroed();
  #previous = zeroed();
  #sources = new Map<ActionId, InputSourceId>();
  #bindings: ActionBindings;
  #adapters: InputDeviceAdapter[] = [];
  #disposed = false;

  constructor(bindings: ActionBindings) {
    this.#bindings = bindings;
  }

  get bindings(): ActionBindings {
    return this.#bindings;
  }

  /** Number of attached device adapters. Read by the restart-leak diagnostics. */
  get adapterCount(): number {
    return this.#adapters.length;
  }

  setBindings(bindings: ActionBindings): void {
    this.#bindings = bindings;
    for (const adapter of this.#adapters) adapter.applyBindings(bindings);
  }

  /** Attach a device adapter. The host owns it and disposes it on teardown. */
  addAdapter<T extends InputDeviceAdapter>(adapter: T): T {
    if (this.#disposed) {
      adapter.dispose();
      return adapter;
    }
    this.#adapters.push(adapter);
    adapter.applyBindings(this.#bindings);
    return adapter;
  }

  setActionValue(action: ActionId, value: number, source: InputSourceId): void {
    const clamped = value <= 0 ? 0 : value >= 1 ? 1 : value;
    this.#raw[action] = clamped;
    if (clamped > 0) {
      this.#sources.set(action, source);
      if (clamped > this.#peak[action]) this.#peak[action] = clamped;
    }
  }

  /**
   * Advance one frame. Called exactly once per game step by the runtime, before
   * any scene update runs.
   */
  update(): void {
    for (const adapter of this.#adapters) adapter.poll?.();
    for (const action of ACTION_IDS) {
      this.#previous[action] = this.#current[action];
      const latched = this.#peak[action];
      this.#current[action] = latched > this.#raw[action] ? latched : this.#raw[action];
      this.#peak[action] = 0;
    }
  }

  /** Zero all input. Used when the window loses focus so keys cannot stick down. */
  clear(): void {
    this.#raw = zeroed();
    this.#peak = zeroed();
  }

  isDown(action: ActionId): boolean {
    return this.#current[action] > 0;
  }

  justPressed(action: ActionId): boolean {
    return this.#current[action] > 0 && this.#previous[action] === 0;
  }

  justReleased(action: ActionId): boolean {
    return this.#current[action] === 0 && this.#previous[action] > 0;
  }

  consumePress(action: ActionId): boolean {
    if (!this.justPressed(action)) return false;
    // Collapsing previous onto current removes both edges for this frame while
    // leaving the held state intact.
    this.#previous[action] = this.#current[action];
    return true;
  }

  value(action: ActionId): number {
    return this.#current[action];
  }

  axis(negative: ActionId, positive: ActionId): number {
    return this.#current[positive] - this.#current[negative];
  }

  state(action: ActionId): ActionState {
    if (this.#disposed) return IDLE_STATE;
    return {
      down: this.isDown(action),
      justPressed: this.justPressed(action),
      justReleased: this.justReleased(action),
      value: this.#current[action],
      source: this.#sources.get(action) ?? null,
    };
  }

  values(): Readonly<Record<ActionId, number>> {
    return { ...this.#current };
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    for (const adapter of this.#adapters.reverse()) {
      try {
        adapter.dispose();
      } catch (error) {
        console.error(`[sw2d] input adapter "${adapter.sourceId}" failed to dispose`, error);
      }
    }
    this.#adapters = [];
    this.clear();
    this.#current = zeroed();
    this.#previous = zeroed();
  }
}
