import { readShellState } from '../src/snapshot.ts';
import type { Harness } from '../src/harness.ts';
import type { SmokeOutcome } from '../src/smokeRunner.ts';

interface ShellSnap {
  readonly x: number;
  readonly y: number;
  readonly guardX: number;
  readonly guardState: string;
  readonly alarmed: boolean;
  readonly objectiveReached: boolean;
  readonly reachedUnseen: boolean;
}

function state(harness: Harness): Promise<ShellSnap> {
  return readShellState(harness, 'game.top-down-shell');
}

/**
 * Smoke contract: patrol/guard state, real detection/awareness condition,
 * objective reachable unseen, alarm/fail when detected.
 */
export async function run(harness: Harness): Promise<SmokeOutcome> {
  await harness.keyTap('Space'); // start run
  await harness.stepFrames(10);

  const spawnShell = await state(harness);
  const guardPatrols = spawnShell.guardState === 'patrol';

  // Phase 1: walk straight to the exit, staying on the spawn's y line - the
  // guard patrols far above this line (y~100 vs spawn y~440), so this path
  // never enters the detection radius.
  await harness.keyDown('ArrowRight');
  for (let i = 0; i < 120 && !(await state(harness)).objectiveReached; i++) {
    await harness.stepFrames(5);
  }
  await harness.keyUp('ArrowRight');
  const afterExitShell = await state(harness);
  const objectiveReachedUnseen = afterExitShell.objectiveReached && afterExitShell.reachedUnseen && !afterExitShell.alarmed;

  // Phase 2: walk toward the guard's patrol line deliberately, to prove detection/alarm works.
  await harness.keyDown('ArrowUp');
  await harness.keyDown('ArrowLeft');
  for (let i = 0; i < 80 && !(await state(harness)).alarmed; i++) {
    await harness.stepFrames(5);
  }
  await harness.keyUp('ArrowUp');
  await harness.keyUp('ArrowLeft');
  const finalShell = await state(harness);
  const detectionTriggersAlarm = finalShell.alarmed && finalShell.guardState === 'chase';

  return {
    passed: guardPatrols && objectiveReachedUnseen && detectionTriggersAlarm,
    details: { spawnShell, afterExitShell, finalShell, guardPatrols, objectiveReachedUnseen, detectionTriggersAlarm },
  };
}
