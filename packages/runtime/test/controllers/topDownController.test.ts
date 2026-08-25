import { describe, expect, it } from 'vitest';
import { ActionInputHost } from '../../src/input/ActionInputHost.ts';
import { DEFAULT_BINDINGS } from '../../src/input/defaultBindings.ts';
import { topDownController } from '../../src/controllers/topDownController.ts';

function hostWithDefaults(): ActionInputHost {
  return new ActionInputHost(DEFAULT_BINDINGS);
}

describe('topDownController', () => {
  it('is neutral with no input', () => {
    const host = hostWithDefaults();
    host.update();

    const intent = topDownController.read(host);
    expect(intent.moveX).toBe(0);
    expect(intent.moveY).toBe(0);
    expect(intent.moveMagnitude).toBe(0);
  });

  it('reports the four cardinal directions at full magnitude', () => {
    const host = hostWithDefaults();
    host.setActionValue('MOVE_RIGHT', 1, 'keyboard');
    host.update();

    const right = topDownController.read(host);
    expect(right.moveX).toBe(1);
    expect(right.moveY).toBe(0);
    expect(right.moveMagnitude).toBe(1);
  });

  it('bounds diagonal magnitude to 1, not sqrt(2)', () => {
    const host = hostWithDefaults();
    host.setActionValue('MOVE_RIGHT', 1, 'keyboard');
    host.setActionValue('MOVE_DOWN', 1, 'keyboard');
    host.update();

    const intent = topDownController.read(host);
    const magnitude = Math.hypot(intent.moveX, intent.moveY);
    expect(magnitude).toBeCloseTo(1, 10);
    expect(intent.moveMagnitude).toBeCloseTo(1, 10);
    // Direction is preserved: equal components on a 45-degree diagonal.
    expect(intent.moveX).toBeCloseTo(Math.SQRT1_2, 10);
    expect(intent.moveY).toBeCloseTo(Math.SQRT1_2, 10);
  });

  it('produces determinstic output for the same action state (pure, non-claiming reads)', () => {
    const host = hostWithDefaults();
    host.setActionValue('MOVE_DOWN', 1, 'keyboard');
    host.setActionValue('MOVE_LEFT', 1, 'keyboard');
    host.update();

    const first = topDownController.read(host);
    const second = topDownController.read(host);
    expect(second).toEqual(first);
  });

  it('reports action intents independent of movement', () => {
    const host = hostWithDefaults();
    host.setActionValue('PRIMARY_ACTION', 1, 'keyboard');
    host.setActionValue('DASH', 1, 'keyboard');
    host.update();

    const intent = topDownController.read(host);
    expect(intent.primaryPressed).toBe(true);
    expect(intent.dashPressed).toBe(true);
    expect(intent.dashHeld).toBe(true);
    expect(intent.secondaryPressed).toBe(false);
    expect(intent.interactPressed).toBe(false);
  });
});
