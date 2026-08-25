import { describe, expect, it } from 'vitest';
import { ActionInputHost } from '../../src/input/ActionInputHost.ts';
import { DEFAULT_BINDINGS } from '../../src/input/defaultBindings.ts';
import { uiSimulationController } from '../../src/controllers/uiSimulationController.ts';

function hostWithDefaults(): ActionInputHost {
  return new ActionInputHost(DEFAULT_BINDINGS);
}

describe('uiSimulationController', () => {
  it('reports directional navigation', () => {
    const host = hostWithDefaults();
    host.setActionValue('MOVE_LEFT', 1, 'keyboard');
    host.update();

    const intent = uiSimulationController.read(host);
    expect(intent.navigateLeftPressed).toBe(true);
    expect(intent.navigateRightPressed).toBe(false);
    expect(intent.navigateUpPressed).toBe(false);
    expect(intent.navigateDownPressed).toBe(false);
  });

  it('navigation is a plain read: two observers in the same frame agree', () => {
    const host = hostWithDefaults();
    host.setActionValue('MOVE_UP', 1, 'keyboard');
    host.update();

    expect(uiSimulationController.read(host).navigateUpPressed).toBe(true);
    expect(uiSimulationController.read(host).navigateUpPressed).toBe(true);
  });

  it('reports confirm and cancel', () => {
    const host = hostWithDefaults();
    host.setActionValue('CONFIRM', 1, 'keyboard');
    host.update();
    expect(uiSimulationController.read(host).confirmPressed).toBe(true);

    const host2 = hostWithDefaults();
    host2.setActionValue('CANCEL', 1, 'keyboard');
    host2.update();
    expect(uiSimulationController.read(host2).cancelPressed).toBe(true);
  });

  it('does not perform any scene-routing side effect - it only returns data', () => {
    const host = hostWithDefaults();
    host.setActionValue('PAUSE', 1, 'keyboard');
    host.update();

    // read() takes only an ActionInput and returns a plain object; there is
    // nothing here that could call a router, a scene, or Phaser.
    const intent = uiSimulationController.read(host);
    expect(intent).toEqual({
      navigateLeftPressed: false,
      navigateRightPressed: false,
      navigateUpPressed: false,
      navigateDownPressed: false,
      confirmPressed: false,
      cancelPressed: false,
      pausePressed: true,
      primaryPressed: false,
    });
  });

  describe('pause/resume double-consumption regression (ADR-0003)', () => {
    it('claims pausePressed for at most one reader per physical press', () => {
      const host = hostWithDefaults();
      host.setActionValue('PAUSE', 1, 'keyboard');
      host.update();

      // Simulates two layers alive in the same frame reading through the
      // same controller - e.g. a menu overlay resuming gameplay, and the
      // freshly-resumed gameplay scene reading the same physical press. Only
      // the first must see it, or pressing pause once would immediately
      // toggle twice (paused -> resumed -> paused again), exactly the bug
      // ADR-0003 fixed.
      const menuLayerReadsFirst = uiSimulationController.read(host);
      const gameplayLayerReadsSecond = uiSimulationController.read(host);

      expect(menuLayerReadsFirst.pausePressed).toBe(true);
      expect(gameplayLayerReadsSecond.pausePressed).toBe(false);
    });

    it('claims confirmPressed for at most one reader per physical press', () => {
      const host = hostWithDefaults();
      host.setActionValue('CONFIRM', 1, 'keyboard');
      host.update();

      const first = uiSimulationController.read(host);
      const second = uiSimulationController.read(host);

      expect(first.confirmPressed).toBe(true);
      expect(second.confirmPressed).toBe(false);
    });

    it('claiming confirmPressed does not affect the independently-tracked cancelPressed edge', () => {
      const host = hostWithDefaults();
      host.setActionValue('CONFIRM', 1, 'keyboard');
      host.setActionValue('CANCEL', 1, 'keyboard');
      host.update();

      const first = uiSimulationController.read(host);
      expect(first.confirmPressed).toBe(true);
      expect(first.cancelPressed).toBe(true);

      const second = uiSimulationController.read(host);
      expect(second.confirmPressed).toBe(false);
      expect(second.cancelPressed).toBe(false);
    });

    it('a claimed press does not reappear next frame while the key is only held', () => {
      const host = hostWithDefaults();
      host.setActionValue('PAUSE', 1, 'keyboard');
      host.update();
      expect(uiSimulationController.read(host).pausePressed).toBe(true);

      host.update(); // still held, no release/re-press
      expect(uiSimulationController.read(host).pausePressed).toBe(false);
    });
  });
});
