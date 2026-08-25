import { describe, expect, it } from 'vitest';
import type { GameContext, InstalledSystemPack } from '@sw2d/contracts';
import type { PuzzleConfig, PuzzleService } from '../src/puzzle/puzzlePack.ts';
import { puzzlePack } from '../src/puzzle/puzzlePack.ts';
import { createFakeGameContext } from './testSupport.ts';

interface SlideState {
  readonly position: number;
}

function slideConfig(goal: number): PuzzleConfig<SlideState> {
  return {
    createInitialState: () => ({ position: 0 }),
    isSolved: (state) => state.position === goal,
  };
}

/**
 * `puzzlePack`'s declared type erases `TState` to `unknown` (see
 * puzzlePack.ts: one pack value cannot be generic over the caller's state
 * type). The implementation is genuinely state-agnostic, so this widening
 * cast is safe - it only affects what the *type checker* sees at the call
 * boundary, not runtime behaviour.
 */
function installPuzzle<TState>(context: GameContext, config: PuzzleConfig<TState>): InstalledSystemPack {
  return puzzlePack.install(context, config as PuzzleConfig);
}

describe('puzzlePack', () => {
  it('installs and publishes the puzzle capability with the initial state', () => {
    const context = createFakeGameContext();
    const installed = installPuzzle(context, slideConfig(3));
    const puzzle = context.capabilities.require<PuzzleService<SlideState>>('puzzle');

    expect(puzzle.current()).toEqual({ position: 0 });
    expect(installed.id).toBe('sw2d.puzzle');
  });

  it('apply() mutates through an explicit operation and isSolved() reflects the goal predicate', () => {
    const context = createFakeGameContext();
    installPuzzle(context, slideConfig(2));
    const puzzle = context.capabilities.require<PuzzleService<SlideState>>('puzzle');

    expect(puzzle.isSolved()).toBe(false);
    puzzle.apply((state) => ({ position: state.position + 1 }));
    expect(puzzle.isSolved()).toBe(false);
    puzzle.apply((state) => ({ position: state.position + 1 }));
    expect(puzzle.current()).toEqual({ position: 2 });
    expect(puzzle.isSolved()).toBe(true);
  });

  it('undo() restores the exact prior state, and returns null with nothing to undo', () => {
    const context = createFakeGameContext();
    installPuzzle(context, slideConfig(5));
    const puzzle = context.capabilities.require<PuzzleService<SlideState>>('puzzle');

    expect(puzzle.undo()).toBeNull();

    puzzle.apply((state) => ({ position: state.position + 1 }));
    puzzle.apply((state) => ({ position: state.position + 10 }));
    expect(puzzle.current()).toEqual({ position: 11 });

    expect(puzzle.undo()).toEqual({ position: 1 });
    expect(puzzle.current()).toEqual({ position: 1 });
    expect(puzzle.undo()).toEqual({ position: 0 });
    expect(puzzle.undo()).toBeNull();
  });

  it('reset() regenerates the initial state and clears history', () => {
    const context = createFakeGameContext();
    installPuzzle(context, slideConfig(5));
    const puzzle = context.capabilities.require<PuzzleService<SlideState>>('puzzle');
    puzzle.apply((state) => ({ position: state.position + 4 }));

    expect(puzzle.reset()).toEqual({ position: 0 });
    expect(puzzle.undo()).toBeNull(); // history was cleared, not just the state
  });

  it('is deterministic: the same operation sequence produces the same state', () => {
    const contextA = createFakeGameContext();
    const contextB = createFakeGameContext();
    installPuzzle(contextA, slideConfig(5));
    installPuzzle(contextB, slideConfig(5));
    const a = contextA.capabilities.require<PuzzleService<SlideState>>('puzzle');
    const b = contextB.capabilities.require<PuzzleService<SlideState>>('puzzle');

    const ops = [(s: SlideState) => ({ position: s.position + 2 }), (s: SlideState) => ({ position: s.position * 3 })];
    for (const op of ops) {
      a.apply(op);
      b.apply(op);
    }

    expect(a.current()).toEqual(b.current());
  });

  it('withdraws the capability on dispose', () => {
    const context = createFakeGameContext();
    const installed = installPuzzle(context, slideConfig(5));

    installed.dispose();

    expect(context.capabilities.has('puzzle')).toBe(false);
  });
});
