import type {
  Disposable,
  PointerSourceKind,
  SpatialPointerInput,
  SpatialPointerSink,
  SpatialPointerState,
} from '@sw2d/contracts';

/** Screen-space movement, in canvas pixels, before a held press becomes a drag. */
export const DRAG_THRESHOLD_PX = 4;

/**
 * Resolves a canvas-space point to a world-space point through the active
 * camera. Returns null when no camera is active, in which case the host
 * reports world == screen (e.g. the title screen has no play camera).
 */
export type WorldResolver = (screenX: number, screenY: number) => readonly [number, number] | null;

/**
 * Maps a DOM client point to canvas (game) pixels. Injected so the host does
 * not depend on the renderer for its coordinate maths; the runtime supplies
 * one backed by the live canvas bounds.
 */
export type CanvasSpaceResolver = (clientX: number, clientY: number) => readonly [number, number];

const IDLE_STATE: SpatialPointerState = {
  screenX: 0,
  screenY: 0,
  worldX: 0,
  worldY: 0,
  down: false,
  justPressed: false,
  justReleased: false,
  source: null,
  inside: false,
  active: false,
  dragging: false,
  dragStartWorldX: 0,
  dragStartWorldY: 0,
  dragDeltaWorldX: 0,
  dragDeltaWorldY: 0,
};

/**
 * The single owner of spatial pointer state.
 *
 * DOM listeners push raw position/button in; `update()` - called exactly once
 * per game step from the runtime's PRE_STEP handler, alongside
 * `ActionInputHost.update()` - advances edges and drag tracking. A press and
 * release inside one frame is latched, not dropped, identical to the semantic
 * input host. Listeners are attached once and removed on dispose, so restarts
 * cannot accumulate handlers.
 */
export class SpatialPointerHost implements SpatialPointerInput, SpatialPointerSink, Disposable {
  readonly #root: HTMLElement;
  readonly #resolveWorld: WorldResolver;
  readonly #toCanvasSpace: CanvasSpaceResolver;
  #disposed = false;

  // Raw device state, written by listeners, sampled by update().
  #rawScreenX = 0;
  #rawScreenY = 0;
  #rawDown = false;
  #rawInside = false;
  #rawSource: PointerSourceKind | null = null;
  #everActive = false;
  #pressLatch = false;

  // Frame state, produced by update().
  #screenX = 0;
  #screenY = 0;
  #worldX = 0;
  #worldY = 0;
  #down = false;
  #justPressed = false;
  #justReleased = false;
  #dragging = false;
  #dragStartScreenX = 0;
  #dragStartScreenY = 0;
  #dragStartWorldX = 0;
  #dragStartWorldY = 0;
  #dragDeltaWorldX = 0;
  #dragDeltaWorldY = 0;

