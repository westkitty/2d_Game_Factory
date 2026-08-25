import { describe, expect, it } from 'vitest';
import { ActionInputHost } from '../../src/input/ActionInputHost.ts';
import { DEFAULT_BINDINGS } from '../../src/input/defaultBindings.ts';
import { platformController } from '../../src/controllers/platformController.ts';

function hostWithDefaults(): ActionInputHost {
  return new ActionInputHost(DEFAULT_BINDINGS);
}

describe('platformController', () => {
  it('reports a signed left/right axis', () => {
    const host = hostWithDefaults();
    host.setActionValue('MOVE_RIGHT', 1, 'keyboard');
    host.update();
    expect(platformController.read(host).moveAxis).toBe(1);

    host.setActionValue('MOVE_LEFT', 1, 'keyboard');
    host.update();
    expect(platformController.read(host).moveAxis).toBe(0);
  });

  it('claims the jump edge: at most one reader per physical press', () => {
    const host = hostWithDefaults();
    host.setActionValue('JUMP', 1, 'keyboard');
    host.update();

    expect(platformController.read(host).jumpPressed).toBe(true);
    expect(platformController.read(host).jumpPressed).toBe(false);

    host.update(); // held, no new edge
    expect(platformController.read(host).jumpPressed).toBe(false);
    expect(platformController.read(host).jumpHeld).toBe(true);
  });

  it('reports dash press and held separately, without claiming either', () => {
    const host = hostWithDefaults();
    host.setActionValue('DASH', 1, 'keyboard');
    host.update();

    const first = platformController.read(host);
    const second = platformController.read(host);
    expect(first.dashPressed).toBe(true);
    expect(first.dashHeld).toBe(true);
    // Non-claiming: reading twice in the same frame agrees both times.
    expect(second.dashPressed).toBe(true);
    expect(second.dashHeld).toBe(true);
  });

  it('reports primary/secondary/interact as plain justPressed reads', () => {
    const host = hostWithDefaults();
    host.setActionValue('PRIMARY_ACTION', 1, 'keyboard');
    host.setActionValue('SECONDARY_ACTION', 1, 'keyboard');
    host.setActionValue('INTERACT', 1, 'keyboard');
    host.update();

    const intent = platformController.read(host);
    expect(intent.primaryPressed).toBe(true);
    expect(intent.secondaryPressed).toBe(true);
    expect(intent.interactPressed).toBe(true);
  });

  it('is neutral with no input', () => {
    const host = hostWithDefaults();
    host.update();

    expect(platformController.read(host)).toEqual({
      moveAxis: 0,
      jumpPressed: false,
      jumpHeld: false,
      dashPressed: false,
      dashHeld: false,
      primaryPressed: false,
      secondaryPressed: false,
      interactPressed: false,
    });
  });

  it('consumes only ActionInput - a minimal fake without update() satisfies read()', () => {
    // Structural proof the controller cannot call frame-advancement: it is
    // typed against the read-only ActionInput surface, not ActionInputHost.
    const fake = {
      isDown: () => false,
      justPressed: () => false,
      justReleased: () => false,
      value: () => 0,
      axis: () => 0.5,
      state: () => ({ down: false, justPressed: false, justReleased: false, value: 0, source: null }),
      consumePress: () => false,
      values: () => ({}) as never,
      bindings: {},
    };

    expect(platformController.read(fake).moveAxis).toBe(0.5);
  });
});
