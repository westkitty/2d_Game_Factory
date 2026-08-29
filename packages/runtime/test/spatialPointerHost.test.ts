/**
 * SpatialPointerHost: the single owner of world-space pointer state (ADR-0018).
 *
 * Most of this drives the host through its `SpatialPointerSink` methods, which
 * need no DOM. The listener-leak test uses a fake EventTarget for `root` and
 * `window`, the same pattern as startControls.test.ts.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SpatialPointerHost, type WorldResolver } from '../src/input/SpatialPointerHost.ts';

const identity: WorldResolver = (x, y) => [x, y];
const canvasSpace = (x: number, y: number): readonly [number, number] => [x, y];

class FakeEventTarget {
  readonly handlers = new Map<string, Set<(event: unknown) => void>>();
  addEventListener(type: string, handler: (event: unknown) => void): void {
    (this.handlers.get(type) ?? this.handlers.set(type, new Set()).get(type)!).add(handler);
  }
  removeEventListener(type: string, handler: (event: unknown) => void): void {
    this.handlers.get(type)?.delete(handler);
  }
  count(): number {
    let total = 0;
    for (const set of this.handlers.values()) total += set.size;
    return total;
  }
}

describe('SpatialPointerHost - frame edges', () => {
  let win: FakeEventTarget;
  let root: FakeEventTarget;
  beforeEach(() => {
    win = new FakeEventTarget();
    root = new FakeEventTarget();
    vi.stubGlobal('window', win);
  });
  afterEach(() => vi.unstubAllGlobals());

  function host(resolve: WorldResolver = identity): SpatialPointerHost {
    return new SpatialPointerHost(root as unknown as HTMLElement, resolve, canvasSpace);
  }

  it('starts idle and inactive', () => {
    const h = host();
    expect(h.state.active).toBe(false);
    expect(h.state.down).toBe(false);
    expect(h.state.source).toBeNull();
  });

  it('reports justPressed for exactly one frame, then justReleased for one frame', () => {
    const h = host();
    h.setPointerButton(true, 'mouse');
    h.update();
    expect(h.state.down).toBe(true);
    expect(h.state.justPressed).toBe(true);
    expect(h.state.justReleased).toBe(false);

    h.update();
    expect(h.state.down).toBe(true);
    expect(h.state.justPressed).toBe(false);

    h.setPointerButton(false, 'mouse');
    h.update();
    expect(h.state.down).toBe(false);
    expect(h.state.justReleased).toBe(true);

    h.update();
    expect(h.state.justReleased).toBe(false);
  });

  it('latches a press+release inside one frame rather than dropping it', () => {
    const h = host();
    h.setPointerButton(true, 'touch');
    h.setPointerButton(false, 'touch');
    h.update();
    expect(h.state.down).toBe(true);
    expect(h.state.justPressed).toBe(true);
    h.update();
    expect(h.state.down).toBe(false);
    expect(h.state.justReleased).toBe(true);
  });

  it('carries the source device kind (mouse / pen / touch parity)', () => {
    const h = host();
    h.setPointerPosition(1, 1, 'touch');
    h.update();
    expect(h.state.source).toBe('touch');
    h.setPointerPosition(2, 2, 'pen');
    h.update();
    expect(h.state.source).toBe('pen');
  });
});

describe('SpatialPointerHost - screen/world conversion', () => {
  beforeEach(() => vi.stubGlobal('window', new FakeEventTarget()));
  afterEach(() => vi.unstubAllGlobals());

  function host(resolve: WorldResolver): SpatialPointerHost {
    return new SpatialPointerHost(new FakeEventTarget() as unknown as HTMLElement, resolve, canvasSpace);
  }

  it('falls back to world == screen when no camera is active', () => {
    const h = host(() => null);
    h.setPointerPosition(120, 80, 'mouse');
    h.update();
    expect(h.state.worldX).toBe(120);
    expect(h.state.worldY).toBe(80);
  });

  it('applies a camera scroll + zoom transform', () => {
    // Camera scrolled to (200,100) at 2x zoom: worldPoint = scroll + screen/zoom.
    const scrolledZoomed: WorldResolver = (sx, sy) => [200 + sx / 2, 100 + sy / 2];
    const h = host(scrolledZoomed);
    h.setPointerPosition(64, 40, 'mouse');
    h.update();
    expect(h.state.worldX).toBe(232);
    expect(h.state.worldY).toBe(120);
    expect(h.worldPoint()).toEqual([232, 120]);
  });
});

describe('SpatialPointerHost - drag tracking', () => {
  beforeEach(() => vi.stubGlobal('window', new FakeEventTarget()));
  afterEach(() => vi.unstubAllGlobals());

  function host(): SpatialPointerHost {
    return new SpatialPointerHost(new FakeEventTarget() as unknown as HTMLElement, identity, canvasSpace);
  }

  it('does not report a drag for a press that never moves past the threshold', () => {
    const h = host();
    h.setPointerPosition(50, 50, 'mouse');
    h.setPointerButton(true, 'mouse');
    h.update();
    h.setPointerPosition(51, 51, 'mouse'); // < 4px
    h.update();
    expect(h.state.dragging).toBe(false);
  });

  it('reports dragging and a world-space delta once past the threshold, then clears after release', () => {
    const h = host();
    h.setPointerPosition(50, 50, 'mouse');
    h.setPointerButton(true, 'mouse');
    h.update();
    expect(h.state.dragStartWorldX).toBe(50);

    h.setPointerPosition(70, 58, 'mouse');
    h.update();
    expect(h.state.dragging).toBe(true);
    expect(h.state.dragDeltaWorldX).toBe(20);
    expect(h.state.dragDeltaWorldY).toBe(8);

    h.setPointerButton(false, 'mouse');
    h.update();
    // Still reported as a drag on the release frame, with the final delta.
    expect(h.state.dragging).toBe(true);
    expect(h.state.justReleased).toBe(true);
    expect(h.state.dragDeltaWorldX).toBe(20);

    h.update();
    expect(h.state.dragging).toBe(false);
    expect(h.state.dragDeltaWorldX).toBe(0);
  });
});

describe('SpatialPointerHost - listeners do not accumulate across restarts', () => {
  let win: FakeEventTarget;
  beforeEach(() => {
    win = new FakeEventTarget();
    vi.stubGlobal('window', win);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('every constructed host removes exactly what it added', () => {
    const root = new FakeEventTarget();
    for (let i = 0; i < 5; i++) {
      const h = new SpatialPointerHost(root as unknown as HTMLElement, identity, canvasSpace);
      expect(root.count()).toBeGreaterThan(0);
      expect(win.count()).toBeGreaterThan(0);
      h.dispose();
      expect(root.count()).toBe(0);
      expect(win.count()).toBe(0);
    }
  });

  it('a disposed host reports the idle state and ignores further updates', () => {
    const h = new SpatialPointerHost(new FakeEventTarget() as unknown as HTMLElement, identity, canvasSpace);
    h.setPointerButton(true, 'mouse');
    h.dispose();
    h.update();
    expect(h.state.down).toBe(false);
    expect(h.state.active).toBe(false);
  });
});
