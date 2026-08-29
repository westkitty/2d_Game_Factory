import { readShellState, readSnapshot } from '../src/snapshot.ts';
import type { Harness } from '../src/harness.ts';
import type { SmokeOutcome } from '../src/smokeRunner.ts';

interface ShellSnap {
  readonly mode: string;
  readonly phase: string;
  readonly countdownRemainingMs: number;
  readonly elapsedMs: number;
  readonly expectedCheckpoint: string | null;
  readonly finished: boolean;
  readonly lapCount: number;
  readonly bestTotalMs: number | null;
  readonly bestLapMs: number | null;
  readonly lastShortcutCounted: boolean | null;
  readonly autopilotThrottle: number;
}

const state = (h: Harness): Promise<ShellSnap> => readShellState(h, 'game.vehicle-shell');

async function runLap(h: Harness, cap = 400): Promise<ShellSnap> {
  let s = await state(h);
  for (let i = 0; i < cap && !s.finished; i++) {
    await h.stepFrames(8);
    s = await state(h);
  }
  return s;
}

/**
 * Proof - time-trial-racer (see proofs/time-trial-racer/PROOF_CONTRACT.md).
 *
 * The same reusable vehicle + race services in time-trial mode: a countdown, a
 * live elapsed timer, an invalid-shortcut rejection, a finish, a restart that
 * resets the attempt, and a second faster attempt that updates the persisted
 * best time.
 */
export async function run(harness: Harness): Promise<SmokeOutcome> {
  await harness.keyTap('Space'); // title -> play
  await harness.stepFrames(6);

  // Slow autopilot for the first attempt.
  await harness.keyDown('KeyE'); // INTERACT held
  await harness.keyTap('Enter'); // CONFIRM -> start
  await harness.stepFrames(4);
  const started = await state(harness);
  const startedOk = started.mode === 'time-trial' && started.phase === 'countdown';

  await harness.stepFrames(110); // 1.5s countdown
  const t1 = await state(harness);
  await harness.stepFrames(30);
  const t2 = await state(harness);
  const timerOk = t1.phase === 'racing' && t2.elapsedMs > t1.elapsedMs;

  // Invalid shortcut - not registered.
  await harness.keyTap('KeyK'); // SECONDARY_ACTION
  await harness.stepFrames(4);
  const afterShortcut = await state(harness);
  const shortcutOk = afterShortcut.lastShortcutCounted === false && afterShortcut.finished === false;

  const slow = await runLap(harness);
  await harness.keyUp('KeyE');
  const firstOk = slow.finished === true && slow.lapCount === 1 && slow.bestTotalMs !== null;
  const firstBest = slow.bestTotalMs ?? Number.MAX_SAFE_INTEGER;

  // Restart the attempt.
  await harness.keyTap('KeyJ'); // PRIMARY_ACTION (KeyJ per default bindings)
  await harness.stepFrames(4);
  const afterRestart = await state(harness);
  const restartOk = afterRestart.phase === 'idle' && afterRestart.elapsedMs === 0 && afterRestart.finished === false && afterRestart.bestTotalMs !== null;

  // Second attempt at full speed - a better time.
  await harness.keyTap('Enter'); // CONFIRM -> start again
  await harness.stepFrames(4);
  await harness.stepFrames(110);
  const fast = await runLap(harness);
  const betterOk = fast.finished === true && (fast.bestTotalMs ?? Number.MAX_SAFE_INTEGER) < firstBest;

  const passed = startedOk && timerOk && shortcutOk && firstOk && restartOk && betterOk;
  return {
    passed,
    details: { started, t1, t2, afterShortcut, slow, afterRestart, fast, firstBest, startedOk, timerOk, shortcutOk, firstOk, restartOk, betterOk },
  };
}
