import type { Harness } from '../src/harness.ts';
import { pauseResume, restartRun, shellReader, startPlay, waitUntil } from '../src/journey.ts';
import { readSnapshot } from '../src/snapshot.ts';
import type { SmokeOutcome } from '../src/smokeRunner.ts';

interface Stage {
  readonly active: boolean;
  readonly mode: string | null;
  readonly offset: number;
  readonly progress: number;
  readonly playerX: number;
  readonly playerY: number;
  readonly fireX: number;
  readonly fireY: number;
  readonly outcome: string;
}
interface Battle {
  readonly projectilesSpawned: number;
  readonly enemiesAlive: number;
  readonly kills: number;
}
interface Shell {
  readonly stageScroll?: Stage;
  readonly battle?: Battle;
}

export async function run(harness: Harness): Promise<SmokeOutcome> {
  const read = shellReader<Shell>(harness, 'game.top-down-shell');
  const evidence: Record<string, unknown> = {};
  await startPlay(harness);
  const booted = await readSnapshot(harness);
  const initial = await read();
  evidence.initial = initial.stageScroll;
  const startedOk =
    booted.installedPacks.includes('sw2d.stage-scroll') && booted.installedPacks.includes('sw2d.encounters') &&
    initial.stageScroll?.mode === 'horizontal' && initial.stageScroll.fireX === 1 && initial.stageScroll.fireY === 0 && initial.stageScroll.outcome === 'playing';

  // The stage streams past on its own; the ship moves within its band.
  await harness.stepFrames(10);
  const scrolled = (await read()).stageScroll!;
  const scrollOk = scrolled.offset > initial.stageScroll!.offset;
  await harness.keyDown('ArrowDown');
  await harness.stepFrames(20);
  await harness.keyUp('ArrowDown');
  const moved = (await read()).stageScroll!;
  evidence.moved = { playerY: moved.playerY, from: initial.stageScroll!.playerY, offset: moved.offset };
  const moveOk = moved.playerY > initial.stageScroll!.playerY + 8;

  // Firing spawns projectiles along the stage's fire axis (weapons + encounters underneath).
  await harness.keyTap('KeyJ');
  await harness.stepFrames(6);
  const fired = (await read()).battle!;
  evidence.fired = fired;
  const fireOk = fired.projectilesSpawned >= 1;

  // Pause freezes the scroll.
  const beforePause = (await read()).stageScroll!.offset;
  const paused = await pauseResume(harness);
  const afterPause = (await read()).stageScroll!.offset;
  evidence.pause = { ...paused, beforePause, afterPause };
  const pauseOk = paused.pausedDuring && !paused.pausedAfter && afterPause - beforePause < 40;

  // Survive to stage-clear.
  const done = (await waitUntil(harness, read, (s) => s.stageScroll?.outcome === 'complete', 90, 8)).stageScroll!;
  evidence.done = done;
  const doneOk = done.outcome === 'complete' && done.progress >= 1 && done.offset >= 720;

  const run = await restartRun(harness);
  const fresh = (await read()).stageScroll!;
  evidence.restart = { ...run, offset: fresh.offset, outcome: fresh.outcome };
  const restartOk = run.after === run.before + 1 && fresh.outcome === 'playing' && fresh.offset < 200;

  const passed = startedOk && scrollOk && moveOk && fireOk && pauseOk && doneOk && restartOk;
  return { passed, details: { ...evidence, startedOk, scrollOk, moveOk, fireOk, pauseOk, doneOk, restartOk } };
}
