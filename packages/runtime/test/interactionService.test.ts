/**
 * InteractionServiceImpl: scene-scoped world-space targeting (ADR-0018).
 *
 * Driven against a hand-built pointer state so hover / press / click / drag /
 * drop transitions are exercised deterministically, without a browser.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SpatialPointerInput, SpatialPointerState } from '@sw2d/contracts';
import { InteractionServiceImpl } from '../src/game-support/interactionService.ts';

class FakePointer implements SpatialPointerInput {
  #s: SpatialPointerState = {
    screenX: 0,
    screenY: 0,
    worldX: 0,
    worldY: 0,
    down: false,
    justPressed: false,
    justReleased: false,
    source: 'mouse',
    inside: true,
    active: true,
    dragging: false,
    dragStartWorldX: 0,
    dragStartWorldY: 0,
    dragDeltaWorldX: 0,
    dragDeltaWorldY: 0,
  };
  set(patch: Partial<SpatialPointerState>): void {
    this.#s = { ...this.#s, ...patch };
  }
  get state(): SpatialPointerState {
    return this.#s;
  }
  worldPoint(): readonly [number, number] {
    return [this.#s.worldX, this.#s.worldY];
  }
}

function rect(x: number, y: number, w: number, h: number) {
  return { kind: 'rect' as const, x, y, width: w, height: h };
}

describe('InteractionServiceImpl - hover', () => {
  let pointer: FakePointer;
  let svc: InteractionServiceImpl;
  beforeEach(() => {
    pointer = new FakePointer();
    svc = new InteractionServiceImpl(pointer);
  });

  it('fires hover enter/leave as the pointer crosses a target', () => {
    const enter = vi.fn();
    const leave = vi.fn();
    svc.register({ id: 'a', shape: rect(0, 0, 10, 10), onHoverEnter: enter, onHoverLeave: leave });

    pointer.set({ worldX: 5, worldY: 5 });
    svc.update();
    expect(enter).toHaveBeenCalledTimes(1);
    expect(svc.hoveredId).toBe('a');

    pointer.set({ worldX: 50, worldY: 50 });
    svc.update();
    expect(leave).toHaveBeenCalledTimes(1);
    expect(svc.hoveredId).toBeNull();
  });

  it('does not re-fire enter while the pointer stays inside', () => {
    const enter = vi.fn();
    svc.register({ id: 'a', shape: rect(0, 0, 10, 10), onHoverEnter: enter });
    pointer.set({ worldX: 2, worldY: 2 });
    svc.update();
    pointer.set({ worldX: 8, worldY: 8 });
    svc.update();
    expect(enter).toHaveBeenCalledTimes(1);
  });
});

describe('InteractionServiceImpl - overlap priority', () => {
  it('the higher-priority target under the pointer wins; ties break to the newer registration', () => {
    const pointer = new FakePointer();
    const svc = new InteractionServiceImpl(pointer);
    svc.register({ id: 'low', shape: rect(0, 0, 100, 100), priority: 0 });
    svc.register({ id: 'high', shape: rect(0, 0, 100, 100), priority: 10 });
    svc.register({ id: 'newer-low', shape: rect(0, 0, 100, 100), priority: 0 });

    pointer.set({ worldX: 50, worldY: 50 });
    svc.update();
    expect(svc.hoveredId).toBe('high');

    svc.unregister('high');
    pointer.set({ worldX: 51, worldY: 50 });
    svc.update();
    expect(svc.hoveredId).toBe('newer-low');
  });
});

describe('InteractionServiceImpl - click vs drag', () => {
  let pointer: FakePointer;
  let svc: InteractionServiceImpl;
  beforeEach(() => {
    pointer = new FakePointer();
    svc = new InteractionServiceImpl(pointer);
  });

  it('a press then release over the same target is a click', () => {
    const click = vi.fn();
    const press = vi.fn();
    const release = vi.fn();
    svc.register({ id: 'btn', shape: rect(0, 0, 20, 20), onClick: click, onPress: press, onRelease: release });

    pointer.set({ worldX: 10, worldY: 10, down: true, justPressed: true });
    svc.update();
    expect(press).toHaveBeenCalledTimes(1);
    expect(svc.pressedId).toBe('btn');

    pointer.set({ justPressed: false });
    svc.update();

    pointer.set({ down: false, justReleased: true });
    svc.update();
    expect(release).toHaveBeenCalledTimes(1);
    expect(click).toHaveBeenCalledTimes(1);
    expect(svc.pressedId).toBeNull();
  });

  it('a press on empty space is not a click on any target', () => {
    const click = vi.fn();
    svc.register({ id: 'btn', shape: rect(0, 0, 20, 20), onClick: click });
    pointer.set({ worldX: 200, worldY: 200, down: true, justPressed: true });
    svc.update();
    pointer.set({ justPressed: false, down: false, justReleased: true });
    svc.update();
    expect(click).not.toHaveBeenCalled();
    expect(svc.pressedId).toBeNull();
  });

  it('a drag captures its origin target even when the pointer leaves it, and resolves a drop zone', () => {
    const dragStart = vi.fn();
    const drag = vi.fn();
    const dragEnd = vi.fn();
    const drop = vi.fn();
    const click = vi.fn();
    svc.register({
      id: 'piece',
      shape: rect(0, 0, 20, 20),
      onDragStart: dragStart,
      onDrag: drag,
      onDragEnd: dragEnd,
      onClick: click,
    });
    svc.register({ id: 'bin', shape: rect(100, 0, 40, 40), dropZone: true, onDrop: drop });

    // Press on the piece.
    pointer.set({ worldX: 10, worldY: 10, down: true, justPressed: true });
    svc.update();
    // Move past threshold - host would report dragging + deltas.
    pointer.set({
      worldX: 60,
      worldY: 10,
      justPressed: false,
      dragging: true,
      dragStartWorldX: 10,
      dragStartWorldY: 10,
      dragDeltaWorldX: 50,
      dragDeltaWorldY: 0,
    });
    svc.update();
    expect(dragStart).toHaveBeenCalledTimes(1);
    expect(svc.draggingId).toBe('piece');

    // Pointer now well outside the piece's own shape - still the drag target.
    pointer.set({ worldX: 120, worldY: 20, dragDeltaWorldX: 110, dragDeltaWorldY: 10 });
    svc.update();
    expect(drag).toHaveBeenCalled();
    expect(svc.draggingId).toBe('piece');

    // Release over the bin.
    pointer.set({ worldX: 120, worldY: 20, down: false, justReleased: true, dragging: true });
    svc.update();
    expect(dragEnd).toHaveBeenCalledTimes(1);
    expect(dragEnd.mock.calls[0]![0].dropTargetId).toBe('bin');
    expect(drop).toHaveBeenCalledTimes(1);
    expect(drop.mock.calls[0]![0].sourceId).toBe('piece');
    expect(click).not.toHaveBeenCalled(); // a drag is not a click
    expect(svc.draggingId).toBeNull();
  });
});

describe('InteractionServiceImpl - lifecycle', () => {
  it('setEnabled(false) removes a target from hit-testing; re-enable restores it', () => {
    const pointer = new FakePointer();
    const svc = new InteractionServiceImpl(pointer);
    const handle = svc.register({ id: 'a', shape: rect(0, 0, 10, 10) });
    pointer.set({ worldX: 5, worldY: 5 });
    svc.update();
    expect(svc.hoveredId).toBe('a');

    handle.setEnabled(false);
    svc.update();
    expect(svc.hoveredId).toBeNull();

    handle.setEnabled(true);
    svc.update();
    expect(svc.hoveredId).toBe('a');
  });

  it('a live shape provider returning null makes the target un-hittable that frame', () => {
    const pointer = new FakePointer();
    const svc = new InteractionServiceImpl(pointer);
    let alive = true;
    svc.register({ id: 'a', shape: () => (alive ? rect(0, 0, 10, 10) : null) });
    pointer.set({ worldX: 5, worldY: 5 });
    svc.update();
    expect(svc.hoveredId).toBe('a');
    alive = false;
    svc.update();
    expect(svc.hoveredId).toBeNull();
  });

  it('targetCount returns to its baseline across register/dispose cycles - no leak', () => {
    const pointer = new FakePointer();
    const svc = new InteractionServiceImpl(pointer);
    for (let i = 0; i < 10; i++) {
      const h1 = svc.register({ id: 'x', shape: rect(0, 0, 5, 5) });
      const h2 = svc.register({ id: 'y', shape: rect(0, 0, 5, 5) });
      expect(svc.targetCount).toBe(2);
      h1.dispose();
      h2.dispose();
      expect(svc.targetCount).toBe(0);
    }
  });

  it('rejects a duplicate id and stops firing callbacks after dispose', () => {
    const pointer = new FakePointer();
    const svc = new InteractionServiceImpl(pointer);
    const hover = vi.fn();
    svc.register({ id: 'a', shape: rect(0, 0, 10, 10), onHoverEnter: hover });
    expect(() => svc.register({ id: 'a', shape: rect(0, 0, 1, 1) })).toThrow(/already registered/);

    svc.dispose();
    pointer.set({ worldX: 5, worldY: 5 });
    svc.update();
    expect(hover).not.toHaveBeenCalled();
    expect(svc.targetCount).toBe(0);
  });
});
