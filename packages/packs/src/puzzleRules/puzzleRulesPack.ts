import type {
  Cell,
  FallingBlockRules,
  GameContext,
  GridDir,
  InstalledSystemPack,
  MatchRules,
  PhysicsGoalRules,
  PuzzleOp,
  PuzzleRules,
  PuzzleRulesDoc,
  PuzzleRulesService,
  PuzzleSnapshot,
  SokobanRules,
  SwitchRules,
  SystemPackDefinition,
} from '@sw2d/contracts';
import { CAPABILITY_IDS, PACK_IDS } from '../ids.ts';

/**
 * Puzzle-rules pack: bounded, data-driven puzzle engines (capability program
 * Phase 6), publishing `puzzle.rules`. Sokoban / switch-sequence / match /
 * falling-block / physics-goal - a discriminated union, not a DSL. A game
 * selects a puzzle by id from `content/puzzles.json`; this pack owns
 * `apply` / `undo` / `reset` / `isSolved` with no game-specific callback.
 */

export class UnknownPuzzleError extends Error {
  constructor(id: string) {
    super(`No puzzle defined with id "${id}" in content/puzzles.json.`);
    this.name = 'UnknownPuzzleError';
  }
}

const DELTA: Readonly<Record<GridDir, Cell>> = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const eq = (a: Cell, b: Cell): boolean => a[0] === b[0] && a[1] === b[1];
const has = (list: readonly Cell[], c: Cell): boolean => list.some((x) => eq(x, c));

interface Engine<S> {
  initial(rules: PuzzleRules): S;
  apply(state: S, op: PuzzleOp, rules: PuzzleRules): S;
  solved(state: S, rules: PuzzleRules): boolean;
  extra(state: S, rules: PuzzleRules): Record<string, unknown>;
}

// --- sokoban ---------------------------------------------------------
interface SokoState {
  readonly player: Cell;
  readonly boxes: readonly Cell[];
}
const sokoban: Engine<SokoState> = {
  initial: (r) => ({ player: (r as SokobanRules).player, boxes: (r as SokobanRules).boxes }),
  apply(state, op, rulesIn) {
    if (op.kind !== 'move') return state;
    const r = rulesIn as SokobanRules;
    const d = DELTA[op.dir];
    const dest: Cell = [state.player[0] + d[0], state.player[1] + d[1]];
    if (dest[0] < 0 || dest[1] < 0 || dest[0] >= r.width || dest[1] >= r.height) return state;
    if (has(r.walls, dest)) return state;
    if (has(state.boxes, dest)) {
      const beyond: Cell = [dest[0] + d[0], dest[1] + d[1]];
      if (beyond[0] < 0 || beyond[1] < 0 || beyond[0] >= r.width || beyond[1] >= r.height) return state;
      if (has(r.walls, beyond) || has(state.boxes, beyond)) return state;
      return { player: dest, boxes: state.boxes.map((b) => (eq(b, dest) ? beyond : b)) };
    }
    return { player: dest, boxes: state.boxes };
  },
  solved: (state, rulesIn) => (rulesIn as SokobanRules).goals.every((g) => has(state.boxes, g)),
  extra: (state, rulesIn) => ({
    playerCol: state.player[0],
    playerRow: state.player[1],
    boxes: state.boxes.map((b) => [b[0], b[1]] as const),
    goals: (rulesIn as SokobanRules).goals.map((g) => [g[0], g[1]] as const),
    boxesOnGoals: (rulesIn as SokobanRules).goals.filter((g) => has(state.boxes, g)).length,
    goalCount: (rulesIn as SokobanRules).goals.length,
  }),
};

