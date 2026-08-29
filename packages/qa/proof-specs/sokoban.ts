import { readShellState } from '../src/snapshot.ts';
import type { Harness } from '../src/harness.ts';
import type { SmokeOutcome } from '../src/smokeRunner.ts';

type Cell = readonly [number, number];

interface SokobanSnap {
  readonly snapshot: {
    readonly kind: string;
    readonly solved: boolean;
    readonly moves: number;
    readonly playerCol: number;
    readonly playerRow: number;
    readonly boxes: readonly Cell[];
    readonly goals: readonly Cell[];
    readonly boxesOnGoals: number;
    readonly goalCount: number;
  };
  readonly solved: boolean;
  readonly rejectedMoves: number;
}

function state(harness: Harness): Promise<SokobanSnap> {
  return readShellState(harness, 'game.grid-shell');
}

const cellEq = (a: Cell | undefined, b: Cell): boolean => a !== undefined && a[0] === b[0] && a[1] === b[1];

function boardEq(a: SokobanSnap, b: SokobanSnap): boolean {
  return (
    a.snapshot.playerCol === b.snapshot.playerCol &&
    a.snapshot.playerRow === b.snapshot.playerRow &&
    a.snapshot.boxes.length === b.snapshot.boxes.length &&
    a.snapshot.boxes.every((box, i) => cellEq(box, b.snapshot.boxes[i]!))
  );
}

async function tap(harness: Harness, code: string): Promise<void> {
  await harness.keyTap(code);
  await harness.stepFrames(3);
}

/**
 * Proof D - sokoban (see proofs/sokoban/PROOF_CONTRACT.md).
 *
 * Board: P=(1,1), B=(2,2), G=(3,3), walls on the 5x5 border - ALL of it
 * serialized in content/puzzles.json, resolved by the reusable
 * sw2d.puzzle-rules service. Every assertion reads puzzle.snapshot() /
 * isSolved() through the debug snapshot; the shell keeps no second state.
 */
export async function run(harness: Harness): Promise<SmokeOutcome> {
  await harness.keyTap('Space'); // start
  await harness.stepFrames(10);
  const spawn = await state(harness);
  const spawnOk =
    spawn.snapshot.kind === 'sokoban' &&
    spawn.snapshot.playerCol === 1 &&
    spawn.snapshot.playerRow === 1 &&
    cellEq(spawn.snapshot.boxes[0], [2, 2]) &&
    cellEq(spawn.snapshot.goals[0], [3, 3]) &&
    !spawn.solved;

  // Move: ordinary step, no push.
  await tap(harness, 'ArrowRight');
  const afterMove = await state(harness);
  const moveOk =
    afterMove.snapshot.playerCol === 2 &&
    afterMove.snapshot.playerRow === 1 &&
    cellEq(afterMove.snapshot.boxes[0], [2, 2]) &&
    afterMove.snapshot.moves === 1;

  // Legal push: box moves one cell, player follows.
  await tap(harness, 'ArrowDown');
  const afterLegalPush = await state(harness);
  const legalPushOk =
    cellEq(afterLegalPush.snapshot.boxes[0], [2, 3]) &&
    afterLegalPush.snapshot.playerCol === 2 &&
    afterLegalPush.snapshot.playerRow === 2;

  // Invalid push: box's next cell is the bottom wall - state unchanged, no history entry, rejected count up.
  await tap(harness, 'ArrowDown');
  const afterInvalidPush = await state(harness);
  const invalidPushOk =
    boardEq(afterInvalidPush, afterLegalPush) &&
    afterInvalidPush.snapshot.moves === afterLegalPush.snapshot.moves &&
    afterInvalidPush.rejectedMoves === afterLegalPush.rejectedMoves + 1;

  // Reposition, then a second push onto the goal cell.
  await tap(harness, 'ArrowLeft');
  await tap(harness, 'ArrowDown');
  const beforeSecondPush = await state(harness);
  await tap(harness, 'ArrowRight');
  const afterSecondPush = await state(harness);
  const secondPushOk =
    cellEq(afterSecondPush.snapshot.boxes[0], [3, 3]) &&
    afterSecondPush.solved === true &&
    afterSecondPush.snapshot.boxesOnGoals === afterSecondPush.snapshot.goalCount;

  // Undo: restores the exact state from immediately before the second push.
  await tap(harness, 'Backspace'); // CANCEL
  const afterUndo = await state(harness);
  const undoOk = boardEq(afterUndo, beforeSecondPush) && afterUndo.solved === false;

  // Reset: restores the exact initial state, regardless of remaining undo history.
  await tap(harness, 'KeyK'); // SECONDARY_ACTION
  const afterReset = await state(harness);
  const resetOk = boardEq(afterReset, spawn) && afterReset.solved === false && afterReset.snapshot.moves === 0;

  // Solve from the freshly reset state.
  await tap(harness, 'ArrowRight');
  await tap(harness, 'ArrowDown');
  await tap(harness, 'ArrowLeft');
  await tap(harness, 'ArrowDown');
  await tap(harness, 'ArrowRight');
  const afterSolve = await state(harness);
  const solveOk = afterSolve.solved === true && cellEq(afterSolve.snapshot.boxes[0], [3, 3]);

  return {
    passed: spawnOk && moveOk && legalPushOk && invalidPushOk && secondPushOk && undoOk && resetOk && solveOk,
    details: {
      spawn,
      afterMove,
      afterLegalPush,
      afterInvalidPush,
      beforeSecondPush,
      afterSecondPush,
      afterUndo,
      afterReset,
      afterSolve,
      spawnOk,
      moveOk,
      legalPushOk,
      invalidPushOk,
      secondPushOk,
      undoOk,
      resetOk,
      solveOk,
    },
  };
}
