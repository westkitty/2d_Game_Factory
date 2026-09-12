import type { ItemsService } from '@sw2d/contracts';
import { ITEMS_CAPABILITY_ID } from '@sw2d/contracts';
import { accentStyle, headingStyle, mutedStyle } from '../scenes/theme.ts';
import type { SceneContext } from '../scenes/SceneContext.ts';

/**
 * Bind the generated pointer shell to `context.interaction` (Category-C Wave 16).
 *
 * Inert unless the generated packConfig names a draw or wardrobe starter.
 * The reusable machine stays ADR-0018 (world cursor, hover, drag, drop) —
 * this file is presentation, not a drawing-canvas pack or a wardrobe/
 * attachment skeleton. Overlay drawing / dress-up kits stay local (P3-H).
 */

export type PointerStarterMode = 'draw' | 'wardrobe';

export interface StarterPointerSnapshot {
  readonly active: boolean;
  readonly mode: PointerStarterMode | null;
  readonly strokes: number;
  readonly strokeLength: number;
  readonly layers: number;
  readonly activeLayer: number;
  readonly undoDepth: number;
  readonly redoDepth: number;
  readonly pressureRange: readonly [number, number];
  readonly exportBytes: number;
  readonly attached: readonly string[];
  readonly authoredItems: readonly string[];
  readonly persisted: boolean;
  readonly draggingId: string | null;
  readonly lastResult: string | null;
  readonly outcome: 'playing' | 'complete';
}

export interface StarterPointerBinding {
  readonly active: boolean;
  snapshot(): StarterPointerSnapshot;
  render(): void;
  undo(): void;
  redo(): void;
  clear(): void;
  newLayer(): void;
  exportPng(): void;
  remove(): void;
  dispose(): void;
}

const INERT: StarterPointerBinding = {
  active: false,
  snapshot: () => ({
    active: false,
    mode: null,
    strokes: 0,
    strokeLength: 0,
    layers: 0,
    activeLayer: 0,
    undoDepth: 0,
    redoDepth: 0,
    pressureRange: [0, 0],
    exportBytes: 0,
    attached: [],
    authoredItems: [],
    persisted: false,
    draggingId: null,
    lastResult: null,
    outcome: 'playing',
  }),
  render: () => undefined,
  undo: () => undefined,
  redo: () => undefined,
  clear: () => undefined,
  newLayer: () => undefined,
  exportPng: () => undefined,
  remove: () => undefined,
  dispose: () => undefined,
};

const PAPER = { x: 80, y: 80, width: 800, height: 380 } as const;
const STROKE_TARGET = 2;
const MIN_STROKE = 80;
const MIN_POINT_GAP = 8;
const HAT = { id: 'hat', x: 200, y: 160, radius: 44, label: 'HAT' } as const;
const CROWN = { id: 'crown', x: 330, y: 160, radius: 44, label: 'CROWN' } as const;
const SHIRT = { id: 'shirt', x: 200, y: 340, radius: 44, label: 'SHIRT' } as const;
const FIGURE = { id: 'figure', x: 700, y: 270, width: 160, height: 280 } as const;
const PAPER_COLOR = 0x1a1f2b;
const INK_COLOR = 0xf0c274;
const HAT_COLOR = 0xb98af0;
const SHIRT_COLOR = 0x4f9ee0;
const FIGURE_COLOR = 0x384054;
const DONE_COLOR = 0x65d0a8;

interface Point {
  readonly x: number;
  readonly y: number;
  readonly pressure: number;
}

interface Stroke { readonly points: Point[]; readonly layer: number }

function polylineLength(points: readonly Point[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += Math.hypot(points[i]!.x - points[i - 1]!.x, points[i]!.y - points[i - 1]!.y);
  }
  return total;
}