// --- switch-sequence ----------------------------------------------
interface SwitchState {
  readonly on: readonly string[];
  readonly pressOrder: readonly string[];
}
const switchSeq: Engine<SwitchState> = {
  initial: (r) => ({ on: [...((r as SwitchRules).initiallyOn ?? [])].sort(), pressOrder: [] }),
  apply(state, op, rulesIn) {
    if (op.kind !== 'toggle') return state;
    const r = rulesIn as SwitchRules;
    if (!r.switches.includes(op.id)) return state;
    const set = new Set(state.on);
    const flip = (id: string): void => {
      if (set.has(id)) set.delete(id);
      else set.add(id);
    };
    flip(op.id);
    for (const linked of r.links?.[op.id] ?? []) if (r.switches.includes(linked)) flip(linked);
    return { on: [...set].sort(), pressOrder: [...state.pressOrder, op.id] };
  },
  solved(state, rulesIn) {
    const r = rulesIn as SwitchRules;
    const c = r.completeWhen;
    if (c.kind === 'all-on') return state.on.length === r.switches.length;
    if (c.kind === 'count') return state.on.length === c.on;
    if (c.kind === 'exact-set') {
      const want = [...c.on].sort();
      return want.length === state.on.length && want.every((x, i) => x === state.on[i]);
    }
    // sequence: the press order must end with exactly the target order.
    const tail = state.pressOrder.slice(-c.order.length);
    return tail.length === c.order.length && tail.every((x, i) => x === c.order[i]);
  },
  extra: (state, rulesIn) => ({
    on: state.on,
    pressOrder: state.pressOrder,
    switches: (rulesIn as SwitchRules).switches,
  }),
};

// --- match --------------------------------------------------------
interface MatchState {
  readonly board: readonly (readonly number[])[];
  readonly clears: number;
}
function findMatchedCells(board: readonly (readonly number[])[], len: number): boolean[][] {
  const h = board.length;
  const w = board[0]?.length ?? 0;
  const mark = Array.from({ length: h }, () => Array<boolean>(w).fill(false));
  for (let r = 0; r < h; r++) {
    let run = 1;
    for (let c = 1; c <= w; c++) {
      if (c < w && board[r]![c]! === board[r]![c - 1]! && board[r]![c]! >= 0) run++;
      else {
        if (run >= len) for (let k = c - run; k < c; k++) mark[r]![k] = true;
        run = 1;
      }
    }
  }
  for (let c = 0; c < w; c++) {
    let run = 1;
    for (let r = 1; r <= h; r++) {
      if (r < h && board[r]![c]! === board[r - 1]![c]! && board[r]![c]! >= 0) run++;
      else {
        if (run >= len) for (let k = r - run; k < r; k++) mark[k]![c] = true;
        run = 1;
      }
    }
  }
  return mark;
}
const match: Engine<MatchState> = {
  initial: (r) => ({ board: (r as MatchRules).board.map((row) => [...row]), clears: 0 }),
  apply(state, op, rulesIn) {
    if (op.kind !== 'swap') return state;
    const r = rulesIn as MatchRules;
    const [ax, ay] = op.a;
    const [bx, by] = op.b;
    if (Math.abs(ax - bx) + Math.abs(ay - by) !== 1) return state;
    let board = state.board.map((row) => [...row]);
    [board[ay]![ax], board[by]![bx]] = [board[by]![bx]!, board[ay]![ax]!];
    let clears = state.clears;
    let cascaded = false;
    for (;;) {
      const mark = findMatchedCells(board, r.matchLength);
      let count = 0;
      for (let y = 0; y < r.height; y++) for (let x = 0; x < r.width; x++) if (mark[y]![x]) count++;
      if (count === 0) break;
      cascaded = true;
      clears += count;
      for (let y = 0; y < r.height; y++) for (let x = 0; x < r.width; x++) if (mark[y]![x]) board[y]![x] = -1;
      // gravity per column, refill deterministically.
      for (let x = 0; x < r.width; x++) {
        const col = [];
        for (let y = r.height - 1; y >= 0; y--) if (board[y]![x]! >= 0) col.push(board[y]![x]!);
        for (let y = r.height - 1, i = 0; y >= 0; y--, i++) {
          board[y]![x] = i < col.length ? col[i]! : ((x + y + clears) % r.pieceTypes);
        }
      }
    }
    if (!cascaded) {
      // no match: revert the swap (a wasted move).
      board = state.board.map((row) => [...row]);
    }
    return { board, clears };
  },
  solved: (state, rulesIn) => state.clears >= (rulesIn as MatchRules).objectiveClears,
  extra: (state) => ({ clears: state.clears }),
};

