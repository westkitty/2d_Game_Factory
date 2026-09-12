import { ACTION_IDS, type ActionId, type ActionSink, type GamepadSeatState, type InputDeviceAdapter } from '@sw2d/contracts';

type GamepadProvider = () => readonly (Gamepad | null)[];
type AxisName = 'horizontal' | 'vertical' | 'aim-horizontal' | 'aim-vertical';

const BUTTON_ACTIONS: Readonly<Record<number, readonly ActionId[]>> = {
  0: ['JUMP', 'CONFIRM'],
  1: ['SECONDARY_ACTION', 'CANCEL'],
  2: ['PRIMARY_ACTION'],
  3: ['INTERACT'],
  4: ['DASH'],
  9: ['PAUSE'],
  12: ['MOVE_UP'],
  13: ['MOVE_DOWN'],
  14: ['MOVE_LEFT'],
  15: ['MOVE_RIGHT'],
};

/** Polling standard-mapping gamepad translator with stable four-seat assignment. */
export class GamepadAdapter implements InputDeviceAdapter {
  readonly sourceId = 'gamepad' as const;
  readonly #seatByIndex = new Map<number, number>();
  readonly #axesBySeat = new Map<number, readonly [number, number, number, number]>();
  #states: GamepadSeatState[] = [];
  #disposed = false;

  constructor(
    private readonly sink: ActionSink,
    private readonly target: EventTarget = window,
    private readonly provider: GamepadProvider = () => Array.from(navigator.getGamepads()),
    readonly deadzone = 0.2,
  ) {
    target.addEventListener('gamepadconnected', this.#onConnection);
    target.addEventListener('gamepaddisconnected', this.#onConnection);
  }

  readonly #onConnection = (): void => { this.poll(); };

  applyBindings(): void {}

  poll(): void {
    if (this.#disposed) return;
    for (const action of ACTION_IDS) this.sink.setActionValue(action, 0, this.sourceId);
    const pads = this.provider().filter((pad): pad is Gamepad => Boolean(pad?.connected));
    for (const pad of pads) this.#assign(pad.index);
    this.#states = pads
      .map((pad) => ({ seat: this.#seatByIndex.get(pad.index) ?? 0, index: pad.index, id: pad.id, connected: true, mapping: pad.mapping }))
      .sort((a, b) => a.seat - b.seat);
    this.#axesBySeat.clear();

    const actionValues = new Map<ActionId, number>();
    for (const pad of pads) {
      const seat = this.#seatByIndex.get(pad.index);
      if (seat === undefined) continue;
      const axes = [0, 1, 2, 3].map((index) => this.#axis(pad.axes[index] ?? 0)) as [number, number, number, number];
      this.#axesBySeat.set(seat, axes);
      const digital: Array<readonly [ActionId, number]> = [
        ['MOVE_LEFT', Math.max(-axes[0], 0)], ['MOVE_RIGHT', Math.max(axes[0], 0)],
        ['MOVE_UP', Math.max(-axes[1], 0)], ['MOVE_DOWN', Math.max(axes[1], 0)],
        ['AIM_LEFT', Math.max(-axes[2], 0)], ['AIM_RIGHT', Math.max(axes[2], 0)],
        ['AIM_UP', Math.max(-axes[3], 0)], ['AIM_DOWN', Math.max(axes[3], 0)],
      ];
      for (const [action, value] of digital) actionValues.set(action, Math.max(actionValues.get(action) ?? 0, value));
      pad.buttons.forEach((button, index) => {
        for (const action of BUTTON_ACTIONS[index] ?? []) actionValues.set(action, Math.max(actionValues.get(action) ?? 0, button.value));
      });
    }
    for (const [action, value] of actionValues) this.sink.setActionValue(action, value, this.sourceId);
  }

  gamepadSeats(): readonly GamepadSeatState[] { return this.#states; }

  gamepadAxis(seat: number, axis: AxisName): number {
    const values = this.#axesBySeat.get(seat);
    if (!values) return 0;
    return values[axis === 'horizontal' ? 0 : axis === 'vertical' ? 1 : axis === 'aim-horizontal' ? 2 : 3];
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.target.removeEventListener('gamepadconnected', this.#onConnection);
    this.target.removeEventListener('gamepaddisconnected', this.#onConnection);
    for (const action of ACTION_IDS) this.sink.setActionValue(action, 0, this.sourceId);
    this.#states = [];
    this.#axesBySeat.clear();
  }

  #assign(index: number): void {
    if (this.#seatByIndex.has(index)) return;
    const used = new Set(this.#seatByIndex.values());
    for (let seat = 0; seat < 4; seat++) {
      if (!used.has(seat)) {
        this.#seatByIndex.set(index, seat);
        return;
      }
    }
  }

  #axis(raw: number): number {
    const magnitude = Math.abs(raw);
    if (magnitude <= this.deadzone) return 0;
    return Math.sign(raw) * Math.min(1, (magnitude - this.deadzone) / (1 - this.deadzone));
  }
}
