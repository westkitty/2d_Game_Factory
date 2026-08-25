import { describe, expect, it } from 'vitest';
import { ActionInputHost } from '../../src/input/ActionInputHost.ts';
import { DEFAULT_BINDINGS } from '../../src/input/defaultBindings.ts';
import { gridController } from '../../src/controllers/gridController.ts';

function hostWithDefaults(): ActionInputHost {
  return new ActionInputHost(DEFAULT_BINDINGS);
}

describe('gridController', () => {
  it('reports no step while neutral', () => {
    const host = hostWithDefaults();
    host.update();
    expect(gridController.read(host).step).toBeNull();
  });

  it('reports exactly one step on the press frame, then null while held', () => {
    const host = hostWithDefaults();
    host.setActionValue('MOVE_RIGHT', 1, 'keyboard');
    host.update();
    expect(gridController.read(host).step).toBe('right');

    // Still held, no new edge: no accidental double-step from one press.
    host.update();
    expect(gridController.read(host).step).toBeNull();

    host.update();
    expect(gridController.read(host).step).toBeNull();
  });

  it('reads twice in the same frame without changing the answer (no parallel edge tracker)', () => {
    const host = hostWithDefaults();
    host.setActionValue('MOVE_LEFT', 1, 'keyboard');
    host.update();

    expect(gridController.read(host).step).toBe('left');
    // Unlike platform's jumpPressed, grid step is a plain read: it does not
    // claim the edge, so a second observer in the same frame sees the same
    // step, not null.
    expect(gridController.read(host).step).toBe('left');
  });

  it('steps again only after release and a fresh press', () => {
    const host = hostWithDefaults();
    host.setActionValue('MOVE_DOWN', 1, 'keyboard');
    host.update();
    expect(gridController.read(host).step).toBe('down');

    host.setActionValue('MOVE_DOWN', 0, 'keyboard');
    host.update();
    expect(gridController.read(host).step).toBeNull();

    host.setActionValue('MOVE_DOWN', 1, 'keyboard');
    host.update();
    expect(gridController.read(host).step).toBe('down');
  });

  it('breaks a same-frame multi-direction tie deterministically (up > down > left > right)', () => {
    const host = hostWithDefaults();
    host.setActionValue('MOVE_LEFT', 1, 'keyboard');
    host.setActionValue('MOVE_UP', 1, 'keyboard');
    host.update();

    expect(gridController.read(host).step).toBe('up');
  });

  it('reports confirm/cancel as plain justPressed reads', () => {
    const host = hostWithDefaults();
    host.setActionValue('CONFIRM', 1, 'keyboard');
    host.update();

    expect(gridController.read(host).confirmPressed).toBe(true);
    expect(gridController.read(host).cancelPressed).toBe(false);
  });
});