// --- falling-block (simplified: no wall kicks) --------------------
interface FbState {
  readonly grid: readonly (readonly number[])[];
  readonly active: { readonly cells: readonly Cell[] } | null;
  readonly seqPos: number;
  readonly lines: number;
  readonly toppedOut: boolean;
}
function fbCollides(grid: readonly (readonly number[])[], cells: readonly Cell[], w: number, h: number): boolean {
  return cells.some(([x, y]) => x < 0 || x >= w || y >= h || (y >= 0 && grid[y]![x] === 1));
}
function fbSpawn(r: FallingBlockRules, grid: readonly (readonly number[])[], seqPos: number): FbState {
  const idx = r.sequence[seqPos % r.sequence.length]!;
  const piece = r.pieces[idx]!;
  const cells = piece.cells.map(([cx, cy]) => [cx + piece.spawnCol, cy] as Cell);
  const toppedOut = fbCollides(grid, cells, r.width, r.height);
  return { grid, active: toppedOut ? null : { cells }, seqPos: seqPos + 1, lines: 0, toppedOut };
}
function fbLock(r: FallingBlockRules, prev: FbState): FbState {
  const grid = prev.grid.map((row) => [...row]);
  for (const [x, y] of prev.active!.cells) if (y >= 0) grid[y]![x] = 1;
  let lines = prev.lines;
  const kept = grid.filter((row) => !row.every((v) => v === 1));
  const cleared = r.height - kept.length;
  lines += cleared;
  while (kept.length < r.height) kept.unshift(Array<number>(r.width).fill(0));
  const spawned = fbSpawn(r, kept, prev.seqPos);
  return { ...spawned, lines: lines + spawned.lines };
}
const fallingBlock: Engine<FbState> = {
  initial(r) {
    const rr = r as FallingBlockRules;
    const grid = Array.from({ length: rr.height }, () => Array<number>(rr.width).fill(0));
    return fbSpawn(rr, grid, 0);
  },
  apply(state, op, rulesIn) {
    const r = rulesIn as FallingBlockRules;
    if (state.toppedOut || !state.active) return state;
    const move = (dx: number, dy: number): Cell[] => state.active!.cells.map(([x, y]) => [x + dx, y + dy] as Cell);
    if (op.kind === 'move') {
      const d = DELTA[op.dir];
      const next = move(d[0], d[1]);
      if (op.dir === 'down') return fbCollides(state.grid, next, r.width, r.height) ? fbLock(r, state) : { ...state, active: { cells: next } };
      return fbCollides(state.grid, next, r.width, r.height) ? state : { ...state, active: { cells: next } };
    }
    if (op.kind === 'tick') {
      const next = move(0, 1);
      return fbCollides(state.grid, next, r.width, r.height) ? fbLock(r, state) : { ...state, active: { cells: next } };
    }
    if (op.kind === 'rotate') {
      const [ox, oy] = state.active.cells[0]!;
      const rotated = state.active.cells.map(([x, y]) => [ox - (y - oy), oy + (x - ox)] as Cell);
      return fbCollides(state.grid, rotated, r.width, r.height) ? state : { ...state, active: { cells: rotated } };
    }
    if (op.kind === 'hard-drop') {
      let cells = state.active.cells;
      for (;;) {
        const next = cells.map(([x, y]) => [x, y + 1] as Cell);
        if (fbCollides(state.grid, next, r.width, r.height)) break;
        cells = next;
      }
      return fbLock(r, { ...state, active: { cells } });
    }
    return state;
  },
  solved: (state, rulesIn) => state.lines >= (rulesIn as FallingBlockRules).objectiveLines,
  extra: (state) => ({ lines: state.lines, toppedOut: state.toppedOut }),
};

// --- physics-goal ----------------------------------------------
interface PgState {
  readonly positions: Readonly<Record<string, readonly [number, number]>>;
}
const physicsGoal: Engine<PgState> = {
  initial: () => ({ positions: {} }),
  apply(state, op) {
    if (op.kind !== 'report-entity') return state;
    return { positions: { ...state.positions, [op.entityId]: [op.x, op.y] } };
  },
  solved: (state, rulesIn) =>
    (rulesIn as PhysicsGoalRules).goals.every((g) => {
      const p = state.positions[g.entityId];
      return p !== undefined && p[0] >= g.zone.x && p[0] <= g.zone.x + g.zone.width && p[1] >= g.zone.y && p[1] <= g.zone.y + g.zone.height;
    }),
  extra: (state, rulesIn) => ({
    goalsMet: (rulesIn as PhysicsGoalRules).goals.filter((g) => {
      const p = state.positions[g.entityId];
      return p !== undefined && p[0] >= g.zone.x && p[0] <= g.zone.x + g.zone.width && p[1] >= g.zone.y && p[1] <= g.zone.y + g.zone.height;
    }).length,
    goalCount: (rulesIn as PhysicsGoalRules).goals.length,
  }),
};

