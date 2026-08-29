import { describe, expect, it } from 'vitest';
import { advanceAlongPath, NAV_CAPABILITY_ID, NavGridError, type GameContext, type NavService } from '@sw2d/contracts';
import { CAPABILITY_IDS } from '../src/ids.ts';
import { navigationPack } from '../src/navigation/navigationPack.ts';
import { FakeCapabilityRegistry, FakeEventBus } from './testSupport.ts';

function makeService(): NavService {
  const capabilities = new FakeCapabilityRegistry();
  const ctx = { events: new FakeEventBus(), capabilities } as unknown as GameContext;
  navigationPack.install(ctx, undefined);
  return capabilities.require<NavService>(NAV_CAPABILITY_ID);
}

const cell = (col: number, row: number) => ({ col, row });

describe('sw2d.navigation - ids', () => {
  it('publishes world.navigation', () => {
    expect(NAV_CAPABILITY_ID).toBe(CAPABILITY_IDS.navigation);
    expect(navigationPack.provides).toEqual([CAPABILITY_IDS.navigation]);
  });
});

describe('NavGrid.findPath', () => {
  it('finds the shortest orthogonal path across an open grid', () => {
    const grid = makeService().defineGrid('open', { cols: 5, rows: 5, cellSize: 10 });
    const path = grid.findPath(cell(0, 0), cell(4, 0));
    expect(path).not.toBeNull();
    expect(path!.cells).toEqual([cell(0, 0), cell(1, 0), cell(2, 0), cell(3, 0), cell(4, 0)]);
    expect(path!.cost).toBe(4);
    expect(path!.points[0]).toEqual([5, 5]); // origin defaults to cellSize/2
  });

  it('returns null when the goal is walled off', () => {
    const grid = makeService().defineGrid('walled', {
      cols: 5,
      rows: 5,
      cellSize: 10,
      blocked: [[2, 0], [2, 1], [2, 2], [2, 3], [2, 4]],
    });
    expect(grid.findPath(cell(0, 0), cell(4, 4))).toBeNull();
  });

  it('routes around a corner without cutting it when cornerCutting is forbidden', () => {
    const grid = makeService().defineGrid('corner', { cols: 3, rows: 3, cellSize: 10, blocked: [[1, 0], [0, 1]] });
    // (0,0) is boxed in on its diagonal neighbour (1,1) via forbidden corner cut.
    const forbidden = grid.findPath(cell(0, 0), cell(2, 2), { diagonals: true, cornerCutting: 'forbidden' });
    expect(forbidden).toBeNull();
    const allowed = grid.findPath(cell(0, 0), cell(2, 2), { diagonals: true, cornerCutting: 'allowed' });
    expect(allowed).not.toBeNull();
  });

  it('a diagonal path is shorter than the orthogonal one when diagonals are enabled', () => {
    const grid = makeService().defineGrid('diag', { cols: 5, rows: 5, cellSize: 10 });
    const ortho = grid.findPath(cell(0, 0), cell(4, 4))!;
    const diag = grid.findPath(cell(0, 0), cell(4, 4), { diagonals: true })!;
    expect(diag.cost).toBeLessThan(ortho.cost);
    expect(diag.cells).toHaveLength(5); // straight diagonal
  });

  it('routes around a high-cost cell', () => {
    const grid = makeService().defineGrid('weighted', { cols: 3, rows: 3, cellSize: 10, costs: [[1, 0, 50]] });
    const path = grid.findPath(cell(0, 0), cell(2, 0))!;
    expect(path.cells.some((c) => c.col === 1 && c.row === 0)).toBe(false); // detoured
  });

  it('is deterministic - identical grid and query yield an identical path', () => {
    const spec = { cols: 8, rows: 8, cellSize: 16, blocked: [[3, 3], [3, 4], [4, 3]] as [number, number][] };
    const a = makeService().defineGrid('a', spec).findPath(cell(0, 0), cell(7, 7), { diagonals: true });
    const b = makeService().defineGrid('b', spec).findPath(cell(0, 0), cell(7, 7), { diagonals: true });
    expect(a).toEqual(b);
  });

  it('re-paths around a newly blocked cell (a placed tower cannot permanently strand a route)', () => {
    const grid = makeService().defineGrid('dyn', { cols: 5, rows: 3, cellSize: 10 });
    const before = grid.findPath(cell(0, 1), cell(4, 1))!;
    expect(before.cells).toContainEqual(cell(2, 1));
    grid.setWalkable(2, 1, false);
    const after = grid.findPath(cell(0, 1), cell(4, 1))!;
    expect(after.cells).not.toContainEqual(cell(2, 1));
    expect(after.cost).toBeGreaterThan(before.cost);
    // Fully walling column 2 leaves no route at all.
    grid.setWalkable(2, 0, false);
    grid.setWalkable(2, 2, false);
    expect(grid.findPath(cell(0, 1), cell(4, 1))).toBeNull();
  });
});

describe('NavGrid.reachable', () => {
  it('returns every cell within the movement budget, sorted by (cost, row, col)', () => {
    const grid = makeService().defineGrid('range', { cols: 5, rows: 5, cellSize: 10 });
    const set = grid.reachable(cell(2, 2), 2);
    // Manhattan disc of radius 2 = 13 cells.
    expect(set).toHaveLength(13);
    expect(set[0]).toEqual({ col: 2, row: 2, cost: 0 });
    for (let i = 1; i < set.length; i++) expect(set[i]!.cost).toBeGreaterThanOrEqual(set[i - 1]!.cost);
  });

  it('a blocked cell removes it and anything only reachable through it', () => {
    const grid = makeService().defineGrid('range2', { cols: 5, rows: 1, cellSize: 10, blocked: [[2, 0]] });
    const set = grid.reachable(cell(0, 0), 10);
    expect(set.map((c) => c.col).sort((a, b) => a - b)).toEqual([0, 1]);
  });
});

describe('NavGrid - errors & lifecycle', () => {
  it('rejects a malformed spec', () => {
    const svc = makeService();
    expect(() => svc.defineGrid('bad', { cols: 0, rows: 5, cellSize: 10 })).toThrow(NavGridError);
    expect(() => svc.defineGrid('bad', { cols: 5, rows: 5, cellSize: 0 })).toThrow(NavGridError);
  });

  it('defineGridFromSolids blocks overlapped cells', () => {
    const grid = makeService().defineGridFromSolids('lvl', { cols: 6, rows: 3, cellSize: 10 }, [{ x: 20, y: 0, width: 20, height: 30 }]);
    expect(grid.isWalkable(2, 1)).toBe(false);
    expect(grid.isWalkable(3, 1)).toBe(false);
    expect(grid.isWalkable(0, 1)).toBe(true);
  });

  it('remove() forgets a grid', () => {
    const svc = makeService();
    svc.defineGrid('temp', { cols: 3, rows: 3, cellSize: 10 });
    expect(svc.grid('temp')).toBeDefined();
    svc.remove('temp');
    expect(svc.grid('temp')).toBeUndefined();
  });
});

describe('advanceAlongPath', () => {
  it('walks a mover along a path by a fixed distance', () => {
    const path = { cells: [], cost: 0, points: [[0, 0], [100, 0], [100, 100]] as [number, number][] };
    const a = advanceAlongPath(path, 0, 0, 1, 40);
    expect(a).toEqual({ x: 40, y: 0, index: 1, done: false });
    const b = advanceAlongPath(path, 100, 0, 1, 150);
    expect(b.x).toBe(100);
    expect(b.y).toBe(100);
    expect(b.done).toBe(true);
  });
});
