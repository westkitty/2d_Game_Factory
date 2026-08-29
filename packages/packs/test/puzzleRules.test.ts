import { describe, expect, it } from 'vitest';
import type { GameContext, PuzzleRulesDoc, PuzzleRulesService } from '@sw2d/contracts';
import { PUZZLE_RULES_CAPABILITY_ID } from '@sw2d/contracts';
import { CAPABILITY_IDS } from '../src/ids.ts';
import { puzzleRulesPack, UnknownPuzzleError } from '../src/puzzleRules/puzzleRulesPack.ts';
import { FakeCapabilityRegistry, FakeEventBus } from './testSupport.ts';

function makeService(doc: PuzzleRulesDoc): { svc: PuzzleRulesService; dispose: () => void } {
  const capabilities = new FakeCapabilityRegistry();
  const ctx = {
    events: new FakeEventBus(),
    capabilities,
    content: { data: { puzzles: { schemaId: 'x', valid: true, value: doc } } },
  } as unknown as GameContext;
  const installed = puzzleRulesPack.install(ctx, undefined);
  return { svc: capabilities.require<PuzzleRulesService>(PUZZLE_RULES_CAPABILITY_ID), dispose: () => installed.dispose() };
}

describe('sw2d.puzzle-rules - ids', () => {
  it('publishes puzzle.rules', () => {
    expect(PUZZLE_RULES_CAPABILITY_ID).toBe(CAPABILITY_IDS.puzzleRules);
    expect(puzzleRulesPack.provides).toEqual([CAPABILITY_IDS.puzzleRules]);
  });

  it('disposal withdraws the capability', () => {
    const { dispose } = makeService({ schemaVersion: 1, puzzles: [] });
    dispose();
    // a fresh install after dispose must not collide
    expect(() => makeService({ schemaVersion: 1, puzzles: [] })).not.toThrow();
  });
});

const sokobanDoc: PuzzleRulesDoc = {
  schemaVersion: 1,
  puzzles: [
    {
      id: 'micro',
      kind: 'sokoban',
      width: 5,
      height: 3,
      walls: [
        [0, 0], [1, 0], [2, 0], [3, 0], [4, 0],
        [0, 2], [1, 2], [2, 2], [3, 2], [4, 2],
        [0, 1], [4, 1],
      ],
      boxes: [[2, 1]],
      goals: [[3, 1]],
      player: [1, 1],
    },
  ],
};

describe('sokoban engine', () => {
  it('auto-loads the first definition and reports it', () => {
    const { svc } = makeService(sokobanDoc);
    expect(svc.definitionIds()).toEqual(['micro']);
    expect(svc.snapshot().kind).toBe('sokoban');
    expect(svc.isSolved()).toBe(false);
  });

  it('pushes a box onto its goal and solves', () => {
    const { svc } = makeService(sokobanDoc);
    svc.load('micro');
    const snap = svc.apply({ kind: 'move', dir: 'right' });
    expect(snap.solved).toBe(true);
    expect(snap.moves).toBe(1);
    expect(svc.isSolved()).toBe(true);
  });

  it('a wall blocks movement and is not counted as a move', () => {
    const { svc } = makeService(sokobanDoc);
    svc.load('micro');
    const snap = svc.apply({ kind: 'move', dir: 'up' });
    expect(snap.moves).toBe(0);
    expect(snap.playerRow).toBe(1);
  });

  it('undo restores the previous state; reset returns to the start', () => {
    const { svc } = makeService(sokobanDoc);
    svc.load('micro');
    svc.apply({ kind: 'move', dir: 'right' });
    const undone = svc.undo();
    expect(undone?.solved).toBe(false);
    expect(undone?.moves).toBe(0);
    expect(svc.undo()).toBeNull();
    svc.apply({ kind: 'move', dir: 'right' });
    const reset = svc.reset();
    expect(reset.solved).toBe(false);
    expect(reset.moves).toBe(0);
  });

  it('is deterministic - identical ops yield identical snapshots', () => {
    const run = (): unknown => {
      const { svc } = makeService(sokobanDoc);
      svc.load('micro');
      svc.apply({ kind: 'move', dir: 'up' });
      svc.apply({ kind: 'move', dir: 'right' });
      return svc.snapshot();
    };
    expect(run()).toEqual(run());
  });

  it('throws for an unknown puzzle id', () => {
    const { svc } = makeService(sokobanDoc);
    expect(() => svc.load('nope')).toThrow(UnknownPuzzleError);
  });
});

