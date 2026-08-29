import type {
  GameContext,
  InstalledSystemPack,
  NavCellRef,
  NavGrid,
  NavGridSpec,
  NavPath,
  NavQueryOptions,
  NavService,
  ReachableCell,
  SystemPackDefinition,
} from '@sw2d/contracts';
import { NavGridError } from '@sw2d/contracts';
import { CAPABILITY_IDS, PACK_IDS } from '../ids.ts';

/**
 * Navigation pack: deterministic grid pathfinding (capability program Phase 5),
 * publishing `world.navigation`. Project-owned A* + Dijkstra flood - no new
 * dependency. AI/preset code requests paths and reachable sets; it never
 * reimplements search.
 */

const SQRT2 = Math.SQRT2;

const ORTHO: ReadonlyArray<readonly [number, number]> = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];
const DIAG: ReadonlyArray<readonly [number, number]> = [
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
];

class NavGridImpl implements NavGrid {
  readonly cols: number;
  readonly rows: number;
  readonly cellSize: number;
  readonly #originX: number;
  readonly #originY: number;
  readonly #walkable: Uint8Array;
  readonly #cost: Float64Array;

  constructor(spec: NavGridSpec) {
    if (!Number.isInteger(spec.cols) || spec.cols <= 0 || !Number.isInteger(spec.rows) || spec.rows <= 0) {
      throw new NavGridError(`grid dims must be positive integers, got ${spec.cols}x${spec.rows}`);
    }
    if (!(spec.cellSize > 0)) throw new NavGridError(`cellSize must be > 0, got ${spec.cellSize}`);
    this.cols = spec.cols;
    this.rows = spec.rows;
    this.cellSize = spec.cellSize;
    this.#originX = spec.originX ?? spec.cellSize / 2;
    this.#originY = spec.originY ?? spec.cellSize / 2;
    this.#walkable = new Uint8Array(spec.cols * spec.rows).fill(1);
    this.#cost = new Float64Array(spec.cols * spec.rows).fill(1);
    for (const [c, r] of spec.blocked ?? []) this.setWalkable(c, r, false);
    for (const [c, r, cost] of spec.costs ?? []) this.setCost(c, r, cost);
  }

