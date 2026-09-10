import { NAV_CAPABILITY_ID, createRouteFollower, type NavGrid, type NavService } from '@sw2d/contracts';
import { accentStyle, headingStyle, mutedStyle } from '../scenes/theme.ts';
import type { SceneContext } from '../scenes/SceneContext.ts';

/**
 * Bind generated shells to `sw2d.navigation` (Category-C Wave 19).
 *
 * Inert unless the game installed the pack *and* the generated packConfig
 * names a maze or lane starter. The pack stays grid pathfinding / walkable
 * occupancy / dynamic re-path — this file is presentation, not fog-of-war,
 * spawn scheduling or combat. Overlay maze / lane-defense kits stay local.
 */

export type NavigationStarterMode = 'maze' | 'lane';

export interface StarterNavigationSnapshot {
  readonly active: boolean;
  readonly mode: NavigationStarterMode | null;
  readonly playerCol: number;
  readonly playerRow: number;
  readonly cursorCol: number;
  readonly cursorRow: number;
  readonly runnerCol: number;
  readonly runnerRow: number;
  readonly exitCol: number;
  readonly exitRow: number;
  readonly pathLength: number;
  readonly blockedCount: number;
  readonly lastResult: string | null;
  readonly outcome: 'playing' | 'complete';
}

export interface StarterNavigationBinding {
  readonly active: boolean;
  step(dir: 'up' | 'down' | 'left' | 'right'): void;
  act(): void;
  tick(deltaMs: number): void;
  snapshot(): StarterNavigationSnapshot;
  render(): void;
  dispose(): void;
}

const INERT: StarterNavigationBinding = {
  active: false,
  step: () => undefined,
  act: () => undefined,
  tick: () => undefined,
  snapshot: () => ({
    active: false,
    mode: null,
    playerCol: 0,
    playerRow: 0,
    cursorCol: 0,
    cursorRow: 0,
    runnerCol: 0,
    runnerRow: 0,
    exitCol: 0,
    exitRow: 0,
    pathLength: 0,
    blockedCount: 0,
    lastResult: null,
    outcome: 'playing',
  }),
  render: () => undefined,
  dispose: () => undefined,
};

const COLS = 30;
const ROWS = 17;
const CELL = 32;
const MAZE_START = { col: 4, row: 8 };
const MAZE_EXIT = { col: 12, row: 8 };
const LANE_START = { col: 4, row: 8 };
const LANE_GOAL = { col: 16, row: 8 };
const LANE_CURSOR = { col: 10, row: 8 };
const RUN_SPEED = 240;
const FLOOR_COLOR = 0x2b3446;
const WALL_COLOR = 0x1a1f2b;
const EXIT_COLOR = 0xb98af0;
const PLAYER_COLOR = 0x65d0a8;
const RUNNER_COLOR = 0xe05fa0;
const DONE_COLOR = 0x65d0a8;

function cellKey(col: number, row: number): string {
  return `${col},${row}`;
}

function mazeWalkable(): Set<string> {
  const out = new Set<string>();
  const add = (col: number, row: number): void => {
    out.add(cellKey(col, row));
  };
  for (let col = 4; col <= 6; col++) add(col, 8);
  for (let row = 8; row <= 10; row++) add(6, row);
  for (let col = 6; col <= 10; col++) add(col, 10);
  for (let row = 8; row <= 10; row++) add(10, row);
  for (let col = 10; col <= 12; col++) add(col, 8);
  return out;
}

function laneWalkable(): Set<string> {
  const out = new Set<string>();
  const add = (col: number, row: number): void => {
    out.add(cellKey(col, row));
  };
  for (let col = 4; col <= 16; col++) {
    add(col, 8);
    add(col, 6);
  }
  for (let row = 6; row <= 8; row++) {
    add(4, row);
    add(16, row);
  }
  return out;
}

function blockedFrom(walkable: Set<string>): Array<readonly [number, number]> {
  const blocked: Array<readonly [number, number]> = [];
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      if (!walkable.has(cellKey(col, row))) blocked.push([col, row]);
    }
  }
  return blocked;
}

const ORTHO: ReadonlyArray<readonly [number, number]> = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

