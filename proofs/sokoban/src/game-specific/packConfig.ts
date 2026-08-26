/**
 * Config for packs that declare `configSource: 'code'` in their definition -
 * config carrying functions, which content/game.json cannot express.
 *
 * Passed to createGame({ packConfig }) by src/main.ts. Packs configured as
 * JSON stay in content/game.json; nothing here overrides those.
 *
 * This is the real puzzle state for Proof D (see ../PROOF_CONTRACT.md) - not
 * the generated placeholder. The board (walls, the single goal cell) is a
 * small hand-authored constant table, closed over by both functions below;
 * `sw2d.puzzle` itself stays generic over an opaque `TState`.
 */

export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface SokobanState {
  readonly player: Point;
  readonly box: Point;
}

/** 5x5 board, `(0,0)` top-left. `#` = wall, everything else (including the goal) is walkable floor. */
const WALLS: ReadonlySet<string> = new Set(
  [
    [0, 0], [1, 0], [2, 0], [3, 0], [4, 0],
    [0, 1], [4, 1],
    [0, 2], [4, 2],
    [0, 3], [4, 3],
    [0, 4], [1, 4], [2, 4], [3, 4], [4, 4],
  ].map(([x, y]) => `${x},${y}`),
);

export const GOAL: Point = { x: 3, y: 3 };
export const PLAYER_START: Point = { x: 1, y: 1 };
export const BOX_START: Point = { x: 2, y: 2 };

export function isWall(point: Point): boolean {
  return WALLS.has(`${point.x},${point.y}`);
}

export function pointsEqual(a: Point, b: Point): boolean {
  return a.x === b.x && a.y === b.y;
}

function createInitialState(): SokobanState {
  return { player: { ...PLAYER_START }, box: { ...BOX_START } };
}

function isSolved(state: SokobanState): boolean {
  return pointsEqual(state.box, GOAL);
}

export const PACK_CONFIG: Readonly<Record<string, unknown>> = {
  'sw2d.puzzle': { createInitialState, isSolved },
};