  #inBounds(col: number, row: number): boolean {
    return col >= 0 && col < this.cols && row >= 0 && row < this.rows;
  }

  #idx(col: number, row: number): number {
    return row * this.cols + col;
  }

  isWalkable(col: number, row: number): boolean {
    return this.#inBounds(col, row) && this.#walkable[this.#idx(col, row)] === 1;
  }

  setWalkable(col: number, row: number, walkable: boolean): void {
    if (!this.#inBounds(col, row)) throw new NavGridError(`cell (${col},${row}) out of bounds`);
    this.#walkable[this.#idx(col, row)] = walkable ? 1 : 0;
  }

  cost(col: number, row: number): number {
    return this.#inBounds(col, row) ? this.#cost[this.#idx(col, row)]! : Number.POSITIVE_INFINITY;
  }

  setCost(col: number, row: number, cost: number): void {
    if (!this.#inBounds(col, row)) throw new NavGridError(`cell (${col},${row}) out of bounds`);
    if (!(cost >= 1)) throw new NavGridError(`cost must be >= 1, got ${cost}`);
    this.#cost[this.#idx(col, row)] = cost;
  }

  worldToCell(x: number, y: number): NavCellRef {
    return {
      col: Math.max(0, Math.min(this.cols - 1, Math.round((x - this.#originX) / this.cellSize))),
      row: Math.max(0, Math.min(this.rows - 1, Math.round((y - this.#originY) / this.cellSize))),
    };
  }

  cellToWorld(col: number, row: number): readonly [number, number] {
    return [this.#originX + col * this.cellSize, this.#originY + row * this.cellSize];
  }

  #neighbours(col: number, row: number, options: NavQueryOptions | undefined): NavCellRef[] {
    const out: NavCellRef[] = [];
    for (const [dc, dr] of ORTHO) {
      if (this.isWalkable(col + dc, row + dr)) out.push({ col: col + dc, row: row + dr });
    }
    if (options?.diagonals) {
      const forbidCut = (options.cornerCutting ?? 'forbidden') === 'forbidden';
      for (const [dc, dr] of DIAG) {
        if (!this.isWalkable(col + dc, row + dr)) continue;
        if (forbidCut && (!this.isWalkable(col + dc, row) || !this.isWalkable(col, row + dr))) continue;
        out.push({ col: col + dc, row: row + dr });
      }
    }
    return out;
  }

  #heuristic(a: NavCellRef, b: NavCellRef, diagonals: boolean): number {
    const dx = Math.abs(a.col - b.col);
    const dy = Math.abs(a.row - b.row);
    return diagonals ? Math.max(dx, dy) + (SQRT2 - 1) * Math.min(dx, dy) : dx + dy;
  }

  findPath(from: NavCellRef, to: NavCellRef, options?: NavQueryOptions): NavPath | null {
    if (!this.isWalkable(from.col, from.row) || !this.isWalkable(to.col, to.row)) return null;
    const size = this.cols * this.rows;
    const g = new Float64Array(size).fill(Number.POSITIVE_INFINITY);
    const cameFrom = new Int32Array(size).fill(-1);
    const closed = new Uint8Array(size);
    const startIdx = this.#idx(from.col, from.row);
    const goalIdx = this.#idx(to.col, to.row);
    g[startIdx] = 0;
    // Open list as an array; deterministic pop by (f, h, seq).
    let seq = 0;
    const open: { idx: number; f: number; h: number; seq: number }[] = [
      { idx: startIdx, f: this.#heuristic(from, to, Boolean(options?.diagonals)), h: 0, seq: seq++ },
    ];

    while (open.length > 0) {
      let bi = 0;
      for (let i = 1; i < open.length; i++) {
        const o = open[i]!;
        const b = open[bi]!;
        if (o.f < b.f || (o.f === b.f && o.h < b.h) || (o.f === b.f && o.h === b.h && o.seq < b.seq)) bi = i;
      }
      const current = open.splice(bi, 1)[0]!;
      if (current.idx === goalIdx) return this.#reconstruct(cameFrom, startIdx, goalIdx, g[goalIdx]!);
      if (closed[current.idx] === 1) continue;
      closed[current.idx] = 1;
      const col = current.idx % this.cols;
      const row = (current.idx - col) / this.cols;
      for (const n of this.#neighbours(col, row, options)) {
        const ni = this.#idx(n.col, n.row);
        if (closed[ni] === 1) continue;
        const stepDiag = n.col !== col && n.row !== row;
        const tentative = g[current.idx]! + this.cost(n.col, n.row) * (stepDiag ? SQRT2 : 1);
        if (tentative < g[ni]!) {
          g[ni] = tentative;
          cameFrom[ni] = current.idx;
          const h = this.#heuristic(n, to, Boolean(options?.diagonals));
          open.push({ idx: ni, f: tentative + h, h, seq: seq++ });
        }
      }
    }
    return null;
  }

  #reconstruct(cameFrom: Int32Array, startIdx: number, goalIdx: number, cost: number): NavPath {
    const cells: NavCellRef[] = [];
    let cur = goalIdx;
    while (cur !== -1) {
      const col = cur % this.cols;
      cells.push({ col, row: (cur - col) / this.cols });
      if (cur === startIdx) break;
      cur = cameFrom[cur]!;
    }
    cells.reverse();
    return { cells, cost, points: cells.map((c) => this.cellToWorld(c.col, c.row)) };
  }

  reachable(from: NavCellRef, budget: number, options?: NavQueryOptions): readonly ReachableCell[] {
    if (!this.isWalkable(from.col, from.row)) return [];
    const size = this.cols * this.rows;
    const dist = new Float64Array(size).fill(Number.POSITIVE_INFINITY);
    const startIdx = this.#idx(from.col, from.row);
    dist[startIdx] = 0;
    let seq = 0;
    const frontier: { idx: number; d: number; seq: number }[] = [{ idx: startIdx, d: 0, seq: seq++ }];
    const result: ReachableCell[] = [];
    const visited = new Uint8Array(size);

    while (frontier.length > 0) {
      let bi = 0;
      for (let i = 1; i < frontier.length; i++) {
        const o = frontier[i]!;
        const b = frontier[bi]!;
        if (o.d < b.d || (o.d === b.d && o.seq < b.seq)) bi = i;
      }
      const current = frontier.splice(bi, 1)[0]!;
      if (visited[current.idx] === 1) continue;
      visited[current.idx] = 1;
      const col = current.idx % this.cols;
      const row = (current.idx - col) / this.cols;
      result.push({ col, row, cost: current.d });
      for (const n of this.#neighbours(col, row, options)) {
        const ni = this.#idx(n.col, n.row);
        const stepDiag = n.col !== col && n.row !== row;
        const nd = current.d + this.cost(n.col, n.row) * (stepDiag ? SQRT2 : 1);
        if (nd <= budget + 1e-9 && nd < dist[ni]!) {
          dist[ni] = nd;
          frontier.push({ idx: ni, d: nd, seq: seq++ });
        }
      }
    }
    return result.sort((a, b) => a.cost - b.cost || a.row - b.row || a.col - b.col);
  }
}

class NavServiceImpl implements NavService {
  readonly #grids = new Map<string, NavGridImpl>();

  defineGrid(id: string, spec: NavGridSpec): NavGrid {
    const grid = new NavGridImpl(spec);
    this.#grids.set(id, grid);
    return grid;
  }

  defineGridFromSolids(
    id: string,
    dims: { cols: number; rows: number; cellSize: number; originX?: number; originY?: number },
    solids: readonly { x: number; y: number; width: number; height: number }[],
  ): NavGrid {
    const grid = new NavGridImpl({ ...dims });
    const ox = dims.originX ?? dims.cellSize / 2;
    const oy = dims.originY ?? dims.cellSize / 2;
    for (const s of solids) {
      const c0 = Math.max(0, Math.floor((s.x - ox) / dims.cellSize + 0.5));
      const c1 = Math.min(dims.cols - 1, Math.ceil((s.x + s.width - ox) / dims.cellSize - 0.5));
      const r0 = Math.max(0, Math.floor((s.y - oy) / dims.cellSize + 0.5));
      const r1 = Math.min(dims.rows - 1, Math.ceil((s.y + s.height - oy) / dims.cellSize - 0.5));
      for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) grid.setWalkable(c, r, false);
    }
    this.#grids.set(id, grid);
    return grid;
  }

  grid(id: string): NavGrid | undefined {
    return this.#grids.get(id);
  }

  gridIds(): readonly string[] {
    return [...this.#grids.keys()].sort();
  }

  remove(id: string): void {
    this.#grids.delete(id);
  }
}

export const navigationPack: SystemPackDefinition<undefined, GameContext> = {
  id: PACK_IDS.navigation,
  version: '0.1.0',
  provides: [CAPABILITY_IDS.navigation],
  dependencies: [],

  install(context: GameContext): InstalledSystemPack {
    const service = new NavServiceImpl();
    const handle = context.capabilities.provide(CAPABILITY_IDS.navigation, service);
    return {
      id: PACK_IDS.navigation,
      dispose(): void {
        handle.dispose();
      },
    };
  },
};

export type { NavService, NavGrid } from '@sw2d/contracts';