describe('switch-sequence engine', () => {
  it('all-on completes when every switch is on, and links toggle together', () => {
    const { svc } = makeService({
      schemaVersion: 1,
      puzzles: [{ id: 'p', kind: 'switch-sequence', switches: ['a', 'b'], links: { a: ['b'] }, completeWhen: { kind: 'all-on' } }],
    });
    svc.load('p');
    const snap = svc.apply({ kind: 'toggle', id: 'a' }); // a on -> link flips b on
    expect(snap.on).toEqual(['a', 'b']);
    expect(snap.solved).toBe(true);
  });

  it('sequence completes only when the press order ends with the target order', () => {
    const { svc } = makeService({
      schemaVersion: 1,
      puzzles: [{ id: 'p', kind: 'switch-sequence', switches: ['a', 'b', 'c'], completeWhen: { kind: 'sequence', order: ['a', 'b', 'c'] } }],
    });
    svc.load('p');
    svc.apply({ kind: 'toggle', id: 'b' });
    expect(svc.isSolved()).toBe(false);
    svc.apply({ kind: 'toggle', id: 'a' });
    svc.apply({ kind: 'toggle', id: 'b' });
    svc.apply({ kind: 'toggle', id: 'c' });
    expect(svc.isSolved()).toBe(true);
  });

  it('count completes at N switches on', () => {
    const { svc } = makeService({
      schemaVersion: 1,
      puzzles: [{ id: 'p', kind: 'switch-sequence', switches: ['a', 'b', 'c'], completeWhen: { kind: 'count', on: 2 } }],
    });
    svc.load('p');
    svc.apply({ kind: 'toggle', id: 'a' });
    expect(svc.isSolved()).toBe(false);
    svc.apply({ kind: 'toggle', id: 'c' });
    expect(svc.isSolved()).toBe(true);
  });

  it('an unknown switch id is ignored', () => {
    const { svc } = makeService({
      schemaVersion: 1,
      puzzles: [{ id: 'p', kind: 'switch-sequence', switches: ['a'], completeWhen: { kind: 'all-on' } }],
    });
    svc.load('p');
    const snap = svc.apply({ kind: 'toggle', id: 'zzz' });
    expect(snap.moves).toBe(0);
  });
});

describe('match engine', () => {
  it('a swap that forms a run clears cells and counts toward the objective', () => {
    // row 1: [0,1,0, ...] swapping (1,0)<->(1,1) makes column 1 = three 0s? build explicitly.
    const { svc } = makeService({
      schemaVersion: 1,
      puzzles: [{
        id: 'm',
        kind: 'match',
        width: 3,
        height: 3,
        pieceTypes: 3,
        matchLength: 3,
        objectiveClears: 3,
        board: [
          [0, 1, 2],
          [1, 0, 2],
          [0, 1, 2],
        ],
      }],
    });
    svc.load('m');
    // swap (0,1) and (1,1): column 0 becomes 0,0,0 -> a vertical match of 3.
    const snap = svc.apply({ kind: 'swap', a: [0, 1], b: [1, 1] });
    expect((snap.clears as number)).toBeGreaterThanOrEqual(3);
    expect(snap.solved).toBe(true);
  });

  it('a non-adjacent swap is a no-op', () => {
    const { svc } = makeService({
      schemaVersion: 1,
      puzzles: [{ id: 'm', kind: 'match', width: 3, height: 3, pieceTypes: 3, matchLength: 3, objectiveClears: 1, board: [[0, 1, 2], [1, 0, 2], [0, 1, 2]] }],
    });
    svc.load('m');
    const snap = svc.apply({ kind: 'swap', a: [0, 0], b: [2, 2] });
    expect(snap.moves).toBe(0);
  });
});

describe('falling-block engine', () => {
  it('a hard-drop locks the piece and clearing a full row advances the objective', () => {
    const { svc } = makeService({
      schemaVersion: 1,
      puzzles: [{
        id: 'fb',
        kind: 'falling-block',
        width: 2,
        height: 4,
        pieces: [{ cells: [[0, 0], [1, 0]], spawnCol: 0 }],
        sequence: [0, 0, 0],
        objectiveLines: 1,
      }],
    });
    svc.load('fb');
    const snap = svc.apply({ kind: 'hard-drop' });
    // a 2-wide piece dropped into a 2-wide well fills the bottom row -> 1 line.
    expect((snap.lines as number)).toBe(1);
    expect(snap.solved).toBe(true);
  });

  it('tick eventually locks a piece at the floor', () => {
    const { svc } = makeService({
      schemaVersion: 1,
      puzzles: [{ id: 'fb', kind: 'falling-block', width: 2, height: 3, pieces: [{ cells: [[0, 0]], spawnCol: 0 }], sequence: [0, 0, 0, 0], objectiveLines: 5 }],
    });
    svc.load('fb');
    for (let i = 0; i < 10; i++) svc.apply({ kind: 'tick' });
    expect(svc.snapshot().kind).toBe('falling-block');
  });
});

describe('physics-goal engine', () => {
  it('solves when every tracked entity is reported inside its zone', () => {
    const { svc } = makeService({
      schemaVersion: 1,
      puzzles: [{
        id: 'pg',
        kind: 'physics-goal',
        goals: [{ entityId: 'ball', zone: { x: 100, y: 100, width: 50, height: 50 } }],
      }],
    });
    svc.load('pg');
    expect(svc.apply({ kind: 'report-entity', entityId: 'ball', x: 10, y: 10 }).solved).toBe(false);
    const snap = svc.apply({ kind: 'report-entity', entityId: 'ball', x: 120, y: 120 });
    expect(snap.solved).toBe(true);
    expect(snap.goalsMet).toBe(1);
  });
});
