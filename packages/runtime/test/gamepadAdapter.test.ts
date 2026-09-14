import { describe, expect, it, vi } from 'vitest';
import type { ActionId, ActionSink, InputSourceId } from '@sw2d/contracts';
import { GamepadAdapter } from '../src/input/GamepadAdapter.ts';

function pad(index: number, axes: number[], pressed: readonly number[] = []): Gamepad {
  return {
    index, id: `pad-${index}`, connected: true, mapping: 'standard', timestamp: 1, axes,
    buttons: Array.from({ length: 16 }, (_, button) => ({ pressed: pressed.includes(button), touched: pressed.includes(button), value: pressed.includes(button) ? 1 : 0 })),
    vibrationActuator: null,
  } as unknown as Gamepad;
}

describe('GamepadAdapter', () => {
  it('polls standard axes/buttons with a deadzone and semantic routing', () => {
    const values = new Map<ActionId, number>();
    const sink: ActionSink = { setActionValue(action: ActionId, value: number, _source: InputSourceId) { values.set(action, value); } };
    let pads: readonly (Gamepad | null)[] = [pad(2, [0.1, -1, 0.6, 0], [2, 9])];
    const target = new EventTarget();
    const adapter = new GamepadAdapter(sink, target, () => pads, 0.2);
    adapter.poll();
    expect(values.get('MOVE_UP')).toBe(1);
    expect(values.get('MOVE_RIGHT')).toBe(0);
    expect(values.get('AIM_RIGHT')).toBeCloseTo(0.5);
    expect(values.get('PRIMARY_ACTION')).toBe(1);
    expect(values.get('PAUSE')).toBe(1);
    expect(adapter.gamepadSeats()).toEqual([{ seat: 0, index: 2, id: 'pad-2', connected: true, mapping: 'standard' }]);
    expect(adapter.gamepadAxis(0, 'vertical')).toBe(-1);
    pads = [];
    adapter.poll();
    expect(adapter.gamepadSeats()).toEqual([]);
    expect(values.get('PRIMARY_ACTION')).toBe(0);
  });

  it('assigns multiple controllers stably across disconnect/reconnect and cleans listeners', () => {
    const sink: ActionSink = { setActionValue: vi.fn() };
    let pads: readonly (Gamepad | null)[] = [pad(4, [0, 0]), pad(7, [1, 0])];
    const target = new EventTarget();
    const remove = vi.spyOn(target, 'removeEventListener');
    const adapter = new GamepadAdapter(sink, target, () => pads);
    adapter.poll();
    expect(adapter.gamepadSeats().map((state) => [state.index, state.seat])).toEqual([[4, 0], [7, 1]]);
    pads = [pad(7, [-1, 0])];
    target.dispatchEvent(new Event('gamepaddisconnected'));
    expect(adapter.gamepadSeats().map((state) => [state.index, state.seat])).toEqual([[7, 1]]);
    pads = [pad(4, [0, 0]), pad(7, [0, 0])];
    target.dispatchEvent(new Event('gamepadconnected'));
    expect(adapter.gamepadSeats().map((state) => [state.index, state.seat])).toEqual([[4, 0], [7, 1]]);
    adapter.dispose();
    expect(remove).toHaveBeenCalledTimes(2);
    expect(adapter.gamepadSeats()).toEqual([]);
  });
});
