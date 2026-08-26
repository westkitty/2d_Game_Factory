import { readShellState } from '../src/snapshot.ts';
import type { Harness } from '../src/harness.ts';
import type { SmokeOutcome } from '../src/smokeRunner.ts';

interface Point {
  readonly x: number;
  readonly y: number;
}

interface ShellSnap {
  readonly state: { readonly player: Point; readonly box: Point };
  readonly solved: boolean;
  readonly visibleComplete: boolean;
  readonly rejectedMoves: number;
}

function state(harness: Harness): Promise<ShellSnap> {
  return readShellState(harness, 'game.grid-shell');
}

function pointsEqual(a: Point, b: Point): boolean {
  return a.x === b.x && a.y === b.y;
}

function statesEqual(a: ShellSnap['state'], b: ShellSnap['state']): boolean {
  return pointsEqual(a.player, b.player) && pointsEqual(a.box, b.box);
}

async function tap(harness: Harness, code: string): Promise<void> {
  await harness.keyTap(code);
  await harness.stepFrames(3);
}

/**
 * Proof D - sokoban (see proofs/sokoban/PROOF_CONTRACT.md).
 *
 * Board: P=(1,1), B=(2,2), G=(3,3), walls on the 5x5 border. Every
 * assertion reads `puzzle.current()`/`isSolved()` through the debug
 * snapshot - there is no second, game-specific state to compare against.
 */
export async function run(harness: Harness): Promise<SmokeOutcome> {
  await harness.keyTap('Space'); // start
  await harness.stepFrames(10);
  const spawnState = await state(harness);

  // Move: ordinary step, no push.
  await tap(harness, 'ArrowRight');
  const afterMove = await state(harness);
  const moveOk = pointsEqual(afterMove.state.player, { x: 2, y: 1 }) && pointsEqual(afterMove.state.box, spawnState.state.box);

  // Legal push: box moves one cell, player follows.
  await tap(harness, 'ArrowDown');
  const afterLegalPush = await state(harness);
  const legalPushOk = pointsEqual(afterLegalPush.state.box, { x: 2, y: 3 }) && pointsEqual(afterLegalPush.state.player, { x: 2, y: 2 });

  // Invalid push: box's next cell is the bottom wall - state must be byte-for-byte unchanged.
  await tap(harness, 'ArrowDown');
  const afterInvalidPush = await state(harness);
  const invalidPushOk = statesEqual(afterInvalidPush.state, afterLegalPush.state) && afterInvalidPush.rejectedMoves === afterLegalPush.rejectedMoves + 1;

  // Additional moves, then a second push onto the goal cell.
  await tap(harness, 'ArrowLeft');
  await tap(harness, 'ArrowDown');
  const beforeSecondPush = await state(harness);
  await tap(harness, 'ArrowRight');
  const afterSecondPush = await state(harness);
  const secondPushOk = pointsEqual(afterSecondPush.state.box, { x: 3, y: 3 }) && afterSecondPush.solved === true && afterSecondPush.visibleComplete === true;

  // Undo: restores the exact state from immediately before the second push.
  await tap(harness, 'Backspace'); // CANCEL
  const afterUndo = await state(harness);
  const undoOk = statesEqual(afterUndo.state, beforeSecondPush.state) && afterUndo.solved === false;

  // Reset: restores the exact initial state, regardless of remaining undo history.
  await tap(harness, 'KeyK'); // SECONDARY_ACTION
  const afterReset = await state(harness);
  const resetOk = statesEqual(afterReset.state, spawnState.state) && afterReset.solved === false;

  // Solve from the freshly reset state.
  await tap(harness, 'ArrowRight');
  await tap(harness, 'ArrowDown');
  await tap(harness, 'ArrowLeft');
  await tap(harness, 'ArrowDown');
  await tap(harness, 'ArrowRight');
  const afterSolve = await state(harness);
  const solveOk = afterSolve.solved === true && afterSolve.visibleComplete === true && pointsEqual(afterSolve.state.box, { x: 3, y: 3 });

  return {
    passed: moveOk && legalPushOk && invalidPushOk && secondPushOk && undoOk && resetOk && solveOk,
    details: {
      spawnState,
      afterMove,
      afterLegalPush,
      afterInvalidPush,
      beforeSecondPush,
      afterSecondPush,
      afterUndo,
      afterReset,
      afterSolve,
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