export function bindStarterNavigation(
  context: SceneContext,
  options?: { readonly mode?: NavigationStarterMode | null; readonly hud?: boolean },
): StarterNavigationBinding {
  const mode = options?.mode ?? null;
  if (mode !== 'maze' && mode !== 'lane') return INERT;
  if (!context.capabilities.has(NAV_CAPABILITY_ID)) return INERT;
  const nav = context.capabilities.require<NavService>(NAV_CAPABILITY_ID);

  const walkable = mode === 'maze' ? mazeWalkable() : laneWalkable();
  const gridId = mode === 'maze' ? 'starter-maze' : 'starter-lane';
  nav.remove(gridId);
  const grid: NavGrid = nav.defineGrid(gridId, {
    cols: COLS,
    rows: ROWS,
    cellSize: CELL,
    blocked: blockedFrom(walkable),
  });

  const start = mode === 'maze' ? MAZE_START : LANE_START;
  const goal = mode === 'maze' ? MAZE_EXIT : LANE_GOAL;
  const follower = mode === 'lane' ? createRouteFollower() : null;
  const startWorld = grid.cellToWorld(start.col, start.row);
  if (follower) {
    follower.setDestination(grid, startWorld[0], startWorld[1], goal.col, goal.row);
  }

  const hud = options?.hud !== false;
  const scene = context.scene;
  const { width, height } = context.definition.viewport;

  const title = hud ? scene.add.text(width * 0.5, 28, '', headingStyle(20)).setOrigin(0.5).setScrollFactor(0).setDepth(50) : null;
  const status = hud ? scene.add.text(width * 0.5, 54, '', mutedStyle(14)).setOrigin(0.5).setScrollFactor(0).setDepth(50) : null;
  const hint = hud ? scene.add.text(width * 0.5, height - 28, '', accentStyle(14)).setOrigin(0.5).setScrollFactor(0).setDepth(50) : null;

  const tiles: { destroy(): void }[] = [];
  if (hud) {
    const drawn = new Set<string>();
    for (const key of walkable) {
      const [col, row] = key.split(',').map(Number) as [number, number];
      const [x, y] = grid.cellToWorld(col, row);
      tiles.push(scene.add.rectangle(x, y, 28, 28, FLOOR_COLOR, 0.95).setStrokeStyle(1, 0x384054, 0.9).setDepth(10));
      drawn.add(key);
      for (const [dc, dr] of ORTHO) {
        const nCol = col + dc;
        const nRow = row + dr;
        const nKey = cellKey(nCol, nRow);
        if (drawn.has(nKey) || walkable.has(nKey)) continue;
        if (nCol < 0 || nRow < 0 || nCol >= COLS || nRow >= ROWS) continue;
        const [wx, wy] = grid.cellToWorld(nCol, nRow);
        tiles.push(scene.add.rectangle(wx, wy, 28, 28, WALL_COLOR, 0.95).setStrokeStyle(1, 0x0b0d13, 0.9).setDepth(9));
        drawn.add(nKey);
      }
    }
  }

  const [exitX, exitY] = grid.cellToWorld(goal.col, goal.row);
  const exitMark = hud
    ? scene.add.rectangle(exitX, exitY, 22, 36, EXIT_COLOR, 0.95).setStrokeStyle(2, 0xffffff, 0.9).setDepth(19)
    : null;
  const exitLabel = hud
    ? scene.add.text(exitX, exitY - 28, mode === 'maze' ? 'EXIT' : 'BASE', mutedStyle(12)).setOrigin(0.5).setDepth(21)
    : null;
  const [startX, startY] = startWorld;
  const actorMark = hud
    ? scene.add
        .rectangle(startX, startY, 24, 24, mode === 'maze' ? PLAYER_COLOR : RUNNER_COLOR, 0.95)
        .setStrokeStyle(2, 0xffffff, 0.9)
        .setDepth(20)
    : null;
  const cursorMark =
    hud && mode === 'lane'
      ? scene.add.rectangle(0, 0, 32, 32).setStrokeStyle(3, 0xffffff, 0.95).setFillStyle(0xffffff, 0).setDepth(22)
      : null;

  let playerCol = start.col;
  let playerRow = start.row;
  let cursorCol = mode === 'lane' ? LANE_CURSOR.col : start.col;
  let cursorRow = mode === 'lane' ? LANE_CURSOR.row : start.row;
  let runnerX = startWorld[0];
  let runnerY = startWorld[1];
  let blockedCount = 0;
  let lastResult: string | null = null;
  let outcome: 'playing' | 'complete' = 'playing';
  let disposed = false;

  function livePathLength(): number {
    const from = mode === 'maze' ? { col: playerCol, row: playerRow } : grid.worldToCell(runnerX, runnerY);
    return grid.findPath(from, { col: goal.col, row: goal.row })?.cells.length ?? 0;
  }

  function runnerCell(): { col: number; row: number } {
    return grid.worldToCell(runnerX, runnerY);
  }

  function snapshot(): StarterNavigationSnapshot {
    const runner = runnerCell();
    return {
      active: true,
      mode,
      playerCol,
      playerRow,
      cursorCol,
      cursorRow,
      runnerCol: runner.col,
      runnerRow: runner.row,
      exitCol: goal.col,
      exitRow: goal.row,
      pathLength: livePathLength(),
      blockedCount,
      lastResult,
      outcome,
    };
  }

  function paint(): void {
    const snap = snapshot();
    if (mode === 'maze') {
      const [x, y] = grid.cellToWorld(playerCol, playerRow);
      actorMark?.setPosition(x, y);
      actorMark?.setFillStyle(snap.outcome === 'complete' ? DONE_COLOR : PLAYER_COLOR, 0.95);
    } else {
      actorMark?.setPosition(runnerX, runnerY);
      actorMark?.setFillStyle(snap.outcome === 'complete' ? DONE_COLOR : RUNNER_COLOR, 0.95);
      const [cx, cy] = grid.cellToWorld(cursorCol, cursorRow);
      cursorMark?.setPosition(cx, cy);
    }
    exitMark?.setFillStyle(snap.outcome === 'complete' ? DONE_COLOR : EXIT_COLOR, 0.95);
    if (!title || !status || !hint) return;
    if (mode === 'maze') {
      title.setText(snap.outcome === 'complete' ? 'ESCAPED' : 'MAZE');
      status.setText(
        `cell ${snap.playerCol},${snap.playerRow}  ·  path ${snap.pathLength}${
          snap.lastResult ? `  ·  ${snap.lastResult}` : ''
        }`,
      );
      hint.setText(snap.outcome === 'complete' ? 'EXIT REACHED' : 'ARROWS WALK   REACH THE EXIT');
    } else {
      title.setText(snap.outcome === 'complete' ? 'BREACHED' : 'LANE');
      status.setText(
        `runner ${snap.runnerCol},${snap.runnerRow}  ·  path ${snap.pathLength}  ·  blocks ${snap.blockedCount}${
          snap.lastResult ? `  ·  ${snap.lastResult}` : ''
        }`,
      );
      hint.setText(snap.outcome === 'complete' ? 'RUNNER REACHED BASE' : 'ARROWS AIM   J BLOCKS   THE RUNNER REPATHS');
    }
  }

  paint();

  return {
    active: true,
    step(dir: 'up' | 'down' | 'left' | 'right'): void {
      if (disposed || outcome !== 'playing') return;
      const dCol = dir === 'left' ? -1 : dir === 'right' ? 1 : 0;
      const dRow = dir === 'up' ? -1 : dir === 'down' ? 1 : 0;
      if (mode === 'maze') {
        const nextCol = playerCol + dCol;
        const nextRow = playerRow + dRow;
        if (!grid.isWalkable(nextCol, nextRow)) {
          lastResult = 'wall';
          paint();
          return;
        }
        playerCol = nextCol;
        playerRow = nextRow;
        lastResult = 'moved';
        if (playerCol === goal.col && playerRow === goal.row) {
          outcome = 'complete';
          lastResult = 'escaped';
        }
        paint();
        return;
      }
      const nextCol = cursorCol + dCol;
      const nextRow = cursorRow + dRow;
      if (nextCol < 0 || nextRow < 0 || nextCol >= COLS || nextRow >= ROWS) {
        lastResult = 'edge';
        paint();
        return;
      }
      cursorCol = nextCol;
      cursorRow = nextRow;
      lastResult = 'aim';
      paint();
    },
    act(): void {
      if (disposed || outcome !== 'playing' || mode !== 'lane') return;
      const runner = runnerCell();
      if (cursorCol === LANE_START.col && cursorRow === LANE_START.row) {
        lastResult = 'busy';
        paint();
        return;
      }
      if (cursorCol === goal.col && cursorRow === goal.row) {
        lastResult = 'busy';
        paint();
        return;
      }
      if (cursorCol === runner.col && cursorRow === runner.row) {
        lastResult = 'busy';
        paint();
        return;
      }
      if (!grid.isWalkable(cursorCol, cursorRow)) {
        lastResult = 'wall';
        paint();
        return;
      }
      grid.setWalkable(cursorCol, cursorRow, false);
      const path = grid.findPath(runner, { col: goal.col, row: goal.row });
      if (!path) {
        grid.setWalkable(cursorCol, cursorRow, true);
        lastResult = 'rejected';
        paint();
        return;
      }
      blockedCount += 1;
      lastResult = 'placed';
      follower?.setDestination(grid, runnerX, runnerY, goal.col, goal.row);
      context.audio.playCue('ui.confirm');
      paint();
    },
    tick(deltaMs: number): void {
      if (disposed || outcome !== 'playing' || mode !== 'lane' || !follower) return;
      const moved = follower.step(runnerX, runnerY, RUN_SPEED * (deltaMs / 1000));
      runnerX = moved.x;
      runnerY = moved.y;
      if (follower.blocked) {
        lastResult = 'trapped';
        paint();
        return;
      }
      if (moved.arrived) {
        outcome = 'complete';
        lastResult = 'arrived';
      }
      paint();
    },
    snapshot,
    render: paint,
    dispose(): void {
      if (disposed) return;
      disposed = true;
      try {
        title?.destroy();
        status?.destroy();
        hint?.destroy();
        exitMark?.destroy();
        exitLabel?.destroy();
        actorMark?.destroy();
        cursorMark?.destroy();
        for (const tile of tiles) tile.destroy();
      } catch {
        /* scene already tearing down */
      }
    },
  };
}
