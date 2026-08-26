import { readSnapshot } from '../src/snapshot.ts';
import type { Harness } from '../src/harness.ts';
import type { SmokeOutcome } from '../src/smokeRunner.ts';

interface PlayerExtra {
  readonly x: number;
}

async function playerX(harness: Harness): Promise<number> {
  const snapshot = await readSnapshot(harness);
  return (snapshot.extra['starter.player'] as PlayerExtra).x;
}

/**
 * Automates the Phase 1-5 foundation-slice journey docs/qa/PHASE1_VALIDATION.md
 * originally described as a manual checklist: boot/title/play, movement
 * input, pause/resume, restart lifecycle. Same-origin/offline is the
 * universal oracle every runSmoke() spec already gets for free
 * (zero external requests).
 */
export async function run(harness: Harness): Promise<SmokeOutcome> {
  const boot = await readSnapshot(harness);
  const bootProven = boot.scene === 'sw2d.title';

  await harness.keyTap('Space'); // CONFIRM -> title to play
  await harness.stepFrames(5);
  const afterStart = await readSnapshot(harness);
  const playProven = afterStart.scene === 'sw2d.play' && afterStart.installedPacks.length > 0 && !afterStart.paused;

  const xBefore = await playerX(harness);
  await harness.keyDown('ArrowRight');
  await harness.stepFrames(20);
  await harness.keyUp('ArrowRight');
  const xAfter = await playerX(harness);
  const movementProven = xAfter > xBefore;

  await harness.keyTap('KeyP'); // PAUSE
  const afterPause = await readSnapshot(harness);
  const pauseProven = afterPause.paused === true && afterPause.scene === 'sw2d.play';

  await harness.keyTap('Space'); // CONFIRM while paused -> resume
  const afterResume = await readSnapshot(harness);
  const resumeProven = afterResume.paused === false;

  await harness.keyTap('KeyP'); // pause again before restarting
  await harness.keyTap('KeyK'); // SECONDARY_ACTION while paused -> restart
  await harness.stepFrames(5);
  const afterRestart = await readSnapshot(harness);
  const restartProven = afterRestart.runIndex === afterStart.runIndex + 1 && afterRestart.paused === false && afterRestart.scene === 'sw2d.play';

  return {
    passed: bootProven && playProven && movementProven && pauseProven && resumeProven && restartProven,
    details: {
      boot,
      afterStart,
      xBefore,
      xAfter,
      afterPause,
      afterResume,
      afterRestart,
      bootProven,
      playProven,
      movementProven,
      pauseProven,
      resumeProven,
      restartProven,
    },
  };
}