  readonly #onPointerMove = (event: Event): void => {
    const pe = event as PointerEvent;
    const [x, y] = this.#toCanvasSpace(pe.clientX, pe.clientY);
    this.#rawScreenX = x;
    this.#rawScreenY = y;
    this.#rawSource = pointerKind(pe);
    this.#everActive = true;
  };

  readonly #onPointerDown = (event: Event): void => {
    const pe = event as PointerEvent;
    if (pe.button !== 0 && pe.pointerType === 'mouse') return;
    const [x, y] = this.#toCanvasSpace(pe.clientX, pe.clientY);
    this.#rawScreenX = x;
    this.#rawScreenY = y;
    this.#rawSource = pointerKind(pe);
    this.#rawInside = true;
    if (!this.#rawDown) this.#pressLatch = true;
    this.#rawDown = true;
    this.#everActive = true;
  };

  readonly #onPointerUp = (event: Event): void => {
    const pe = event as PointerEvent;
    if (pe.button !== 0 && pe.pointerType === 'mouse') return;
    const [x, y] = this.#toCanvasSpace(pe.clientX, pe.clientY);
    this.#rawScreenX = x;
    this.#rawScreenY = y;
    this.#rawSource = pointerKind(pe);
    this.#rawDown = false;
    this.#everActive = true;
  };

  readonly #onPointerEnter = (): void => {
    this.#rawInside = true;
  };

  readonly #onPointerLeave = (): void => {
    this.#rawInside = false;
  };

  constructor(root: HTMLElement, resolveWorld: WorldResolver, toCanvasSpace: CanvasSpaceResolver) {
    this.#root = root;
    this.#resolveWorld = resolveWorld;
    this.#toCanvasSpace = toCanvasSpace;
    root.addEventListener('pointermove', this.#onPointerMove);
    root.addEventListener('pointerdown', this.#onPointerDown);
    root.addEventListener('pointerup', this.#onPointerUp);
    root.addEventListener('pointercancel', this.#onPointerUp);
    root.addEventListener('pointerenter', this.#onPointerEnter);
    root.addEventListener('pointerleave', this.#onPointerLeave);
    // A drag that leaves the canvas must keep tracking until the button is
    // released anywhere - the pointer-capture guarantee.
    window.addEventListener('pointermove', this.#onPointerMove);
    window.addEventListener('pointerup', this.#onPointerUp);
  }

  // --- SpatialPointerSink (also used directly by tests) -------------------

  setPointerPosition(screenX: number, screenY: number, source: PointerSourceKind): void {
    this.#rawScreenX = screenX;
    this.#rawScreenY = screenY;
    this.#rawSource = source;
    this.#everActive = true;
  }

  setPointerButton(down: boolean, source: PointerSourceKind): void {
    if (down && !this.#rawDown) this.#pressLatch = true;
    this.#rawDown = down;
    this.#rawSource = source;
    this.#everActive = true;
  }

  setPointerInside(inside: boolean): void {
    this.#rawInside = inside;
  }

  /** Advance one frame. Called once per game step, before scene updates. */
  update(): void {
    if (this.#disposed) return;
    const prevDown = this.#down;
    this.#down = this.#rawDown || this.#pressLatch;
    this.#pressLatch = false;
    this.#justPressed = this.#down && !prevDown;
    this.#justReleased = !this.#down && prevDown;

    this.#screenX = this.#rawScreenX;
    this.#screenY = this.#rawScreenY;
    const world = this.#resolveWorld(this.#screenX, this.#screenY);
    if (world) {
      this.#worldX = world[0];
      this.#worldY = world[1];
    } else {
      this.#worldX = this.#screenX;
      this.#worldY = this.#screenY;
    }

    if (this.#justPressed) {
      this.#dragging = false;
      this.#dragStartScreenX = this.#screenX;
      this.#dragStartScreenY = this.#screenY;
      this.#dragStartWorldX = this.#worldX;
      this.#dragStartWorldY = this.#worldY;
      this.#dragDeltaWorldX = 0;
      this.#dragDeltaWorldY = 0;
    } else if (this.#down) {
      if (
        !this.#dragging &&
        Math.hypot(this.#screenX - this.#dragStartScreenX, this.#screenY - this.#dragStartScreenY) >= DRAG_THRESHOLD_PX
      ) {
        this.#dragging = true;
      }
      if (this.#dragging) {
        this.#dragDeltaWorldX = this.#worldX - this.#dragStartWorldX;
        this.#dragDeltaWorldY = this.#worldY - this.#dragStartWorldY;
      }
    } else if (this.#justReleased) {
      // Keep `dragging` true through the release frame so a consumer can see
      // "a drag just ended"; it clears on the next idle frame.
      if (this.#dragging) {
        this.#dragDeltaWorldX = this.#worldX - this.#dragStartWorldX;
        this.#dragDeltaWorldY = this.#worldY - this.#dragStartWorldY;
      }
    } else {
      this.#dragging = false;
      this.#dragDeltaWorldX = 0;
      this.#dragDeltaWorldY = 0;
    }
  }

  /** Zero everything. Used on focus loss so a button cannot stick down. */
  clear(): void {
    this.#rawDown = false;
    this.#pressLatch = false;
  }

  get state(): SpatialPointerState {
    if (this.#disposed) return IDLE_STATE;
    return {
      screenX: this.#screenX,
      screenY: this.#screenY,
      worldX: this.#worldX,
      worldY: this.#worldY,
      down: this.#down,
      justPressed: this.#justPressed,
      justReleased: this.#justReleased,
      source: this.#rawSource,
      inside: this.#rawInside,
      active: this.#everActive,
      dragging: this.#dragging,
      dragStartWorldX: this.#dragStartWorldX,
      dragStartWorldY: this.#dragStartWorldY,
      dragDeltaWorldX: this.#dragDeltaWorldX,
      dragDeltaWorldY: this.#dragDeltaWorldY,
    };
  }

  worldPoint(): readonly [number, number] {
    return [this.#worldX, this.#worldY];
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#root.removeEventListener('pointermove', this.#onPointerMove);
    this.#root.removeEventListener('pointerdown', this.#onPointerDown);
    this.#root.removeEventListener('pointerup', this.#onPointerUp);
    this.#root.removeEventListener('pointercancel', this.#onPointerUp);
    this.#root.removeEventListener('pointerenter', this.#onPointerEnter);
    this.#root.removeEventListener('pointerleave', this.#onPointerLeave);
    window.removeEventListener('pointermove', this.#onPointerMove);
    window.removeEventListener('pointerup', this.#onPointerUp);
    this.clear();
  }
}

function pointerKind(event: PointerEvent): PointerSourceKind {
  if (event.pointerType === 'touch') return 'touch';
  if (event.pointerType === 'pen') return 'pen';
  return 'mouse';
}
