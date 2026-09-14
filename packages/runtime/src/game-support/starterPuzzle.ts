import type { GridDir, PuzzleRulesService, PuzzleSnapshot } from '@sw2d/contracts';
import { PUZZLE_RULES_CAPABILITY_ID } from '@sw2d/contracts';
import { accentStyle, headingStyle, mutedStyle } from '../scenes/theme.ts';
import type { SceneContext } from '../scenes/SceneContext.ts';

/**
 * Bind the generated grid shell to `sw2d.puzzle-rules` match and
 * falling-block kinds (Category-C Wave 9).
 *
 * Inert unless the game installed the pack and the active definition is
 * `match` or `falling-block`. Sokoban / switch-sequence stay on the existing
 * grid/platform shells. Presentation is a high-contrast board plus HUD so
 * the first short play session is a real puzzle. `{ hud: false }` lets
 * expanded kits keep their own presentation (factory games use the HUD).
 */

export interface StarterPuzzleSnapshot {
  readonly active: boolean;
  readonly kind: string | null;
  readonly solved: boolean;
  readonly moves: number;
  readonly cursorCol: number;
  readonly cursorRow: number;
  readonly selectedCol: number | null;
  readonly selectedRow: number | null;
  readonly clears: number;
  readonly lines: number;
  readonly toppedOut: boolean;
  readonly objective: number;
  readonly progress: number;
}

export interface StarterPuzzleBinding {
  readonly active: boolean;
  step(dir: GridDir): void;
  confirm(): void;
  cancel(): void;
  secondary(): void;
  tick(deltaMs: number): void;
  snapshot(): StarterPuzzleSnapshot;
  render(): void;
  kind(): string | null;
  dispose(): void;
}

const INERT: StarterPuzzleBinding = {
  active: false,
  step: () => undefined,
  confirm: () => undefined,
  cancel: () => undefined,
  secondary: () => undefined,
  tick: () => undefined,
  snapshot: () => ({
    active: false,
    kind: null,
    solved: false,
    moves: 0,
    cursorCol: 0,
    cursorRow: 0,
    selectedCol: null,
    selectedRow: null,
    clears: 0,
    lines: 0,
    toppedOut: false,
    objective: 0,
    progress: 0,
  }),
  render: () => undefined,
  kind: () => null,
  dispose: () => undefined,
};

const PIECE_COLORS = [0x65d0a8, 0xe05fa0, 0xf0c274, 0x4f9ee0, 0xb98af0, 0xff7a59] as const;
const EMPTY_COLOR = 0x1a1f2b;
const LOCKED_COLOR = 0x65d0a8;
const ACTIVE_COLOR = 0xf0c274;
const FALL_TICK_MS = 450;
const WARM_MS = 250;

interface BoardSnap extends PuzzleSnapshot {
  readonly board?: readonly (readonly number[])[];
  readonly grid?: readonly (readonly number[])[];
  readonly active?: { readonly cells: readonly (readonly [number, number])[] } | null;
  readonly width?: number;
  readonly height?: number;
  readonly clears?: number;
  readonly lines?: number;
  readonly toppedOut?: boolean;
  readonly objectiveClears?: number;
  readonly objectiveLines?: number;
}

interface CellSprite {
  setPosition(x: number, y: number): unknown;
  setFillStyle(color: number, alpha?: number): unknown;
  setVisible(v: boolean): unknown;
  destroy(): void;
}

function adjacent(ax: number, ay: number, bx: number, by: number): boolean {
  return Math.abs(ax - bx) + Math.abs(ay - by) === 1;
}

