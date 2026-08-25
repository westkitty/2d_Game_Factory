import { describe, expect, it } from 'vitest';
import { ActionInputHost } from '../../src/input/ActionInputHost.ts';
import { DEFAULT_BINDINGS } from '../../src/input/defaultBindings.ts';
import { gridController } from '../../src/controllers/gridController.ts';
import { platformController } from '../../src/controllers/platformController.ts';
import { pointerActionController } from '../../src/controllers/pointerActionController.ts';
import { topDownController } from '../../src/controllers/topDownController.ts';
import { uiSimulationController } from '../../src/controllers/uiSimulationController.ts';
import { vehicleController } from '../../src/controllers/vehicleController.ts';

/**
 * Cross-family checks that apply to every controller, independent of what
 * each one's intent shape contains.
 */
const CONTROLLERS = {
  platform: platformController,
  topDown: topDownController,
  vehicle: vehicleController,
  grid: gridController,
  pointerAction: pointerActionController,
  uiSimulation: uiSimulationController,
} as const;

function hostWithDefaults(): ActionInputHost {
  return new ActionInputHost(DEFAULT_BINDINGS);
}

describe('controller families - shared contract', () => {
  it('every controller is a plain object exposing only read() - no owned frame advancement, no lifecycle to leak', () => {
    for (const [name, controller] of Object.entries(CONTROLLERS)) {
      expect(Object.keys(controller), name).toEqual(['read']);
      expect(typeof controller.read, name).toBe('function');
    }
  });

  it('reading every controller many times against a stable host does not throw or accumulate observable state', () => {
    const host = hostWithDefaults();
    host.setActionValue('MOVE_RIGHT', 1, 'keyboard');
    host.update();

    for (let i = 0; i < 1000; i += 1) {
      for (const controller of Object.values(CONTROLLERS)) {
        controller.read(host);
      }
    }

    // Reading 1000 times did not itself advance a frame or mutate held
    // state: the axis a genuinely stateless read depends on is unchanged.
    expect(host.isDown('MOVE_RIGHT')).toBe(true);
    expect(host.adapterCount).toBe(0);
  });

  it('each controller consumes only the read-only ActionInput surface, not ActionInputHost internals', () => {
    // A minimal object satisfying the ActionInput interface, with none of
    // ActionInputHost's frame-advancement machinery (update/setActionValue/
    // addAdapter/dispose). If a controller needed anything beyond ActionInput,
    // this would fail to typecheck or throw at the call site.
    const fakeInput = {
      isDown: () => true,
      justPressed: () => true,
      justReleased: () => false,
      value: () => 1,
      axis: () => 0,
      state: () => ({ down: true, justPressed: true, justReleased: false, value: 1, source: null }),
      consumePress: () => true,
      values: () => ({}) as never,
      bindings: {},
    };

    for (const controller of Object.values(CONTROLLERS)) {
      expect(() => controller.read(fakeInput)).not.toThrow();
    }
  });
});
