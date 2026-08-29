import { readShellState } from '../src/snapshot.ts';
import type { Harness } from '../src/harness.ts';
import type { SmokeOutcome } from '../src/smokeRunner.ts';

interface ShellSnap {
  readonly puzzle: {
    readonly kind: string;
    readonly solved: boolean;
    readonly moves: number;
    readonly on: readonly string[];
    readonly pressOrder: readonly string[];
    readonly switches: readonly string[];
  };
  readonly solved: boolean;
  readonly playerX: number;
  readonly overlapping: string | null;
  readonly toggles: number;
}

function state(harness: Harness): Promise<ShellSnap> {
  return readShellState(harness, 'game.platform-shell');
}

/** Walk (either direction) until the player overlaps the named switch zone, then stop. */
async function walkTo(harness: Harness, switchId: string): Promise<boolean> {
  for (let i = 0; i < 120; i++) {
    const s = await state(harness);
    if (s.overlapping === switchId) {
      await harness.keyUp('ArrowRight');
      await harness.keyUp('ArrowLeft');
      await harness.stepFrames(2);
      return true;
    }
    // Zone centres: a≈225, b≈465, c≈705. Steer toward the target.
    const target = switchId === 'a' ? 225 : switchId === 'b' ? 465 : 705;
    if (s.playerX < target) {
      await harness.keyUp('ArrowLeft');
      await harness.keyDown('ArrowRight');
    } else {
      await harness.keyUp('ArrowRight');
      await harness.keyDown('ArrowLeft');
    }
    await harness.stepFrames(3);
  }
  await harness.keyUp('ArrowRight');
  await harness.keyUp('ArrowLeft');
  return false;
}

async function toggle(harness: Harness): Promise<void> {
  await harness.keyTap('KeyE'); // INTERACT
  await harness.stepFrames(3);
}

/**
 * Proof - puzzle-platformer (see proofs/puzzle-platformer/PROOF_CONTRACT.md).
 *
 * The switch/goal puzzle - switch set, the `a`->`d` link, and the
 * "press order must end a,b,c" completion rule - is entirely
 * content/puzzles.json, resolved by the reusable sw2d.puzzle-rules service.
 * Every assertion reads puzzle.snapshot()/isSolved() through the debug
 * snapshot; the shell keeps no puzzle state.
 */
export async function run(harness: Harness): Promise<SmokeOutcome> {
  await harness.keyTap('Space'); // start
  await harness.stepFrames(12);

  const initial = await state(harness);
  const initialOk =
    initial.puzzle.kind === 'switch-sequence' &&
    initial.puzzle.switches.length === 4 &&
    initial.puzzle.on.length === 0 &&
    !initial.solved;

  // Press B first - deliberately out of order.
  const reachedB1 = await walkTo(harness, 'b');
  await toggle(harness);
  const afterB1 = await state(harness);
  const bFirstOk = reachedB1 && afterB1.puzzle.on.includes('b') && !afterB1.solved;

  // Press A - its link also switches on the decoy D, which is not in the sequence.
  const reachedA = await walkTo(harness, 'a');
  await toggle(harness);
  const afterA = await state(harness);
  const linkOk = reachedA && afterA.puzzle.on.includes('a') && afterA.puzzle.on.includes('d') && !afterA.solved;

  // Press B then C: the press order now ends a,b,c -> solved, despite the stray first B.
  const reachedB2 = await walkTo(harness, 'b');
  await toggle(harness);
  const reachedC = await walkTo(harness, 'c');
  await toggle(harness);
  const afterC = await state(harness);
  const solveOk = reachedB2 && reachedC && afterC.solved === true && afterC.puzzle.pressOrder.slice(-3).join(',') === 'a,b,c';

  // Undo the last toggle: no longer solved.
  await harness.keyTap('Backspace'); // CANCEL
  await harness.stepFrames(3);
  const afterUndo = await state(harness);
  const undoOk = afterUndo.solved === false && afterUndo.puzzle.pressOrder.length === afterC.puzzle.pressOrder.length - 1;

  // Reset: press order and on-set both cleared.
  await harness.keyTap('KeyK'); // SECONDARY_ACTION
  await harness.stepFrames(3);
  const afterReset = await state(harness);
  const resetOk = afterReset.puzzle.pressOrder.length === 0 && afterReset.puzzle.on.length === 0 && !afterReset.solved;

  // Re-solve cleanly, in order.
  await walkTo(harness, 'a');
  await toggle(harness);
  await walkTo(harness, 'b');
  await toggle(harness);
  await walkTo(harness, 'c');
  await toggle(harness);
  const afterResolve = await state(harness);
  const resolveOk = afterResolve.solved === true;

  const passed = initialOk && bFirstOk && linkOk && solveOk && undoOk && resetOk && resolveOk;
  return {
    passed,
    details: {
      initial,
      afterB1,
      afterA,
      afterC,
      afterUndo,
      afterReset,
      afterResolve,
      initialOk,
      bFirstOk,
      linkOk,
      solveOk,
      undoOk,
      resetOk,
      resolveOk,
    },
  };
}
