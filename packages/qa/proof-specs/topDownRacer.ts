import { readShellState, readSnapshot } from '../src/snapshot.ts';
import type { Harness } from '../src/harness.ts';
import type { SmokeOutcome } from '../src/smokeRunner.ts';

interface ShellSnap {
  readonly vehicleProfile: string;
  readonly speed: number;
  readonly maxSpeed: number;
  readonly heading: number;
  readonly phase: string;
  readonly currentLap: number;
  readonly expectedCheckpoint: string | null;
  readonly finished: boolean;
  readonly lapCount: number;
  readonly elapsedMs: number;
  readonly lastShortcutCounted: boolean | null;
  readonly shortcutAttempts: number;
}

const state = (h: Harness): Promise<ShellSnap> => readShellState(h, 'game.vehicle-shell');

/**
 * Proof - top-down-racer (see proofs/top-down-racer/PROOF_CONTRACT.md).
 *
 * The car is the reusable sw2d.vehicles service; the race is the reusable
 * sw2d.racing service - four ordered checkpoints, two laps, a countdown. A
 * skipped-checkpoint shortcut never advances a lap; two valid laps finish;
 * restart clears all race state.
 */
export async function run(harness: Harness): Promise<SmokeOutcome> {
  await harness.keyTap('Space'); // title -> play
  await harness.stepFrames(6);
  await harness.keyTap('Enter'); // CONFIRM -> startRace
  await harness.stepFrames(4);

  const started = await state(harness);
  const startedOk = started.phase === 'countdown' && started.currentLap === 1;

  // Run out the countdown.
  await harness.stepFrames(190);
  const racing = await state(harness);
  const countdownOk = racing.phase === 'racing' && racing.expectedCheckpoint === 'cp-1';

  // Drive a bit; the car accelerates and steers.
  await harness.stepFrames(120);
  const moving = await state(harness);
  const movingOk = moving.maxSpeed > 100 && Math.abs(moving.heading) > 0;

  // Deliberate shortcut: the last checkpoint, out of order.
  const beforeShortcut = await state(harness);
  await harness.keyTap('KeyK'); // SECONDARY_ACTION
  await harness.stepFrames(4);
  const afterShortcut = await state(harness);
  const shortcutOk =
    afterShortcut.lastShortcutCounted === false &&
    afterShortcut.currentLap === beforeShortcut.currentLap &&
    afterShortcut.lapCount === beforeShortcut.lapCount;

  // Let the autopilot run the two laps.
  let cur = afterShortcut;
  for (let i = 0; i < 320 && !cur.finished; i++) {
    await harness.stepFrames(8);
    cur = await state(harness);
  }
  const finishOk = cur.finished === true && cur.lapCount === 2 && cur.phase === 'finished' && cur.expectedCheckpoint === null;

  // Restart -> a fresh race, no stale state.
  await harness.keyTap('KeyP');
  await harness.stepFrames(4);
  await harness.keyTap('KeyK');
  await harness.stepFrames(16);
  const restarted = await readSnapshot(harness);
  const afterRestart = await state(harness);
  const restartOk =
    restarted.scene === 'sw2d.play' && afterRestart.finished === false && afterRestart.lapCount === 0 && afterRestart.phase !== 'finished';

  const passed = startedOk && countdownOk && movingOk && shortcutOk && finishOk && restartOk;
  return {
    passed,
    details: { started, racing, moving, afterShortcut, finished: cur, afterRestart, startedOk, countdownOk, movingOk, shortcutOk, finishOk, restartOk },
  };
}
