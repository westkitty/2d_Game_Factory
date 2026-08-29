/**
 * Data-driven puzzle rules (capability program Phase 6).
 *
 * Standard puzzle presets no longer need a TypeScript `createInitialState` /
 * `isSolved` callback (ADR-0017's `configSource: 'code'` seam) merely to
 * install a puzzle. `content/puzzles.json` (schema `puzzle-rules`) is a
 * **bounded discriminated union** of built-in puzzle kinds; `sw2d.puzzle-rules`
 * turns the chosen definition into a live board with `apply` / `undo` /
 * `reset` / `isSolved`. A genuinely unique mechanic still uses the
 * code-configured `sw2d.puzzle` pack - this does not replace it.
 */

export const PUZZLE_RULES_CAPABILITY_ID = 'puzzle.rules';

export type GridDir = 'up' | 'down' | 'left' | 'right';
export type Cell = readonly [number, number];

// --- Sokoban ---------------------------------------------------------
export interface SokobanRules {
  readonly kind: 'sokoban';
  readonly width: number;
  readonly height: number;
  readonly walls: readonly Cell[];
  readonly boxes: readonly Cell[];
  readonly goals: readonly Cell[];
  readonly player: Cell;
}

// --- Switch / sequence / logic --------------------------------------
export interface SwitchRules {
  readonly kind: 'switch-sequence';
  readonly switches: readonly string[];
  /** Switches that start pressed/on. */
  readonly initiallyOn?: readonly string[];
  /** Optional: pressing switch X also toggles these. */
  readonly links?: Readonly<Record<string, readonly string[]>>;
  readonly completeWhen:
    | { readonly kind: 'all-on' }
    | { readonly kind: 'exact-set'; readonly on: readonly string[] }
    | { readonly kind: 'sequence'; readonly order: readonly string[] }
    | { readonly kind: 'count'; readonly on: number };
}

// --- Match puzzle ---------------------------------------------------
export interface MatchRules {
  readonly kind: 'match';
  readonly width: number;
  readonly height: number;
  readonly pieceTypes: number;
  /** row-major board, values 0..pieceTypes-1. */
  readonly board: readonly (readonly number[])[];
  readonly matchLength: number;
  readonly objectiveClears: number;
}

// --- Falling block ------------------------------------------------
export interface FallingBlockRules {
  readonly kind: 'falling-block';
  readonly width: number;
  readonly height: number;
  /** Each piece: a list of [col,row] offsets from origin, and its spawn column. */
  readonly pieces: readonly { readonly cells: readonly Cell[]; readonly spawnCol: number }[];
  /** Deterministic piece order (indices into `pieces`), repeated cyclically. */
  readonly sequence: readonly number[];
  readonly objectiveLines: number;
}

// --- Physics goal (definitions only; Phase 9 runs the physics) -----
export interface PhysicsGoalRules {
  readonly kind: 'physics-goal';
  readonly goals: readonly {
    readonly entityId: string;
    /** Axis-aligned target zone in world units. */
    readonly zone: { readonly x: number; readonly y: number; readonly width: number; readonly height: number };
  }[];
}

export type PuzzleRules = SokobanRules | SwitchRules | MatchRules | FallingBlockRules | PhysicsGoalRules;
export type PuzzleKind = PuzzleRules['kind'];

export interface PuzzleRulesDoc {
  readonly schemaVersion: number;
  /** Named puzzle definitions; a game selects one by id. */
  readonly puzzles: readonly ({ readonly id: string } & PuzzleRules)[];
}

// --- Operations & state ------------------------------------------

/** A bounded operation vocabulary - never arbitrary code. */
export type PuzzleOp =
  | { readonly kind: 'move'; readonly dir: GridDir }
  | { readonly kind: 'toggle'; readonly id: string }
  | { readonly kind: 'swap'; readonly a: Cell; readonly b: Cell }
  | { readonly kind: 'rotate' }
  | { readonly kind: 'tick' }
  | { readonly kind: 'hard-drop' }
  | { readonly kind: 'report-entity'; readonly entityId: string; readonly x: number; readonly y: number };

/** Renderer-neutral snapshot; shape varies by kind but is always plain data. */
export interface PuzzleSnapshot {
  readonly kind: PuzzleKind;
  readonly solved: boolean;
  readonly moves: number;
  /** Kind-specific fields (player position, on-switches, cleared count, ...). */
  readonly [key: string]: unknown;
}

export interface PuzzleRulesService {
  definitionIds(): readonly string[];
  /** Load a puzzle definition as the active board. Clears history. Throws for an unknown id. */
  load(puzzleId: string): void;
  /** Apply a bounded operation. Unsupported ops for the active kind are ignored. */
  apply(op: PuzzleOp): PuzzleSnapshot;
  undo(): PuzzleSnapshot | null;
  reset(): PuzzleSnapshot;
  snapshot(): PuzzleSnapshot;
  isSolved(): boolean;
}
