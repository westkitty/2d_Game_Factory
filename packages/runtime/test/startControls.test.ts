/**
 * The visible Start control is a plain DOM button carrying
 * `data-sw2d-action="CONFIRM"`. It must reach the game only through the
 * semantic input layer - a click is an ordinary CONFIRM press, claimed once,
 * with no second start path and no double-fire (ADR-0003).
 *
 * The runtime test env has no DOM, so this stubs the minimum of `window` /
 * `Element` that `PointerAdapter` touches. The full click-to-run path is also
 * covered by the browser QA `tools/scripts/qa-start-controls.ts`.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ActionInputHost } from '../src/input/ActionInputHost.ts';
import { PointerAdapter } from '../src/input/PointerAdapter.ts';
import { DEFAULT_BINDINGS } from '../src/input/defaultBindings.ts';

class FakeElement {
  readonly dataset: Record<string, string>;
  #self: FakeElement;
  constructor(action?: string) {
    this.dataset = action ? { sw2dAction: action } : {};
    this.#self = this;
  }
  closest(selector: string): FakeElement | null {
    return selector === '[data-sw2d-action]' && this.dataset['sw2dAction'] ? this.#self : null;
  }
  setPointerCapture(): void {
    /* no-op */
  }
}

class FakeEventTarget {
  readonly handlers = new Map<string, Set<(event: unknown) => void>>();
  addEventListener(type: string, handler: (event: unknown) => void): void {
    (this.handlers.get(type) ?? this.handlers.set(type, new Set()).get(type)!).add(handler);
  }
  removeEventListener(type: string, handler: (event: unknown) => void): void {
    this.handlers.get(type)?.delete(handler);
  }
  fire(type: string, event: unknown): void {
    for (const handler of this.handlers.get(type) ?? []) handler(event);
  }
}

describe('visible Start control -> semantic CONFIRM', () => {
  let root: FakeEventTarget;
  let fakeWindow: FakeEventTarget;

  beforeEach(() => {
    root = new FakeEventTarget();
    fakeWindow = new FakeEventTarget();
    vi.stubGlobal('window', fakeWindow);
    vi.stubGlobal('Element', FakeElement);
  });
  afterEach(() => vi.unstubAllGlobals());

  function pointerEvent(target: FakeElement, pointerId = 1): Record<string, unknown> {
    return { target, pointerId, preventDefault: () => undefined };
  }

  it('routes a pointerdown on a data-sw2d-action="CONFIRM" element to the CONFIRM action', () => {
    const host = new ActionInputHost(DEFAULT_BINDINGS);
    host.addAdapter(new PointerAdapter(host, root as unknown as HTMLElement));

    const startButton = new FakeElement('CONFIRM');
    root.fire('pointerdown', pointerEvent(startButton));
    host.update();

    expect(host.isDown('CONFIRM')).toBe(true);
    expect(host.justPressed('CONFIRM')).toBe(true);
  });

  it('is claimed exactly once - one click cannot start twice or leak into a later reader', () => {
    const host = new ActionInputHost(DEFAULT_BINDINGS);
    host.addAdapter(new PointerAdapter(host, root as unknown as HTMLElement));
    const startButton = new FakeElement('CONFIRM');

    root.fire('pointerdown', pointerEvent(startButton));
    host.update();

    // First reader (the title state) claims it.
    expect(host.consumePress('CONFIRM')).toBe(true);
    // Any second reader in the same frame gets nothing.
    expect(host.consumePress('CONFIRM')).toBe(false);
    expect(host.justPressed('CONFIRM')).toBe(false);

    // pointerup releases; the next frame is a clean no-press.
    root.fire('pointerup', pointerEvent(startButton));
    host.update();
    expect(host.isDown('CONFIRM')).toBe(false);
    expect(host.justPressed('CONFIRM')).toBe(false);
  });

  it('a non-action element (e.g. the canvas) does not start anything', () => {
    const host = new ActionInputHost(DEFAULT_BINDINGS);
    host.addAdapter(new PointerAdapter(host, root as unknown as HTMLElement));

    root.fire('pointerdown', pointerEvent(new FakeElement()));
    host.update();
    expect(host.isDown('CONFIRM')).toBe(false);
  });

  it('the default CONFIRM binding exposes both an Enter/Space keyboard path and a CONFIRM pointer target', () => {
    expect(DEFAULT_BINDINGS.CONFIRM?.keyboard).toEqual(['Enter', 'Space', 'NumpadEnter']);
    expect(DEFAULT_BINDINGS.CONFIRM?.pointerTargets).toContain('CONFIRM');
  });
});
