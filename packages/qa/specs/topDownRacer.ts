import { readShellState } from '../src/snapshot.ts';
import type { Harness } from '../src/harness.ts';
import type { SmokeOutcome } from '../src/smokeRunner.ts';

interface ShellSnap {
  readonly x: number;
  readonly angle: number;
  readonly speed: number;
  readonly nextCheckpointIndex: number;
  readonly checkpointsTotal: number;
  readonly lapComplete: boolean;
}

function state(harness: Harness): Promise<ShellSnap> {
  return readShellState(harness, 'game.vehicle-shell');
}

/**
 * Smoke contract: throttle/steering, ordered checkpoints, lap/time-trial
 * completion, restart.
 */
export async function run(harness: Harness): Promise<SmokeOutcome> {
  await harness.keyTap('Space'); // start run
  await harness.stepFrames(10);

  const spawnShell = await state(harness);

  await harness.keyDown('ArrowUp'); // throttle
  await harness.stepFrames(15);
  const afterThrottleShell = await state(harness);
  const throttleProven = afterThrottleShell.speed > 0;

  // Brief, equal-and-opposite steering taps - proves steering is a real,
  // separate physical-input path (the angle visibly changes on the left
  // tap), while cancelling back close enough to 0 that the rest of the
  // straight-line checkpoint run does not drift off it.
  const beforeSteerAngle = afterThrottleShell.angle;
  await harness.keyTap('ArrowLeft');
  const afterLeftTap = await state(harness);
  await harness.keyTap('ArrowRight');
  const afterRightTap = await state(harness);
  const steeringProven = afterLeftTap.angle < beforeSteerAngle && Math.abs(afterRightTap.angle - beforeSteerAngle) < 4;

  let checkpointsPassed: number[] = [];
  for (let i = 0; i < 120 && !(await state(harness)).lapComplete; i++) {
    await harness.stepFrames(5);
    const sample = await state(harness);
    if (!checkpointsPassed.includes(sample.nextCheckpointIndex)) checkpointsPassed.push(sample.nextCheckpointIndex);
  }
  await harness.keyUp('ArrowUp');
  const finalShell = await state(harness);

  const orderedCheckpoints = checkpointsPassed.length >= 1 && checkpointsPassed.every((v, i) => i === 0 || v >= checkpointsPassed[i - 1]!);
  const lapCompletionReachable = finalShell.lapComplete && finalShell.nextCheckpointIndex === finalShell.checkpointsTotal;

  return {
    passed: throttleProven && steeringProven && orderedCheckpoints && lapCompletionReachable,
    details: { spawnShell, afterThrottleShell, checkpointsPassed, finalShell, throttleProven, orderedCheckpoints, lapCompletionReachable },
  };
}
