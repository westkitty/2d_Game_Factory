import { readShellState } from '../src/snapshot.ts';
import type { Harness } from '../src/harness.ts';
import type { SmokeOutcome } from '../src/smokeRunner.ts';

interface Cell {
  readonly col: number;
  readonly row: number;
}

interface ShellSnap {
  readonly player: Cell;
  readonly box: Cell;
  readonly solved: boolean;
  readonly rejectedPushes: number;
  readonly historyLength: number;
}

function state(harness: Harness): Promise<ShellSnap> {
  return readShellState(harness, 'game.grid-shell');
}

function sameCell(a: Cell, b: Cell): boolean {
  return a.col === b.col && a.row === b.row;
}

/**
 * Smoke contract: grid movement, box push, invalid push rejection, solved
 * condition, reset, exact undo.
 */
export async function run(harness: Harness): Promise<SmokeOutcome> {
  await harness.keyTap('Space'); // start run
  await harness.stepFrames(10);

  const spawnShell = await state(harness);

  // Grid movement + first push: MOVE_RIGHT pushes the box from (2,1) to (3,1).
  await harness.keyTap('ArrowRight');
  const afterFirstPush = await state(harness);
  const gridMovementProven = afterFirstPush.player.col === spawnShell.player.col + 1;
  const boxPushProven = afterFirstPush.box.col === spawnShell.box.col + 1;

  // Second push: box (3,1) -> (4,1), the goal - proves the solved condition.
  await harness.keyTap('ArrowRight');
  const afterSecondPush = await state(harness);
  const solvedProven = afterSecondPush.solved;

  // Third push attempt: box would need to move into the wall at (5,1) - proves invalid-push rejection.
  await harness.keyTap('ArrowRight');
  const afterRejectedPush = await state(harness);
  const rejectionProven = afterRejectedPush.rejectedPushes > afterSecondPush.rejectedPushes && sameCell(afterRejectedPush.box, afterSecondPush.box) && sameCell(afterRejectedPush.player, afterSecondPush.player);

  // Undo twice - must restore the exact prior states, not just "close".
  await harness.keyTap('Backspace'); // CANCEL -> undo
  const afterUndoOnce = await state(harness);
  const undoRestoresExactPriorState1 = sameCell(afterUndoOnce.player, afterFirstPush.player) && sameCell(afterUndoOnce.box, afterFirstPush.box) && !afterUndoOnce.solved;

  await harness.keyTap('Backspace');
  const afterUndoTwice = await state(harness);
  const undoRestoresExactPriorState2 = sameCell(afterUndoTwice.player, spawnShell.player) && sameCell(afterUndoTwice.box, spawnShell.box);

  // Reset - back to the exact initial state, from any point.
  await harness.keyTap('ArrowRight');
  await harness.keyTap('Space'); // CONFIRM -> reset (this run's binding; see shellPack.ts)
  const afterReset = await state(harness);
  const resetProven = sameCell(afterReset.player, spawnShell.player) && sameCell(afterReset.box, spawnShell.box) && afterReset.historyLength === 0;

  return {
    passed: gridMovementProven && boxPushProven && solvedProven && rejectionProven && undoRestoresExactPriorState1 && undoRestoresExactPriorState2 && resetProven,
    details: {
      spawnShell,
      afterFirstPush,
      afterSecondPush,
      afterRejectedPush,
      afterUndoOnce,
      afterUndoTwice,
      afterReset,
      gridMovementProven,
      boxPushProven,
      solvedProven,
      rejectionProven,
      undoRestoresExactPriorState1,
      undoRestoresExactPriorState2,
      resetProven,
    },
  };
}
