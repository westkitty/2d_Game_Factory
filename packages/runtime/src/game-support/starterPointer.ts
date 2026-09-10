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
  readonly attached: readonly string[];
  readonly draggingId: string | null;
  readonly lastResult: string | null;
  readonly outcome: 'playing' | 'complete';
}

export interface StarterPointerBinding {
  readonly active: boolean;
  snapshot(): StarterPointerSnapshot;
  render(): void;
  dispose(): void;
}

const INERT: StarterPointerBinding = {
  active: false,
  snapshot: () => ({
    active: false,
    mode: null,
    strokes: 0,
    strokeLength: 0,
    attached: [],
    draggingId: null,
    lastResult: null,
    outcome: 'playing',
  }),
  render: () => undefined,
  dispose: () => undefined,
};

const PAPER = { x: 80, y: 80, width: 800, height: 380 } as const;
const STROKE_TARGET = 2;
const MIN_STROKE = 80;
const MIN_POINT_GAP = 8;
const HAT = { id: 'hat', x: 200, y: 160, radius: 44, label: 'HAT' } as const;
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
}

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

  const strokes: Point[][] = [];
  let live: Point[] = [];
  let attachedHat = false;
  let attachedShirt = false;
  let hatX: number = HAT.x;
  let hatY: number = HAT.y;
  let shirtX: number = SHIRT.x;
  let shirtY: number = SHIRT.y;
  let lastResult: string | null = null;
  let outcome: 'playing' | 'complete' = 'playing';
  let disposed = false;

  function snapshot(): StarterPointerSnapshot {
    const current = live.length > 1 ? polylineLength(live) : 0;
    const finished = strokes.reduce((sum, stroke) => sum + polylineLength(stroke), 0);
    return {
      active: true,
      mode,
      strokes: strokes.length,
      strokeLength: Math.round(finished + current),
      attached: [...(attachedHat ? ['hat'] : []), ...(attachedShirt ? ['shirt'] : [])],
      draggingId: context.interaction.draggingId,
      lastResult,
      outcome,
    };
  }

  function paintInk(): void {
    if (!ink) return;
    ink.clear();
    ink.lineStyle(5, INK_COLOR, 1);
    const all = live.length > 0 ? [...strokes, live] : strokes;
    for (const stroke of all) {
      if (stroke.length < 2) continue;
      ink.beginPath();
      ink.moveTo(stroke[0]!.x, stroke[0]!.y);
      for (let i = 1; i < stroke.length; i++) ink.lineTo(stroke[i]!.x, stroke[i]!.y);
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
      hatRect?.setFillStyle(attachedHat ? DONE_COLOR : HAT_COLOR, 0.95);
      shirtRect?.setFillStyle(attachedShirt ? DONE_COLOR : SHIRT_COLOR, 0.95);
      figureRect?.setFillStyle(snap.outcome === 'complete' ? DONE_COLOR : FIGURE_COLOR, 0.95);
    } else {
      paintInk();
    }
    if (!title || !status || !hint) return;
    if (mode === 'draw') {
      title.setText(snap.outcome === 'complete' ? 'DRAWN' : 'DRAW');
      status.setText(
        `strokes ${snap.strokes}/${STROKE_TARGET}  ·  length ${snap.strokeLength}${snap.lastResult ? `  ·  ${snap.lastResult}` : ''}${
          snap.outcome === 'complete' ? '  ·  complete' : ''
        }`,
      );
      hint.setText('DRAW TWO STROKES ON THE PAGE');
    } else {
      title.setText(snap.outcome === 'complete' ? 'DRESSED' : 'WARDROBE');
      status.setText(
        `on ${snap.attached.length}/2${snap.lastResult ? `  ·  ${snap.lastResult}` : ''}${snap.outcome === 'complete' ? '  ·  complete' : ''}`,
      );
      hint.setText('DRAG HAT AND SHIRT ONTO THE FIGURE');
    }
  }

  function finishIfReady(): void {
    if (mode === 'draw' && strokes.length >= STROKE_TARGET) outcome = 'complete';
    if (mode === 'wardrobe' && attachedHat && attachedShirt) outcome = 'complete';
  }

  const handles: { dispose(): void }[] = [];

  if (mode === 'draw') {
    handles.push(
      context.interaction.register({
        id: 'paper',
        shape: { kind: 'rect', x: PAPER.x, y: PAPER.y, width: PAPER.width, height: PAPER.height },
        onDragStart: (info) => {
          if (disposed || outcome !== 'playing') return;
          live = [{ x: info.startWorldX, y: info.startWorldY }, { x: info.worldX, y: info.worldY }];
          lastResult = 'drawing';
          paint();
        },
        onDrag: (info) => {
          if (disposed || outcome !== 'playing' || live.length === 0) return;
          const last = live[live.length - 1]!;
          if (Math.hypot(info.worldX - last.x, info.worldY - last.y) >= MIN_POINT_GAP) {
            live.push({ x: info.worldX, y: info.worldY });
          }
          paint();
        },
        onDragEnd: () => {
          if (disposed || outcome !== 'playing') return;
          const length = polylineLength(live);
          if (length >= MIN_STROKE) {
            strokes.push(live);
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

    const placeItem = (id: 'hat' | 'shirt', onFigure: boolean): void => {
      if (id === 'hat') {
        attachedHat = onFigure;
        hatX = onFigure ? FIGURE.x : HAT.x;
        hatY = onFigure ? FIGURE.y - 110 : HAT.y;
      } else {
        attachedShirt = onFigure;
        shirtX = onFigure ? FIGURE.x : SHIRT.x;
        shirtY = onFigure ? FIGURE.y + 20 : SHIRT.y;
      }
    };

    const bindPiece = (id: 'hat' | 'shirt'): void => {
      const handle = context.interaction.register({
        id,
        priority: 1,
        shape: () =>
          id === 'hat'
            ? { kind: 'circle', x: hatX, y: hatY, radius: HAT.radius }
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
    bindPiece('shirt');
  }

  paint();

  return {
    active: true,
    snapshot,
    render: paint,
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
      } catch {
        /* scene already tearing down */
      }
    },
  };
}
