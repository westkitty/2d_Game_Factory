import type Phaser from 'phaser';
import {
  hitTestPoint,
  type HitShape,
  type InteractionDragInfo,
  type InteractionPointerInfo,
  type InteractionService,
  type InteractionTargetHandle,
  type InteractionTargetOptions,
  type RectHitShape,
  type SpatialPointerInput,
} from '@sw2d/contracts';

interface TargetEntry {
  readonly options: InteractionTargetOptions;
  readonly seq: number;
  enabled: boolean;
}

/**
 * Scene-scoped world-space interaction targeting.
 *
 * Renderer-neutral: it consumes only a `SpatialPointerInput` and hit shapes.
 * The runtime constructs one per `SceneContext` and disposes it with the
 * scene, and drives `update()` from the scene's own UPDATE event - after the
 * pointer host has advanced its frame, so hit-testing always reads a fresh
 * pointer position.
 *
 * Overlap priority: higher `priority` wins; equal priority breaks toward the
 * most recently registered target. A drag captures its origin target - once a
 * drag begins on target X, X stays the drag target until release regardless
 * of where the pointer travels.
 */
export class InteractionServiceImpl implements InteractionService {
  readonly #pointer: SpatialPointerInput;
  readonly #targets = new Map<string, TargetEntry>();
  #seq = 0;
  #disposed = false;

  #hoveredId: string | null = null;
  #pressedId: string | null = null;
  #pressWasOverTarget = false;
  #draggingId: string | null = null;

  constructor(pointer: SpatialPointerInput) {
    this.#pointer = pointer;
  }

  register(options: InteractionTargetOptions): InteractionTargetHandle {
    if (this.#disposed) throw new Error('[sw2d] InteractionService.register after dispose');
    if (this.#targets.has(options.id)) {
      throw new Error(`[sw2d] interaction target "${options.id}" already registered`);
    }
    const entry: TargetEntry = { options, seq: this.#seq++, enabled: options.enabled ?? true };
    this.#targets.set(options.id, entry);
    const handle: InteractionTargetHandle = {
      id: options.id,
      get enabled(): boolean {
        return entry.enabled;
      },
      setEnabled: (value: boolean): void => {
        entry.enabled = value;
      },
      dispose: (): void => {
        this.unregister(options.id);
      },
    };
    return handle;
  }

  unregister(id: string): void {
    this.#targets.delete(id);
    if (this.#hoveredId === id) this.#hoveredId = null;
    if (this.#pressedId === id) this.#pressedId = null;
    if (this.#draggingId === id) this.#draggingId = null;
  }

  get hoveredId(): string | null {
    return this.#hoveredId;
  }

  get pressedId(): string | null {
    return this.#pressedId;
  }

  get draggingId(): string | null {
    return this.#draggingId;
  }

  get targetCount(): number {
    return this.#targets.size;
  }

  /** Advance one frame against the current pointer state. */
  update(): void {
    if (this.#disposed) return;
    const state = this.#pointer.state;
    const info: InteractionPointerInfo = { worldX: state.worldX, worldY: state.worldY, source: state.source };
    const topId = this.#topTargetAt(state.worldX, state.worldY);

    // Hover transitions only when nothing is being pressed/dragged.
    if (!state.down && !this.#draggingId) {
      if (topId !== this.#hoveredId) {
        this.#fire(this.#hoveredId, (o) => o.onHoverLeave?.(info));
        this.#hoveredId = topId;
        this.#fire(topId, (o) => o.onHoverEnter?.(info));
      }
    }

    if (state.justPressed) {
      this.#pressedId = topId;
      this.#pressWasOverTarget = topId !== null;
      this.#fire(topId, (o) => o.onPress?.(info));
    }

    if (state.dragging && this.#pressedId && !this.#draggingId) {
      this.#draggingId = this.#pressedId;
      this.#fire(this.#draggingId, (o) => o.onDragStart?.(this.#dragInfo(state)));
    }

    if (this.#draggingId && state.down && !state.justPressed) {
      this.#fire(this.#draggingId, (o) => o.onDrag?.(this.#dragInfo(state)));
    }

    if (state.justReleased) {
      if (this.#draggingId) {
        const dropId = this.#topDropZoneAt(state.worldX, state.worldY, this.#draggingId);
        const draggingId = this.#draggingId;
        this.#fire(draggingId, (o) => o.onDragEnd?.({ ...this.#dragInfo(state), dropTargetId: dropId }));
        if (dropId) {
          this.#fire(dropId, (o) => o.onDrop?.({ ...this.#dragInfo(state), sourceId: draggingId }));
        }
        this.#draggingId = null;
      } else if (this.#pressedId) {
        this.#fire(this.#pressedId, (o) => o.onRelease?.(info));
        if (this.#pressWasOverTarget && topId === this.#pressedId) {
          this.#fire(this.#pressedId, (o) => o.onClick?.(info));
        }
      }
      this.#pressedId = null;
      this.#pressWasOverTarget = false;
    }
  }

  #dragInfo(state: SpatialPointerInput['state']): InteractionDragInfo {
    return {
      worldX: state.worldX,
      worldY: state.worldY,
      source: state.source,
      startWorldX: state.dragStartWorldX,
      startWorldY: state.dragStartWorldY,
      deltaWorldX: state.dragDeltaWorldX,
      deltaWorldY: state.dragDeltaWorldY,
    };
  }

  #resolveShape(entry: TargetEntry): HitShape | null {
    const shape = entry.options.shape;
    return typeof shape === 'function' ? shape() : shape;
  }

  #sortedEntries(): TargetEntry[] {
    return [...this.#targets.values()]
      .filter((entry) => entry.enabled)
      .sort((a, b) => (b.options.priority ?? 0) - (a.options.priority ?? 0) || b.seq - a.seq);
  }

  #topTargetAt(worldX: number, worldY: number): string | null {
    for (const entry of this.#sortedEntries()) {
      const shape = this.#resolveShape(entry);
      if (shape && hitTestPoint(shape, worldX, worldY)) return entry.options.id;
    }
    return null;
  }

  #topDropZoneAt(worldX: number, worldY: number, excludeId: string): string | null {
    for (const entry of this.#sortedEntries()) {
      if (entry.options.id === excludeId || !entry.options.dropZone) continue;
      const shape = this.#resolveShape(entry);
      if (shape && hitTestPoint(shape, worldX, worldY)) return entry.options.id;
    }
    return null;
  }

  #fire(id: string | null, run: (options: InteractionTargetOptions) => void): void {
    if (this.#disposed || id === null) return;
    const entry = this.#targets.get(id);
    if (entry) run(entry.options);
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#targets.clear();
    this.#hoveredId = null;
    this.#pressedId = null;
    this.#draggingId = null;
  }
}

/**
 * A live rect hit-shape provider backed by a Phaser game object's world
 * bounds. A destroyed object yields `null`, making the target un-hittable
 * that frame without an error.
 */
export function phaserBoundsShape(
  object: Phaser.GameObjects.GameObject & { getBounds?: () => Phaser.Geom.Rectangle; active?: boolean },
): () => RectHitShape | null {
  return () => {
    if (object.active === false || typeof object.getBounds !== 'function') return null;
    const bounds = object.getBounds();
    return { kind: 'rect', x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height };
  };
}