export function bindStarterPointer(
  context: SceneContext,
  options?: { readonly mode?: PointerStarterMode | null; readonly hud?: boolean },
): StarterPointerBinding {
  const mode = options?.mode ?? null;
  if (mode !== 'draw' && mode !== 'wardrobe') return INERT;

  const hud = options?.hud !== false;
  const scene = context.scene;
  const items = context.capabilities.get<ItemsService>(ITEMS_CAPABILITY_ID);
  const authoredItems = items?.definitionIds().filter((id) => items.lookup(id)?.category === 'wardrobe') ?? [];
  const { width, height } = context.definition.viewport;

  const title = hud ? scene.add.text(width * 0.5, 28, '', headingStyle(20)).setOrigin(0.5).setScrollFactor(0).setDepth(50) : null;
  const status = hud ? scene.add.text(width * 0.5, 54, '', mutedStyle(14)).setOrigin(0.5).setScrollFactor(0).setDepth(50) : null;
  const hint = hud ? scene.add.text(width * 0.5, height - 28, '', accentStyle(14)).setOrigin(0.5).setScrollFactor(0).setDepth(50) : null;

  const paper =
    hud && mode === 'draw'
      ? scene.add
          .rectangle(PAPER.x + PAPER.width * 0.5, PAPER.y + PAPER.height * 0.5, PAPER.width, PAPER.height, PAPER_COLOR, 0.95)
          .setStrokeStyle(2, 0x8a93a6, 0.9)
          .setScrollFactor(0)
          .setDepth(10)
      : null;
  const ink =
    mode === 'draw'
      ? scene.add.graphics().setScrollFactor(0).setDepth(12)
      : null;

  const figureRect =
    hud && mode === 'wardrobe'
      ? scene.add
          .rectangle(FIGURE.x, FIGURE.y, FIGURE.width, FIGURE.height, FIGURE_COLOR, 0.95)
          .setStrokeStyle(3, 0xffffff, 0.9)
          .setDepth(10)
      : null;
  const figureLabel =
    hud && mode === 'wardrobe'
      ? scene.add.text(FIGURE.x, FIGURE.y + 150, 'FIGURE', mutedStyle(14)).setOrigin(0.5).setDepth(11)
      : null;
  const hatRect =
    hud && mode === 'wardrobe'
      ? scene.add.rectangle(HAT.x, HAT.y, 88, 56, HAT_COLOR, 0.95).setStrokeStyle(2, 0xffffff, 0.9).setDepth(20)
      : null;
  const hatLabel =
    hud && mode === 'wardrobe' ? scene.add.text(HAT.x, HAT.y, HAT.label, mutedStyle(14)).setOrigin(0.5).setDepth(21) : null;
  const shirtRect =
    hud && mode === 'wardrobe'
      ? scene.add.rectangle(SHIRT.x, SHIRT.y, 88, 72, SHIRT_COLOR, 0.95).setStrokeStyle(2, 0xffffff, 0.9).setDepth(20)
      : null;
  const shirtLabel =
    hud && mode === 'wardrobe'
      ? scene.add.text(SHIRT.x, SHIRT.y, SHIRT.label, mutedStyle(14)).setOrigin(0.5).setDepth(21)
      : null;
  const crownRect = hud && mode === 'wardrobe'
    ? scene.add.rectangle(CROWN.x, CROWN.y, 88, 56, Number(items?.lookup('crown')?.metadata?.color ?? 0xf0c274), 0.95).setStrokeStyle(2, 0xffffff, 0.9).setDepth(21)
    : null;
  const crownLabel = hud && mode === 'wardrobe'
    ? scene.add.text(CROWN.x, CROWN.y, CROWN.label, mutedStyle(12)).setOrigin(0.5).setDepth(22)
    : null;

  const strokes: Stroke[] = [];
  const redo: Stroke[] = [];
  let live: Point[] = [];
  let activeLayer = 1;
  let layerCount = 1;
  let exportBytes = 0;
  let attachedHat = false;
  let attachedCrown = false;
  let attachedShirt = false;
  let hatX: number = HAT.x;
  let hatY: number = HAT.y;
  let crownX: number = CROWN.x;
  let crownY: number = CROWN.y;
  let shirtX: number = SHIRT.x;
  let shirtY: number = SHIRT.y;
  let lastResult: string | null = null;
  let outcome: 'playing' | 'complete' = 'playing';
  let disposed = false;
  let persisted = false;

  function snapshot(): StarterPointerSnapshot {
    const current = live.length > 1 ? polylineLength(live) : 0;
    const finished = strokes.reduce((sum, stroke) => sum + polylineLength(stroke.points), 0);
    const pressures = [...strokes.flatMap((stroke) => stroke.points.map((point) => point.pressure)), ...live.map((point) => point.pressure)];
    return {
      active: true,
      mode,
      strokes: strokes.length,
      strokeLength: Math.round(finished + current),
      layers: layerCount,
      activeLayer,
      undoDepth: strokes.length,
      redoDepth: redo.length,
      pressureRange: pressures.length > 0 ? [Math.min(...pressures), Math.max(...pressures)] : [0, 0],
      exportBytes,
      attached: [...(attachedHat ? ['hat'] : []), ...(attachedCrown ? ['crown'] : []), ...(attachedShirt ? ['shirt'] : [])],
      authoredItems,
      persisted,
      draggingId: context.interaction.draggingId,
      lastResult,
      outcome,
    };
  }

  function paintInk(): void {
    if (!ink) return;
    ink.clear();
    const all: Stroke[] = live.length > 0 ? [...strokes, { points: live, layer: activeLayer }] : strokes;
    for (const stroke of all.sort((a, b) => a.layer - b.layer)) {
      const points = stroke.points;
      if (points.length < 2) continue;
      ink.beginPath();
      ink.lineStyle(2 + points[0]!.pressure * 8, INK_COLOR, 1);
      ink.moveTo(points[0]!.x, points[0]!.y);
      for (let i = 1; i < points.length; i++) ink.lineTo(points[i]!.x, points[i]!.y);
      ink.strokePath();
    }
  }

  function paint(): void {
    const snap = snapshot();
    if (mode === 'wardrobe') {
      hatRect?.setPosition(hatX, hatY);
      hatLabel?.setPosition(hatX, hatY);
      shirtRect?.setPosition(shirtX, shirtY);
      shirtLabel?.setPosition(shirtX, shirtY);
      crownRect?.setPosition(crownX, crownY);
      crownLabel?.setPosition(crownX, crownY);
      hatRect?.setFillStyle(attachedHat ? DONE_COLOR : HAT_COLOR, 0.95);
      shirtRect?.setFillStyle(attachedShirt ? DONE_COLOR : SHIRT_COLOR, 0.95);
      crownRect?.setFillStyle(attachedCrown ? DONE_COLOR : Number(items?.lookup('crown')?.metadata?.color ?? 0xf0c274), 0.95);
      figureRect?.setFillStyle(snap.outcome === 'complete' ? DONE_COLOR : FIGURE_COLOR, 0.95);
    } else {
      paintInk();
    }
    if (!title || !status || !hint) return;
    if (mode === 'draw') {
      title.setText(snap.outcome === 'complete' ? 'DRAWN' : 'DRAW');
      status.setText(
        `strokes ${snap.strokes}/${STROKE_TARGET}  ·  layer ${snap.activeLayer}/${snap.layers}  ·  undo ${snap.undoDepth}${snap.lastResult ? `  ·  ${snap.lastResult}` : ''}${
          snap.outcome === 'complete' ? '  ·  complete' : ''
        }`,
      );
      hint.setText('DRAW · E NEW LAYER · K UNDO · BACKSPACE REDO · ENTER EXPORT');
    } else {
      title.setText(snap.outcome === 'complete' ? 'DRESSED' : 'WARDROBE');
      status.setText(
        `on ${snap.attached.length}/2${snap.lastResult ? `  ·  ${snap.lastResult}` : ''}${snap.outcome === 'complete' ? '  ·  complete' : ''}`,
      );
      hint.setText('DRAG ITEMS · HEAD SLOT SWAPS · E REMOVES');
    }
  }

  function finishIfReady(): void {
    if (mode === 'draw' && strokes.length >= STROKE_TARGET) outcome = 'complete';
    if (mode === 'wardrobe' && (attachedHat || attachedCrown) && attachedShirt) outcome = 'complete';
  }

  const handles: { dispose(): void }[] = [];

  if (mode === 'draw') {
    handles.push(
      context.interaction.register({
        id: 'paper',
        shape: { kind: 'rect', x: PAPER.x, y: PAPER.y, width: PAPER.width, height: PAPER.height },
        onDragStart: (info) => {
          if (disposed || outcome !== 'playing') return;
          live = [{ x: info.startWorldX, y: info.startWorldY, pressure: info.pressure }, { x: info.worldX, y: info.worldY, pressure: info.pressure }];
          lastResult = 'drawing';
          paint();
        },
        onDrag: (info) => {
          if (disposed || outcome !== 'playing' || live.length === 0) return;
          const last = live[live.length - 1]!;
          if (Math.hypot(info.worldX - last.x, info.worldY - last.y) >= MIN_POINT_GAP) {
            live.push({ x: info.worldX, y: info.worldY, pressure: info.pressure });
          }
          paint();
        },
        onDragEnd: () => {
          if (disposed || outcome !== 'playing') return;
          const length = polylineLength(live);
          if (length >= MIN_STROKE) {
            strokes.push({ points: live, layer: activeLayer });
            redo.length = 0;
            lastResult = 'stroke';
            finishIfReady();
            if (strokes.length >= STROKE_TARGET) context.audio.playCue('ui.confirm');
          } else {
            lastResult = 'short';
          }
          live = [];
          paint();
        },
      }),
    );
  } else {
    handles.push(
      context.interaction.register({
        id: FIGURE.id,
        dropZone: true,
        shape: {
          kind: 'rect',
          x: FIGURE.x - FIGURE.width * 0.5,
          y: FIGURE.y - FIGURE.height * 0.5,
          width: FIGURE.width,
          height: FIGURE.height,
        },
      }),
    );

    const persistWardrobe = (): void => {
      context.saves.save('starter-wardrobe', { schemaVersion: 1, head: attachedCrown ? 'crown' : attachedHat ? 'hat' : null, body: attachedShirt ? 'shirt' : null });
      persisted = true;
    };
    const placeItem = (id: 'hat' | 'crown' | 'shirt', onFigure: boolean): void => {
      if (id === 'hat') {
        attachedHat = onFigure;
        if (onFigure) { attachedCrown = false; crownX = CROWN.x; crownY = CROWN.y; }
        hatX = onFigure ? FIGURE.x : HAT.x;
        hatY = onFigure ? FIGURE.y - 110 : HAT.y;
      } else if (id === 'crown') {
        attachedCrown = onFigure;
        if (onFigure) { attachedHat = false; hatX = HAT.x; hatY = HAT.y; }
        crownX = onFigure ? FIGURE.x : CROWN.x;
        crownY = onFigure ? FIGURE.y - 118 : CROWN.y;
      } else {
        attachedShirt = onFigure;
        shirtX = onFigure ? FIGURE.x : SHIRT.x;
        shirtY = onFigure ? FIGURE.y + 20 : SHIRT.y;
      }
      if (onFigure) { if (items?.count(id) === 0) items?.grant(id); items?.hold(id); }
      persistWardrobe();
    };

    const bindPiece = (id: 'hat' | 'crown' | 'shirt'): void => {
      const handle = context.interaction.register({
        id,
        priority: 1,
        shape: () =>
          id === 'hat'
            ? { kind: 'circle', x: hatX, y: hatY, radius: HAT.radius }
            : id === 'crown'
              ? { kind: 'circle', x: crownX, y: crownY, radius: CROWN.radius }
            : { kind: 'circle', x: shirtX, y: shirtY, radius: SHIRT.radius },
        onDragStart: () => {
          if (disposed || outcome !== 'playing') return;
          lastResult = `lift-${id}`;
          paint();
        },
        onDrag: (info) => {
          if (disposed || outcome !== 'playing') return;
          if (id === 'hat') {
            hatX = info.worldX;
            hatY = info.worldY;
          } else if (id === 'crown') {
            crownX = info.worldX;
            crownY = info.worldY;
          } else {
            shirtX = info.worldX;
            shirtY = info.worldY;
          }
          paint();
        },
        onDragEnd: (info) => {
          if (disposed || outcome !== 'playing') return;
          const hit = info.dropTargetId === FIGURE.id;
          placeItem(id, hit);
          lastResult = hit ? `drop-${id}` : `miss-${id}`;
          if (hit) {
            handle.setEnabled(false);
            context.audio.playCue('ui.confirm');
          }
          finishIfReady();
          paint();
        },
      });
      handles.push(handle);
    };
    bindPiece('hat');
    bindPiece('crown');
    bindPiece('shirt');

    const loaded = context.saves.load<{ schemaVersion: number; head: 'hat' | 'crown' | null; body: 'shirt' | null }>('starter-wardrobe', {
      currentVersion: 1,
      createDefault: () => ({ schemaVersion: 1, head: null, body: null }),
    });
    if (loaded.outcome === 'loaded') {
      if (loaded.value.head) placeItem(loaded.value.head, true);
      if (loaded.value.body) placeItem(loaded.value.body, true);
      finishIfReady();
    }
  }

  paint();

  return {
    active: true,
    snapshot,
    render: paint,
    undo(): void {
      if (disposed || mode !== 'draw') return;
      const stroke = strokes.pop();
      if (stroke) { redo.push(stroke); lastResult = 'undo'; outcome = 'playing'; }
      else lastResult = 'nothing-to-undo';
      paint();
    },
    redo(): void {
      if (disposed || mode !== 'draw') return;
      const stroke = redo.pop();
      if (stroke) { strokes.push(stroke); lastResult = 'redo'; finishIfReady(); }
      else lastResult = 'nothing-to-redo';
      paint();
    },
    clear(): void {
      if (disposed || mode !== 'draw') return;
      redo.push(...strokes.splice(0)); live = []; outcome = 'playing'; lastResult = 'clear'; paint();
    },
    newLayer(): void {
      if (disposed || mode !== 'draw') return;
      activeLayer = ++layerCount; lastResult = `layer-${activeLayer}`; paint();
    },
    exportPng(): void {
      if (disposed || mode !== 'draw') return;
      const canvas = document.createElement('canvas'); canvas.width = PAPER.width; canvas.height = PAPER.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#1a1f2b'; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.strokeStyle = '#f0c274'; ctx.lineCap = 'round';
        for (const stroke of [...strokes].sort((a, b) => a.layer - b.layer)) {
          if (stroke.points.length < 2) continue; ctx.lineWidth = 2 + stroke.points[0]!.pressure * 8; ctx.beginPath();
          ctx.moveTo(stroke.points[0]!.x - PAPER.x, stroke.points[0]!.y - PAPER.y);
          for (const point of stroke.points.slice(1)) ctx.lineTo(point.x - PAPER.x, point.y - PAPER.y); ctx.stroke();
        }
        const url = canvas.toDataURL('image/png'); exportBytes = Math.floor((url.length - url.indexOf(',') - 1) * 0.75); lastResult = 'export-png';
      } else lastResult = 'export-unavailable';
      paint();
    },
    remove(): void {
      if (disposed || mode !== 'wardrobe') return;
      if (attachedHat) { attachedHat = false; hatX = HAT.x; hatY = HAT.y; lastResult = 'remove-hat'; }
      else if (attachedCrown) { attachedCrown = false; crownX = CROWN.x; crownY = CROWN.y; lastResult = 'remove-crown'; }
      else if (attachedShirt) { attachedShirt = false; shirtX = SHIRT.x; shirtY = SHIRT.y; lastResult = 'remove-shirt'; }
      context.saves.save('starter-wardrobe', { schemaVersion: 1, head: attachedCrown ? 'crown' : attachedHat ? 'hat' : null, body: attachedShirt ? 'shirt' : null });
      persisted = true; outcome = 'playing'; paint();
    },
    dispose(): void {
      if (disposed) return;
      disposed = true;
      for (const handle of handles) handle.dispose();
      try {
        title?.destroy();
        status?.destroy();
        hint?.destroy();
        paper?.destroy();
        ink?.destroy();
        figureRect?.destroy();
        figureLabel?.destroy();
        hatRect?.destroy();
        hatLabel?.destroy();
        shirtRect?.destroy();
        shirtLabel?.destroy();
        crownRect?.destroy();
        crownLabel?.destroy();
      } catch {
        /* scene already tearing down */
      }
    },
  };
}