export function bindStarterPuzzle(context: SceneContext, options?: { readonly hud?: boolean }): StarterPuzzleBinding {
  if (!context.capabilities.has(PUZZLE_RULES_CAPABILITY_ID)) return INERT;
  const puzzle = context.capabilities.require<PuzzleRulesService>(PUZZLE_RULES_CAPABILITY_ID);
  const initial = puzzle.snapshot() as BoardSnap;
  if (initial.kind !== 'match' && initial.kind !== 'falling-block') return INERT;
  puzzle.reset();

  const hud = options?.hud !== false;
  const scene = context.scene;
  const { width, height } = context.definition.viewport;
  const kind = initial.kind;
  const cols = Math.max(1, initial.width ?? 3);
  const rows = Math.max(1, initial.height ?? 3);
  const cell = Math.max(22, Math.min(72, Math.floor(Math.min(720 / cols, 400 / rows))));
  const originX = width * 0.5 - ((cols - 1) * cell) / 2;
  const originY = height * 0.5 - ((rows - 1) * cell) / 2 + 12;

  const title = hud ? scene.add.text(width * 0.5, 28, '', headingStyle(20)).setOrigin(0.5).setScrollFactor(0).setDepth(50) : null;
  const status = hud ? scene.add.text(width * 0.5, 54, '', mutedStyle(14)).setOrigin(0.5).setScrollFactor(0).setDepth(50) : null;
  const hint = hud ? scene.add.text(width * 0.5, height - 28, '', accentStyle(14)).setOrigin(0.5).setScrollFactor(0).setDepth(50) : null;

  const sprites: { destroy(): void }[] = [];
  const cells: CellSprite[] = [];
  if (hud) {
    for (let i = 0; i < cols * rows; i++) {
      const rect = scene.add.rectangle(0, 0, cell - 6, cell - 6, EMPTY_COLOR, 0.92).setDepth(3).setScrollFactor(0);
      cells.push(rect);
      sprites.push(rect);
    }
  }
  const cursor = hud
    ? scene.add.rectangle(0, 0, cell, cell).setStrokeStyle(3, 0xffffff, 0.95).setFillStyle(0xffffff, 0).setDepth(6).setScrollFactor(0)
    : null;
  const selectedMark = hud
    ? scene.add.rectangle(0, 0, cell - 10, cell - 10).setStrokeStyle(3, 0x65d0a8, 0.95).setFillStyle(0x65d0a8, 0).setDepth(5).setScrollFactor(0)
    : null;
  if (cursor) sprites.push(cursor);
  if (selectedMark) sprites.push(selectedMark);

  let cursorCol = 0;
  let cursorRow = kind === 'match' ? 0 : 0;
  let selectedCol: number | null = null;
  let selectedRow: number | null = null;
  let fallAcc = 0;
  let warmMs = 0;
  let disposed = false;

  function live(): BoardSnap {
    return puzzle.snapshot() as BoardSnap;
  }

  function cellAt(worldX: number, worldY: number): { col: number; row: number } | null {
    const col = Math.round((worldX - originX) / cell);
    const row = Math.round((worldY - originY) / cell);
    if (col < 0 || row < 0 || col >= cols || row >= rows) return null;
    return { col, row };
  }

  function snapshot(): StarterPuzzleSnapshot {
    const snap = live();
    const objective = kind === 'match' ? (snap.objectiveClears ?? 0) : (snap.objectiveLines ?? 0);
    const progress = kind === 'match' ? (snap.clears ?? 0) : (snap.lines ?? 0);
    return {
      active: true,
      kind,
      solved: snap.solved,
      moves: snap.moves,
      cursorCol,
      cursorRow,
      selectedCol,
      selectedRow,
      clears: snap.clears ?? 0,
      lines: snap.lines ?? 0,
      toppedOut: snap.toppedOut === true,
      objective,
      progress,
    };
  }

  function render(): void {
    const snap = live();
    const board = snap.board;
    const grid = snap.grid;
    const activeCells = new Set((snap.active?.cells ?? []).map((cellPos) => `${cellPos[0]},${cellPos[1]}`));
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const sprite = cells[r * cols + c];
        if (!sprite) continue;
        sprite.setPosition(originX + c * cell, originY + r * cell);
        sprite.setVisible(true);
        if (kind === 'match') {
          const value = board?.[r]?.[c] ?? 0;
          sprite.setFillStyle(PIECE_COLORS[value % PIECE_COLORS.length]!, 0.95);
        } else if (activeCells.has(`${c},${r}`)) {
          sprite.setFillStyle(ACTIVE_COLOR, 0.95);
        } else if ((grid?.[r]?.[c] ?? 0) === 1) {
          sprite.setFillStyle(LOCKED_COLOR, 0.9);
        } else {
          sprite.setFillStyle(EMPTY_COLOR, 0.85);
        }
      }
    }
    if (cursor) {
      cursor.setVisible(kind === 'match');
      cursor.setPosition(originX + cursorCol * cell, originY + cursorRow * cell);
    }
    if (selectedMark) {
      const selCol = selectedCol;
      const selRow = selectedRow;
      const on = kind === 'match' && selCol !== null && selRow !== null;
      selectedMark.setVisible(on);
      if (selCol !== null && selRow !== null) selectedMark.setPosition(originX + selCol * cell, originY + selRow * cell);
    }
    if (!title || !status || !hint) return;
    if (kind === 'match') {
      title.setText('MATCH');
      status.setText(
        `clears ${snap.clears ?? 0}/${snap.objectiveClears ?? 0}  ·  moves ${snap.moves}${snap.solved ? '  ·  SOLVED' : ''}`,
      );
      hint.setText('MOVE WASD/ARROWS   ENTER SELECTS OR SWAPS   UNDO BACKSPACE');
    } else {
      title.setText('FALLING BLOCK');
      status.setText(
        `lines ${snap.lines ?? 0}/${snap.objectiveLines ?? 0}  ·  moves ${snap.moves}${snap.toppedOut ? '  ·  TOPPED OUT' : ''}${snap.solved ? '  ·  SOLVED' : ''}`,
      );
      hint.setText('MOVE WASD/ARROWS   ENTER ROTATES   DROP K');
    }
  }

  function warmed(): boolean {
    return warmMs >= WARM_MS;
  }

  render();

  return {
    active: true,
    step(dir: GridDir): void {
      if (disposed) return;
      const snap = live();
      if (snap.solved || snap.toppedOut) return;
      if (kind === 'match') {
        if (dir === 'left' && cursorCol > 0) cursorCol -= 1;
        else if (dir === 'right' && cursorCol < cols - 1) cursorCol += 1;
        else if (dir === 'up' && cursorRow > 0) cursorRow -= 1;
        else if (dir === 'down' && cursorRow < rows - 1) cursorRow += 1;
        render();
        return;
      }
      if (dir === 'up') puzzle.apply({ kind: 'rotate' });
      else puzzle.apply({ kind: 'move', dir });
      render();
    },
    confirm(): void {
      if (disposed || !warmed()) return;
      const snap = live();
      if (snap.solved || snap.toppedOut) return;
      if (kind === 'falling-block') {
        puzzle.apply({ kind: 'rotate' });
        render();
        return;
      }
      if (selectedCol === null || selectedRow === null) {
        selectedCol = cursorCol;
        selectedRow = cursorRow;
        render();
        return;
      }
      if (selectedCol === cursorCol && selectedRow === cursorRow) {
        selectedCol = null;
        selectedRow = null;
        render();
        return;
      }
      if (adjacent(selectedCol, selectedRow, cursorCol, cursorRow)) {
        puzzle.apply({ kind: 'swap', a: [selectedCol, selectedRow], b: [cursorCol, cursorRow] });
        selectedCol = null;
        selectedRow = null;
        render();
        return;
      }
      selectedCol = cursorCol;
      selectedRow = cursorRow;
      render();
    },
    cancel(): void {
      if (disposed) return;
      if (kind === 'match' && selectedCol !== null) {
        selectedCol = null;
        selectedRow = null;
        render();
        return;
      }
      puzzle.undo();
      render();
    },
    secondary(): void {
      if (disposed || !warmed()) return;
      if (kind === 'falling-block') {
        const snap = live();
        if (snap.solved || snap.toppedOut) return;
        puzzle.apply({ kind: 'hard-drop' });
        render();
        return;
      }
      puzzle.reset();
      cursorCol = 0;
      cursorRow = 0;
      selectedCol = null;
      selectedRow = null;
      render();
    },
    tick(deltaMs: number): void {
      if (disposed) return;
      warmMs += deltaMs;
      if (kind === 'match') {
        const pointer = context.spatialPointer.state;
        const hover = cellAt(pointer.worldX, pointer.worldY);
        if (hover && pointer.inside) {
          cursorCol = hover.col;
          cursorRow = hover.row;
        }
        if (pointer.justReleased && pointer.dragging) {
          const from = cellAt(pointer.dragStartWorldX, pointer.dragStartWorldY);
          const to = cellAt(pointer.worldX, pointer.worldY);
          if (from && to && adjacent(from.col, from.row, to.col, to.row)) {
            puzzle.apply({ kind: 'swap', a: [from.col, from.row], b: [to.col, to.row] });
            selectedCol = null;
            selectedRow = null;
          }
        }
      }
      if (kind === 'falling-block') {
        const snap = live();
        if (!snap.solved && !snap.toppedOut) {
          fallAcc += deltaMs;
          while (fallAcc >= FALL_TICK_MS) {
            fallAcc -= FALL_TICK_MS;
            puzzle.apply({ kind: 'tick' });
            if (live().solved || live().toppedOut) break;
          }
        }
      }
      render();
    },
    snapshot,
    render,
    kind: () => kind,
    dispose(): void {
      if (disposed) return;
      disposed = true;
      try {
        title?.destroy();
        status?.destroy();
        hint?.destroy();
        for (const sprite of sprites) sprite.destroy();
      } catch {
        /* scene already tearing down */
      }
    },
  };
}
