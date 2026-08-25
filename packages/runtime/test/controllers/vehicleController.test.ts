import { describe, expect, it } from 'vitest';
import { ActionInputHost } from '../../src/input/ActionInputHost.ts';
import { DEFAULT_BINDINGS } from '../../src/input/defaultBindings.ts';
import { vehicleController } from '../../src/controllers/vehicleController.ts';

function hostWithDefaults(): ActionInputHost {
  return new ActionInputHost(DEFAULT_BINDINGS);
}

describe('vehicleController', () => {
  it('is neutral with no input', () => {
    const host = hostWithDefaults();
    host.update();

    expect(vehicleController.read(host)).toEqual({
      steering: 0,
      throttle: 0,
      brake: 0,
      boostPressed: false,
      boostHeld: false,
      secondaryPressed: false,
    });
  });

  it('reports steering sign correctly', () => {
    const host = hostWithDefaults();
    host.setActionValue('MOVE_LEFT', 1, 'keyboard');
    host.update();
    expect(vehicleController.read(host).steering).toBe(-1);

    host.setActionValue('MOVE_LEFT', 0, 'keyboard');
    host.setActionValue('MOVE_RIGHT', 1, 'keyboard');
    host.update();
    expect(vehicleController.read(host).steering).toBe(1);
  });

  it('maps MOVE_UP/MOVE_DOWN to throttle/brake independently', () => {
    const host = hostWithDefaults();
    host.setActionValue('MOVE_UP', 1, 'keyboard');
    host.update();

    let intent = vehicleController.read(host);
    expect(intent.throttle).toBe(1);
    expect(intent.brake).toBe(0);

    host.setActionValue('MOVE_UP', 0, 'keyboard');
    host.setActionValue('MOVE_DOWN', 1, 'keyboard');
    host.update();

    intent = vehicleController.read(host);
    expect(intent.throttle).toBe(0);
    expect(intent.brake).toBe(1);
  });

  it('reports boost press/held and secondary action', () => {
    const host = hostWithDefaults();
    host.setActionValue('DASH', 1, 'keyboard');
    host.setActionValue('SECONDARY_ACTION', 1, 'keyboard');
    host.update();

    const intent = vehicleController.read(host);
    expect(intent.boostPressed).toBe(true);
    expect(intent.boostHeld).toBe(true);
    expect(intent.secondaryPressed).toBe(true);
  });
});
