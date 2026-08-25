import { describe, expect, it, vi } from 'vitest';
import type { ActionBindings, InputDeviceAdapter } from '@sw2d/contracts';
import { ActionInputHost } from '../src/input/ActionInputHost.ts';
import { DEFAULT_BINDINGS, mergeBindings } from '../src/input/defaultBindings.ts';

function hostWithDefaults(): ActionInputHost {
  return new ActionInputHost(DEFAULT_BINDINGS);
}

describe('ActionInputHost', () => {
  it('reports justPressed for exactly one frame', () => {
    const host = hostWithDefaults();

    host.setActionValue('JUMP', 1, 'keyboard');
    host.update();
    expect(host.justPressed('JUMP')).toBe(true);
    expect(host.isDown('JUMP')).toBe(true);

    host.update();
    expect(host.justPressed('JUMP')).toBe(false);
    expect(host.isDown('JUMP')).toBe(true);
  });

  it('reports justReleased for exactly one frame', () => {
    const host = hostWithDefaults();
    host.setActionValue('JUMP', 1, 'keyboard');
    host.update();
    host.update();

    host.setActionValue('JUMP', 0, 'keyboard');
    host.update();
    expect(host.justReleased('JUMP')).toBe(true);
    expect(host.isDown('JUMP')).toBe(false);

    host.update();
    expect(host.justReleased('JUMP')).toBe(false);
  });

  it('does not drop a press and release that happen inside one frame', () => {
    const host = hostWithDefaults();

    host.setActionValue('CONFIRM', 1, 'keyboard');
    host.setActionValue('CONFIRM', 0, 'keyboard');
    host.update();

    expect(host.justPressed('CONFIRM')).toBe(true);

    host.update();
    expect(host.justReleased('CONFIRM')).toBe(true);
  });

  it('gives two readers the same answer within one frame', () => {
    const host = hostWithDefaults();
    host.setActionValue('PAUSE', 1, 'keyboard');
    host.update();

    const readerOne = host.justPressed('PAUSE');
    const readerTwo = host.justPressed('PAUSE');

    expect(readerOne).toBe(true);
    expect(readerTwo).toBe(true);
  });

  it('lets only the first reader act on a press', () => {
    const host = hostWithDefaults();
    host.setActionValue('PAUSE', 1, 'keyboard');
    host.update();

    const menuLayer = host.consumePress('PAUSE');
    const gameplayLayer = host.consumePress('PAUSE');

    expect(menuLayer).toBe(true);
    expect(gameplayLayer).toBe(false);
    expect(host.justPressed('PAUSE')).toBe(false);
  });

  it('leaves the held state intact after a press is claimed', () => {
    const host = hostWithDefaults();
    host.setActionValue('MOVE_RIGHT', 1, 'keyboard');
    host.update();

    host.consumePress('MOVE_RIGHT');

    expect(host.isDown('MOVE_RIGHT')).toBe(true);
    expect(host.value('MOVE_RIGHT')).toBe(1);
  });

  it('reports the next press after an earlier one was claimed', () => {
    const host = hostWithDefaults();
    host.setActionValue('PAUSE', 1, 'keyboard');
    host.update();
    host.consumePress('PAUSE');

    host.setActionValue('PAUSE', 0, 'keyboard');
    host.update();
    host.setActionValue('PAUSE', 1, 'keyboard');
    host.update();

    expect(host.consumePress('PAUSE')).toBe(true);
  });

  it('returns false when claiming an action that was not pressed', () => {
    const host = hostWithDefaults();
    host.update();

    expect(host.consumePress('JUMP')).toBe(false);
  });

  it('combines opposed actions into a signed axis', () => {
    const host = hostWithDefaults();

    host.setActionValue('MOVE_RIGHT', 1, 'keyboard');
    host.update();
    expect(host.axis('MOVE_LEFT', 'MOVE_RIGHT')).toBe(1);

    host.setActionValue('MOVE_LEFT', 1, 'keyboard');
    host.update();
    expect(host.axis('MOVE_LEFT', 'MOVE_RIGHT')).toBe(0);
  });

  it('clamps analog values into 0..1', () => {
    const host = hostWithDefaults();

    host.setActionValue('MOVE_RIGHT', 4.5, 'gamepad');
    host.update();
    expect(host.value('MOVE_RIGHT')).toBe(1);

    host.setActionValue('MOVE_RIGHT', -3, 'gamepad');
    host.update();
    expect(host.value('MOVE_RIGHT')).toBe(0);
  });

  it('records which device last drove an action', () => {
    const host = hostWithDefaults();

    host.setActionValue('JUMP', 1, 'touch');
    host.update();

    expect(host.state('JUMP').source).toBe('touch');
  });

  it('clears held actions so a focus loss cannot stick a key down', () => {
    const host = hostWithDefaults();
    host.setActionValue('MOVE_LEFT', 1, 'keyboard');
    host.update();
    expect(host.isDown('MOVE_LEFT')).toBe(true);

    host.clear();
    host.update();

    expect(host.isDown('MOVE_LEFT')).toBe(false);
  });

  it('disposes every attached adapter exactly once', () => {
    const host = hostWithDefaults();
    const dispose = vi.fn();
    const adapter: InputDeviceAdapter = {
      sourceId: 'keyboard',
      applyBindings: vi.fn(),
      dispose,
    };
    host.addAdapter(adapter);
    expect(host.adapterCount).toBe(1);

    host.dispose();
    host.dispose();

    expect(dispose).toHaveBeenCalledTimes(1);
    expect(host.adapterCount).toBe(0);
  });

  it('pushes rebinds to every adapter without re-attaching them', () => {
    const host = hostWithDefaults();
    const applyBindings = vi.fn();
    host.addAdapter({ sourceId: 'keyboard', applyBindings, dispose: vi.fn() });
    expect(applyBindings).toHaveBeenCalledTimes(1);

    const custom: ActionBindings = { JUMP: { keyboard: ['KeyV'] } };
    host.setBindings(mergeBindings(custom));

    expect(applyBindings).toHaveBeenCalledTimes(2);
    expect(host.adapterCount).toBe(1);
  });

  it('polls adapters once per frame', () => {
    const host = hostWithDefaults();
    const poll = vi.fn();
    host.addAdapter({ sourceId: 'gamepad', applyBindings: vi.fn(), dispose: vi.fn(), poll });

    host.update();
    host.update();

    expect(poll).toHaveBeenCalledTimes(2);
  });
});

describe('mergeBindings', () => {
  it('replaces only the actions an override names', () => {
    const merged = mergeBindings({ JUMP: { keyboard: ['KeyV'] } });

    expect(merged.JUMP?.keyboard).toEqual(['KeyV']);
    expect(merged.MOVE_LEFT?.keyboard).toEqual(DEFAULT_BINDINGS.MOVE_LEFT?.keyboard);
  });

  it('returns the factory defaults when nothing is overridden', () => {
    expect(mergeBindings(undefined)).toBe(DEFAULT_BINDINGS);
  });

  it('never binds one key to both PAUSE and CANCEL', () => {
    const pause = new Set(DEFAULT_BINDINGS.PAUSE?.keyboard ?? []);
    const cancel = DEFAULT_BINDINGS.CANCEL?.keyboard ?? [];

    expect(cancel.filter((code) => pause.has(code))).toEqual([]);
  });
});
