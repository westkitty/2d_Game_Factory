import {
  ACTION_IDS,
  DEFAULT_GAMEPAD_DEADZONE,
  STANDARD_GAMEPAD_BINDINGS,
  STANDARD_GAMEPAD_STICKS,
  applyDeadzone,
  applyRadialDeadzone,
  type ActionBindings,
  type ActionId,
  type ActionSink,
  type GamepadBindings,
  type GamepadDeadzoneConfig,
  type GamepadSnapshot,
  type GamepadSource,
  type GamepadStick,
  type InputDeviceAdapter,
} from '@sw2d/contracts';

/**
 * Translates one physical gamepad into semantic actions for one channel.
 *
 * Three deliberate properties:
 *
 * 1. **Nothing browser-owned is retained.** Each `poll()` asks the injected
 *    `GamepadSource` for a fresh snapshot. The browser recycles and invalidates
 *    `Gamepad` objects; holding one across a disconnect is exactly how a stuck
 *    "fire" survives unplugging the pad.
 * 2. **Disconnect zeroes every action this adapter drives**, once, on the
 *    transition. Not every frame - re-writing zero forever would be harmless but
 *    would also mask a genuine reconnect edge.
 * 3. **Bindings are by index, never by vendor label.** Button 0 is the bottom
 *    face button on every standard-mapping pad, whatever the vendor prints on it.
 *
 * `applyBindings` takes the keyboard/pointer `ActionBindings` the host hands every
 * adapter and ignores it: gamepad mapping is its own `GamepadBindings` table,
 * supplied at construction. The signature exists because `InputDeviceAdapter`
 * requires it, and satisfying it without accumulating listeners is the contract.
 */
export class GamepadAdapter implements InputDeviceAdapter {
  readonly sourceId = 'gamepad' as const;

  readonly #sink: ActionSink;
  readonly #source: GamepadSource;
  readonly #bindings: GamepadBindings;
  readonly #sticks: readonly GamepadStick[];
  #deadzone: GamepadDeadzoneConfig;
  #index: number;
  #connected = false;
  #drivenActions = new Set<ActionId>();
  #disposed = false;

  constructor(
    sink: ActionSink,
    source: GamepadSource,
    index: number,
    options?: {
      readonly bindings?: GamepadBindings;
      readonly deadzone?: GamepadDeadzoneConfig;
      readonly sticks?: readonly GamepadStick[];
    },
  ) {
    this.#sink = sink;
    this.#source = source;
    this.#index = index;
    this.#bindings = options?.bindings ?? STANDARD_GAMEPAD_BINDINGS;
    this.#deadzone = options?.deadzone ?? DEFAULT_GAMEPAD_DEADZONE;
    this.#sticks = options?.sticks ?? STANDARD_GAMEPAD_STICKS;
  }

  get gamepadIndex(): number {
    return this.#index;
  }

  /** True as of the last `poll()`. A game reads this to show "controller unplugged". */
  get connected(): boolean {
    return this.#connected;
  }

  setDeadzone(deadzone: GamepadDeadzoneConfig): void {
    this.#deadzone = deadzone;
  }

  /** Point this adapter at a different physical pad without rebuilding the channel. */
  setGamepadIndex(index: number): void {
    if (index === this.#index) return;
    this.#zeroDrivenActions();
    this.#connected = false;
    this.#index = index;
  }

  applyBindings(_bindings: ActionBindings): void {
    // Gamepad mapping is not expressed in ActionBindings (which carries
    // KeyboardEvent.code values and pointer target names). Nothing to rebuild,
    // and deliberately no listener to re-attach.
  }

  poll(): void {
    if (this.#disposed) return;
    const snapshot = this.#read();

    if (!snapshot || !snapshot.connected) {
      if (this.#connected) {
        // The disconnect transition. Clear once so nothing is left held.
        this.#zeroDrivenActions();
        this.#connected = false;
      }
      return;
    }

    this.#connected = true;
    const axes = this.#deadzonedAxes(snapshot);
    const driven = new Set<ActionId>();

    for (const action of ACTION_IDS) {
      const binding = this.#bindings[action];
      if (!binding) continue;
      let value = 0;

      for (const buttonIndex of binding.buttons ?? []) {
        const raw = snapshot.buttons[buttonIndex] ?? 0;
        const shaped = applyDeadzone(raw, this.#deadzone.trigger);
        if (shaped > value) value = shaped;
      }

      for (const ref of binding.axes ?? []) {
        const shaped = axes[ref.index] ?? 0;
        const directional = ref.direction > 0 ? shaped : -shaped;
        if (directional > value) value = directional;
      }

      this.#sink.setActionValue(action, value, this.sourceId);
      if (value > 0) driven.add(action);
    }

    // Remember only what we actually drove, so a disconnect clears precisely
    // those actions rather than stamping zero over another adapter's input.
    this.#drivenActions = driven;
  }

  #read(): GamepadSnapshot | null {
    const pads = this.#source();
    for (const pad of pads) {
      if (pad && pad.index === this.#index) return pad;
    }
    // A slot can also be reported positionally with a null/absent entry.
    return pads[this.#index] ?? null;
  }

  /** Axis values with the stick pairs radially deadzoned and lone axes scalar-deadzoned. */
  #deadzonedAxes(snapshot: GamepadSnapshot): number[] {
    const out = snapshot.axes.map((value) => (Number.isFinite(value) ? value : 0));
    const paired = new Set<number>();
    for (const stick of this.#sticks) {
      const x = out[stick.xAxis];
      const y = out[stick.yAxis];
      if (x === undefined || y === undefined) continue;
      const shaped = applyRadialDeadzone(x, y, this.#deadzone.stick);
      out[stick.xAxis] = shaped.x;
      out[stick.yAxis] = shaped.y;
      paired.add(stick.xAxis);
      paired.add(stick.yAxis);
    }
    for (let i = 0; i < out.length; i++) {
      if (paired.has(i)) continue;
      out[i] = applyDeadzone(out[i] ?? 0, this.#deadzone.stick);
    }
    return out;
  }

  #zeroDrivenActions(): void {
    for (const action of this.#drivenActions) this.#sink.setActionValue(action, 0, this.sourceId);
    this.#drivenActions = new Set();
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#zeroDrivenActions();
    this.#connected = false;
  }
}

/**
 * The browser `GamepadSource`.
 *
 * Converts each live `Gamepad` into a plain snapshot on every call and keeps no
 * reference afterwards. Returns an empty list where the API is absent, so a
 * headless or locked-down environment degrades to "no pads" rather than throwing.
 */
export function browserGamepadSource(): GamepadSource {
  return () => {
    const nav = typeof navigator === 'undefined' ? undefined : navigator;
    if (!nav || typeof nav.getGamepads !== 'function') return [];
    const pads = nav.getGamepads();
    if (!pads) return [];
    const out: (GamepadSnapshot | null)[] = [];
    for (let i = 0; i < pads.length; i++) {
      const pad = pads[i];
      if (!pad) {
        out.push(null);
        continue;
      }
      out.push({
        index: pad.index,
        connected: pad.connected,
        id: pad.id,
        mapping: pad.mapping,
        axes: Array.from(pad.axes),
        buttons: pad.buttons.map((button) => button.value),
      });
    }
    return out;
  };
}
