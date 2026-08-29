import { readShellState, readSnapshot } from '../src/snapshot.ts';
import type { Harness } from '../src/harness.ts';
import type { SmokeOutcome } from '../src/smokeRunner.ts';

interface ShellSnap {
  readonly generatorId: string;
  readonly seed: number;
  readonly kind: string;
  readonly chosenTemplates: readonly string[];
  readonly segmentCount: number;
  readonly valid: boolean;
  readonly errors: readonly string[];
  readonly playerX: number;
  readonly progressedX: number;
  readonly spawnPlaced: boolean;
  readonly solidCount: number;
  readonly regenMatchesInitial: boolean | null;
  readonly altDiffers: boolean | null;
  readonly altValid: boolean | null;
}

const state = (h: Harness): Promise<ShellSnap> => readShellState(h, 'game.platform-shell');

async function hold(h: Harness, code: string, frames: number): Promise<void> {
  await h.keyDown(code);
  await h.stepFrames(frames);
  await h.keyUp(code);
  await h.stepFrames(2);
}

/**
 * Proof - endless-runner (see proofs/endless-runner/PROOF_CONTRACT.md).
 *
 * The level is a deterministic seeded segment chain from the reusable
 * sw2d.generation capability. Same seed reproduces the exact template
 * sequence in-run and across a real scene reinstall.
 */
export async function run(harness: Harness): Promise<SmokeOutcome> {
  await harness.keyTap('Space');
  await harness.stepFrames(12);

  const initial = await state(harness);
  const startedOk =
    initial.kind === 'segment-chain' &&
    initial.valid === true &&
    initial.spawnPlaced === true &&
    initial.segmentCount === 10 &&
    initial.chosenTemplates[0] === 'start-flat' &&
    initial.errors.length === 0;
  const reference = initial.chosenTemplates.join(',');

  // Traverse generated ground.
  await hold(harness, 'ArrowRight', 90);
  const moved = await state(harness);
  const traverseOk = moved.progressedX > 200;

  // Same-seed reproducibility, in run.
  await harness.keyTap('KeyE'); // INTERACT
  await harness.stepFrames(3);
  const afterRegen = await state(harness);
  const regenOk = afterRegen.regenMatchesInitial === true;

  // Different seed diverges but stays valid.
  await harness.keyTap('KeyK'); // SECONDARY_ACTION
  await harness.stepFrames(3);
  const afterAlt = await state(harness);
  const altOk = afterAlt.altDiffers === true && afterAlt.altValid === true;

  // Restart -> deterministic across a real reinstall.
  await harness.keyTap('KeyP');
  await harness.stepFrames(4);
  await harness.keyTap('KeyK');
  await harness.stepFrames(14);
  const restarted = await readSnapshot(harness);
  const afterRestart = await state(harness);
  const restartOk =
    restarted.scene === 'sw2d.play' &&
    afterRestart.chosenTemplates.join(',') === reference &&
    afterRestart.valid === true;

  const passed = startedOk && traverseOk && regenOk && altOk && restartOk;
  return {
    passed,
    details: { initial, moved, afterRegen, afterAlt, afterRestart, startedOk, traverseOk, regenOk, altOk, restartOk },
  };
}
