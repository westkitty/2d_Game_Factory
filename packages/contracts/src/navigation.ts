/**
 * Navigation & pathfinding (capability program Phase 5).
 *
 * Deterministic, project-owned, renderer-neutral grid navigation, separate
 * from AI state: AI systems *request paths*, they do not each implement
 * pathfinding. A* with stable tie-breaking, a Dijkstra reachable-range flood
 * for turn-based tactics, dynamic blocker updates, and an explicit
 * corner-cutting policy.
 */

export const NAV_CAPABILITY_ID = 'world.navigation';

export interface NavGridSpec {
  readonly cols: number;
  readonly rows: number;
  /** World size of one cell. */
  readonly cellSize: number;
  /** World position of cell (0,0)'s centre. Default (cellSize/2, cellSize/2). */
  readonly originX?: number;
  readonly originY?: number;
  /** Blocked cells, as `[col, row]`. */
  readonly blocked?: readonly (readonly [number, number])[];
  /** Per-cell movement cost overrides, `[col, row, cost]` (cost >= 1). */
  readonly costs?: readonly (readonly [number, number, number])[];
}

export interface NavCellRef {
  readonly col: number;
  readonly row: number;
}

export interface NavQueryOptions {
  readonly diagonals?: boolean;
  /** `'forbidden'` (default): a diagonal step is disallowed if either shared orthogonal cell is blocked. */
  readonly cornerCutting?: 'forbidden' | 'allowed';
}

export interface NavPath {
  /** Cells from start to goal inclusive. */
  readonly cells: readonly NavCellRef[];
  /** Total accumulated movement cost. */
  readonly cost: number;
  /** World-space centre points of each cell, for a follower. */
  readonly points: readonly (readonly [number, number])[];
}

export interface ReachableCell extends NavCellRef {
  /** Accumulated cost to reach this cell (<= budget). */
  readonly cost: number;
}

export interface NavGrid {
  readonly cols: number;
  readonly rows: number;
  readonly cellSize: number;
  isWalkable(col: number, row: number): boolean;
  setWalkable(col: number, row: number, walkable: boolean): void;
  cost(col: number, row: number): number;
  setCost(col: number, row: number, cost: number): void;
  worldToCell(x: number, y: number): NavCellRef;
  cellToWorld(col: number, row: number): readonly [number, number];
  /** Shortest path, or null if none. Deterministic given identical grid + query. */
  findPath(from: NavCellRef, to: NavCellRef, options?: NavQueryOptions): NavPath | null;
  /** Every cell reachable within `budget` accumulated cost, sorted by (cost, row, col). */
  reachable(from: NavCellRef, budget: number, options?: NavQueryOptions): readonly ReachableCell[];
}

export class NavGridError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NavGridError';
  }
}

export interface NavService {
  /** Create and register a grid. Throws NavGridError on a malformed spec. */
  defineGrid(id: string, spec: NavGridSpec): NavGrid;
  /** Build a grid from a level's solid rectangles: any cell a solid overlaps is blocked. */
  defineGridFromSolids(
    id: string,
    dims: { cols: number; rows: number; cellSize: number; originX?: number; originY?: number },
    solids: readonly { x: number; y: number; width: number; height: number }[],
  ): NavGrid;
  grid(id: string): NavGrid | undefined;
  gridIds(): readonly string[];
  remove(id: string): void;
}

/**
 * Advance a position `distance` world units along a path's points. Pure.
 * Returns the new position, the index of the point currently being
 * approached, and whether the path end has been reached.
 */
export function advanceAlongPath(
  path: NavPath,
  x: number,
  y: number,
  fromIndex: number,
  distance: number,
): { readonly x: number; readonly y: number; readonly index: number; readonly done: boolean } {
  const pts = path.points;
  if (pts.length === 0) return { x, y, index: 0, done: true };
  let index = Math.min(Math.max(fromIndex, 0), pts.length - 1);
  let px = x;
  let py = y;
  let remaining = distance;
  while (remaining > 0 && index < pts.length) {
    const [tx, ty] = pts[index]!;
    const dx = tx - px;
    const dy = ty - py;
    const segLen = Math.hypot(dx, dy);
    if (segLen <= remaining) {
      px = tx;
      py = ty;
      remaining -= segLen;
      index += 1;
    } else {
      px += (dx / segLen) * remaining;
      py += (dy / segLen) * remaining;
      remaining = 0;
    }
  }
  const done = index >= pts.length;
  return { x: px, y: py, index: Math.min(index, pts.length - 1), done };
}

/**
 * A stateful follower: request a destination once, then `step()` each frame.
 * Re-request the destination (cheap when unchanged) after the grid's blockers
 * change and the current path is no longer valid.
 */
export interface RouteFollower {
  setDestination(grid: NavGrid, fromX: number, fromY: number, toCol: number, toRow: number, options?: NavQueryOptions): boolean;
  step(x: number, y: number, distance: number): { readonly x: number; readonly y: number; readonly arrived: boolean };
  /** True if the last `setDestination` found no path. */
  readonly blocked: boolean;
  readonly path: NavPath | null;
}

export function createRouteFollower(): RouteFollower {
  let path: NavPath | null = null;
  let index = 1;
  let blocked = false;
  return {
    get blocked() {
      return blocked;
    },
    get path() {
      return path;
    },
    setDestination(grid, fromX, fromY, toCol, toRow, options) {
      const from = grid.worldToCell(fromX, fromY);
      const next = grid.findPath(from, { col: toCol, row: toRow }, options);
      blocked = next === null;
      if (next) {
        path = next;
        index = 1;
      }
      return !blocked;
    },
    step(x, y, distance) {
      if (!path) return { x, y, arrived: true };
      const r = advanceAlongPath(path, x, y, index, distance);
      index = r.index;
      return { x: r.x, y: r.y, arrived: r.done };
    },
  };
}
