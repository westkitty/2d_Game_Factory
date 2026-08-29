import { readShellState, readSnapshot } from '../src/snapshot.ts';
import type { Harness } from '../src/harness.ts';
import type { SmokeOutcome } from '../src/smokeRunner.ts';

interface ShellSnap {
  readonly generatorId: string;
  readonly seed: number;
  readonly kind: string;
  readonly roomCount: number;
  readonly hasStartNode: boolean;
  readonly hasExitObject: boolean;
  readonly enemyCount: number;
  readonly edgesValid: boolean;
  readonly startToExitReachable: boolean;
  readonly valid: boolean;
  readonly errors: readonly string[];
  readonly travelled: number;
  readonly regenMatchesInitial: boolean | null;
  readonly altDiffers: boolean | null;
  readonly altValid: boolean | null;
}

const state = (h: Harness): Promise<ShellSnap> => readShellState(h, 'game.top-down-shell');

async function hold(h: Harness, code: string, frames: number): Promise<void> {
  await h.keyDown(code);
  await h.stepFrames(frames);
  await h.keyUp(code);
  await h.stepFrames(2);
}

/**
 * Proof - dungeon-crawler (see proofs/dungeon-crawler/PROOF_CONTRACT.md).
 *
 * The dungeon is a deterministic seeded room graph from the reusable
 * sw2d.generation room-graph generator - a connected graph with a start
 * node, an exit, valid edges, and start->exit reachability, reproducible
 * across a real scene reinstall.
 */
export async function run(harness: Harness): Promise<SmokeOutcome> {
  await harness.keyTap('Space');
  await harness.stepFrames(12);

  const initial = await state(harness);
  const startedOk =
    initial.kind === 'room-graph' &&
    initial.valid === true &&
    initial.hasStartNode === true &&
    initial.hasExitObject === true &&
    initial.edgesValid === true &&
    initial.startToExitReachable === true &&
    initial.roomCount >= 4 &&
    initial.errors.length === 0;
  const referenceRooms = initial.roomCount;

  // Move through the generated rooms (wall collision keeps it honest).
  await hold(harness, 'ArrowRight', 40);
  await hold(harness, 'ArrowDown', 40);
  const moved = await state(harness);
  const traverseOk = moved.travelled > 40;

  await harness.keyTap('KeyE'); // INTERACT
  await harness.stepFrames(3);
  const afterRegen = await state(harness);
  const regenOk = afterRegen.regenMatchesInitial === true;

  await harness.keyTap('KeyK'); // SECONDARY_ACTION
  await harness.stepFrames(3);
  const afterAlt = await state(harness);
  const altOk = afterAlt.altDiffers === true && afterAlt.altValid === true;

  await harness.keyTap('KeyP');
  await harness.stepFrames(4);
  await harness.keyTap('KeyK');
  await harness.stepFrames(14);
  const restarted = await readSnapshot(harness);
  const afterRestart = await state(harness);
  const restartOk =
    restarted.scene === 'sw2d.play' &&
    afterRestart.roomCount === referenceRooms &&
    afterRestart.startToExitReachable === true &&
    afterRestart.valid === true;

  const passed = startedOk && traverseOk && regenOk && altOk && restartOk;
  return {
    passed,
    details: { initial, moved, afterRegen, afterAlt, afterRestart, startedOk, traverseOk, regenOk, altOk, restartOk },
  };
}
