import {
  NAV_CAPABILITY_ID,
  createRouteFollower,
  type InstalledSystemPack,
  type NavGrid,
  type NavService,
  type NavPath,
} from '@sw2d/contracts';
import { gridController, type SceneContext, type ScenePackDefinition } from '@sw2d/runtime';

/**
 * Phase 5 proof - turn-based-tactics. A selectable unit gets a deterministic
 * reachable-cell set from `sw2d.navigation` (`NavGrid.reachable`), and when
 * the player confirms a cursor cell inside that set the unit follows the
 * grid's returned route (`RouteFollower` / `advanceAlongPath`). No hand-rolled
 * BFS, no hand-rolled route stepping.
 */

const COLS = 10;
const ROWS = 8;
const CELL = 60;
const MOVE_BUDGET = 4;
const UNIT_SPEED = 240; // px/s
// A few walls so the reachable set and the route are non-trivial.
const WALLS: ReadonlyArray<readonly [number, number]> = [
  [4, 2],
  [4, 3],
  [4, 4],
  [4, 5],
];

export const GAME_SPECIFIC_PACK: ScenePackDefinition = {
  id: 'game.grid-shell',
  version: '0.1.0',
  provides: [],
  dependencies: [],

  install(context: SceneContext): InstalledSystemPack {
    const scene = context.scene;
    const nav = context.capabilities.require<NavService>(NAV_CAPABILITY_ID);
    const grid: NavGrid = nav.defineGrid('battlefield', { cols: COLS, rows: ROWS, cellSize: CELL, blocked: WALLS });

    for (const [c, r] of WALLS) {
      const [x, y] = grid.cellToWorld(c, r);
      scene.add.rectangle(x, y, CELL - 6, CELL - 6, 0x39415a);
    }

    let unit = { col: 2, row: 4 };
    let cursor = { col: 2, row: 4 };
    const unitPos = { ...pos(unit) };
    const unitSprite = scene.add.sprite(unitPos.x, unitPos.y, context.assets.resolve('player'));
    const cursorSprite = scene.add.sprite(unitPos.x, unitPos.y, context.assets.resolve('checkpoint')).setAlpha(0.6);

    function pos(c: { col: number; row: number }): { x: number; y: number } {
      const [x, y] = grid.cellToWorld(c.col, c.row);
      return { x, y };
    }

    let reachable = grid.reachable(unit, MOVE_BUDGET);
    const follower = createRouteFollower();
    let moving = false;
    let lastPath: NavPath | null = null;
    let arrivedAt: { col: number; row: number } | null = null;
    let confirmsRejected = 0;

    function recomputeReachable(): void {
      reachable = grid.reachable(unit, MOVE_BUDGET);
    }

    function inReachable(c: { col: number; row: number }): boolean {
      return reachable.some((rc) => rc.col === c.col && rc.row === c.row);
    }

    const debugHandle = context.debug.contribute('game.grid-shell', () => ({
      unitCol: unit.col,
      unitRow: unit.row,
      cursorCol: cursor.col,
      cursorRow: cursor.row,
      reachableCount: reachable.length,
      cursorReachable: inReachable(cursor),
      moving,
      lastPathLen: lastPath?.cells.length ?? 0,
      lastPathCost: lastPath ? Math.round(lastPath.cost * 100) / 100 : 0,
      arrivedAt,
      confirmsRejected,
    }));

    let disposed = false;
    return {
      id: GAME_SPECIFIC_PACK.id,

      update(deltaMs: number): void {
        if (disposed) return;
        const intent = gridController.read(context.input);

        if (!moving && intent.step) {
          if (intent.step === 'up') cursor = { ...cursor, row: Math.max(0, cursor.row - 1) };
          if (intent.step === 'down') cursor = { ...cursor, row: Math.min(ROWS - 1, cursor.row + 1) };
          if (intent.step === 'left') cursor = { ...cursor, col: Math.max(0, cursor.col - 1) };
          if (intent.step === 'right') cursor = { ...cursor, col: Math.min(COLS - 1, cursor.col + 1) };
          const cp = pos(cursor);
          cursorSprite.setPosition(cp.x, cp.y);
        }

        if (!moving && intent.confirmPressed) {
          if (!inReachable(cursor) || (cursor.col === unit.col && cursor.row === unit.row)) {
            confirmsRejected += 1;
          } else if (follower.setDestination(grid, unitPos.x, unitPos.y, cursor.col, cursor.row)) {
            lastPath = follower.path;
            moving = true;
          } else {
            confirmsRejected += 1;
          }
        }

        if (moving) {
          const stepDist = (UNIT_SPEED * deltaMs) / 1000;
          const r = follower.step(unitPos.x, unitPos.y, stepDist);
          unitPos.x = r.x;
          unitPos.y = r.y;
          unitSprite.setPosition(r.x, r.y);
          if (r.arrived) {
            moving = false;
            unit = { ...cursor };
            arrivedAt = { ...unit };
            recomputeReachable();
          }
        }
      },

      dispose(): void {
        if (disposed) return;
        disposed = true;
        debugHandle.dispose();
        nav.remove('battlefield');
        try {
          unitSprite.destroy();
          cursorSprite.destroy();
        } catch {
          /* tearing down */
        }
      },
    };
  },
};
