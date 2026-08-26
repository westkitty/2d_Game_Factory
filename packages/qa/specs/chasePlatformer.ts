import { readShellState } from '../src/snapshot.ts';
import type { Harness } from '../src/harness.ts';
import type { SmokeOutcome } from '../src/smokeRunner.ts';

interface ShellSnap {
  readonly x: number;
  readonly chasePressure: number;
  readonly outcome: string;
}

function state(harness: Harness): Promise<ShellSnap> {
  return readShellState(harness, 'game.platform-shell');
}

/**
 * Smoke contract: platform movement, real chase-pressure state advancing
 * during play, pressure paused during pause/noninteractive state, reachable
 * finish/fail.
 */
export async function run(harness: Harness): Promise<SmokeOutcome> {
  await harness.keyTap('Space'); // start run
  await harness.stepFrames(30);

  const beforeAdvance = await state(harness);
  await harness.stepFrames(60);
  const afterAdvance = await state(harness);
  const pressureAdvances = afterAdvance.chasePressure > beforeAdvance.chasePressure;

  await harness.keyTap('KeyP'); // PAUSE
  const pausedFirst = await state(harness);
  await harness.stepFrames(120); // a paused scene's update() never runs - see shellPack.ts's own comment
  const pausedSecond = await state(harness);
  const pressurePausesWhilePaused = pausedSecond.chasePressure === pausedFirst.chasePressure;

  await harness.keyTap('Space'); // CONFIRM -> resume
  await harness.stepFrames(30);
  const afterResume = await state(harness);
  const pressureResumesAfterUnpause = afterResume.chasePressure > pausedSecond.chasePressure;

  // Reachable finish: walk to the exit at the far right of the level.
  await harness.keyDown('ArrowRight');
  await harness.stepFrames(280);
  await harness.keyUp('ArrowRight');
  const finalState = await state(harness);
  const finishReachable = finalState.outcome === 'escaped';

  return {
    passed: pressureAdvances && pressurePausesWhilePaused && pressureResumesAfterUnpause && finishReachable,
    details: {
      beforeAdvance,
      afterAdvance,
      pausedFirst,
      pausedSecond,
      afterResume,
      finalState,
      pressureAdvances,
      pressurePausesWhilePaused,
      pressureResumesAfterUnpause,
      finishReachable,
    },
  };
}