const ENGINES: Readonly<Record<PuzzleRules['kind'], Engine<unknown>>> = {
  sokoban: sokoban as Engine<unknown>,
  'switch-sequence': switchSeq as Engine<unknown>,
  match: match as Engine<unknown>,
  'falling-block': fallingBlock as Engine<unknown>,
  'physics-goal': physicsGoal as Engine<unknown>,
};

class PuzzleRulesServiceImpl implements PuzzleRulesService {
  readonly #defs = new Map<string, { id: string } & PuzzleRules>();
  #active: (({ id: string } & PuzzleRules) | null) = null;
  #engine: Engine<unknown> | null = null;
  #state: unknown = null;
  #history: unknown[] = [];
  #moves = 0;

  constructor(doc: PuzzleRulesDoc | undefined) {
    for (const p of doc?.puzzles ?? []) {
      if (this.#defs.has(p.id)) throw new Error(`Duplicate puzzle id "${p.id}".`);
      this.#defs.set(p.id, p);
    }
  }

  definitionIds(): readonly string[] {
    return [...this.#defs.keys()].sort();
  }

  load(puzzleId: string): void {
    const def = this.#defs.get(puzzleId);
    if (!def) throw new UnknownPuzzleError(puzzleId);
    this.#active = def;
    this.#engine = ENGINES[def.kind];
    this.#state = this.#engine.initial(def);
    this.#history = [];
    this.#moves = 0;
  }

  apply(op: PuzzleOp): PuzzleSnapshot {
    // No definition loaded (e.g. the capability is installed but
    // content/puzzles.json is empty): a no-op, not a crash.
    if (!this.#engine || !this.#active) return this.snapshot();
    const next = this.#engine.apply(this.#state, op, this.#active);
    if (next !== this.#state) {
      this.#history.push(this.#state);
      this.#state = next;
      this.#moves += 1;
    }
    return this.snapshot();
  }

  undo(): PuzzleSnapshot | null {
    if (this.#history.length === 0) return null;
    this.#state = this.#history.pop()!;
    this.#moves = Math.max(0, this.#moves - 1);
    return this.snapshot();
  }

  reset(): PuzzleSnapshot {
    if (!this.#engine || !this.#active) return this.snapshot();
    this.#state = this.#engine.initial(this.#active);
    this.#history = [];
    this.#moves = 0;
    return this.snapshot();
  }

  isSolved(): boolean {
    return Boolean(this.#engine && this.#active && this.#engine.solved(this.#state, this.#active));
  }

  snapshot(): PuzzleSnapshot {
    if (!this.#engine || !this.#active) return { kind: 'sokoban', solved: false, moves: 0 };
    return {
      kind: this.#active.kind,
      solved: this.#engine.solved(this.#state, this.#active),
      moves: this.#moves,
      ...this.#engine.extra(this.#state, this.#active),
    };
  }
}

export const puzzleRulesPack: SystemPackDefinition<undefined, GameContext> = {
  id: PACK_IDS.puzzleRules,
  version: '0.1.0',
  provides: [CAPABILITY_IDS.puzzleRules],
  dependencies: [],

  install(context: GameContext): InstalledSystemPack {
    const doc = context.content.data['puzzles']?.value as PuzzleRulesDoc | undefined;
    const service = new PuzzleRulesServiceImpl(doc);
    const first = service.definitionIds()[0];
    if (first) service.load(first);
    const handle = context.capabilities.provide(CAPABILITY_IDS.puzzleRules, service);
    return {
      id: PACK_IDS.puzzleRules,
      dispose(): void {
        handle.dispose();
      },
    };
  },
};

export type { PuzzleRulesService } from '@sw2d/contracts';
