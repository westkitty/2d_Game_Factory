import type { Harness } from '../src/harness.ts';
import { holdUntil, pauseResume, restartRun, shellReader, startPlay } from '../src/journey.ts';
import { readSnapshot } from '../src/snapshot.ts';
import type { SmokeOutcome } from '../src/smokeRunner.ts';

interface Drive {
  readonly active: boolean;
  readonly mode: string | null;
  readonly profile: string | null;
  readonly speed: number;
  readonly score: number;
  readonly lastResult: string | null;
  readonly outcome: string;
}
interface Shell {
  readonly x: number;
  readonly y: number;
  readonly drive?: Drive;
}

export async function run(harness: Harness): Promise<SmokeOutcome> {
  const read = shellReader<Shell>(harness, 'game.vehicle-shell');
  const evidence: Record<string, unknown> = {};
  await startPlay(harness, 12);
  const booted = await readSnapshot(harness);
  const initial = await read();
  evidence.initial = { x: initial.x, drive: initial.drive };
  const startedOk = booted.installedPacks.includes('sw2d.vehicles') && booted.installedPacks.includes('sw2d.generation') && initial.drive?.mode === 'road' && initial.drive.outcome === 'playing' && initial.drive.score < 80;

  // No throttle, no distance.
  await harness.stepFrames(30);
  const idle = await read();
  const idleOk = idle.drive?.score === initial.drive!.score && idle.drive.outcome === 'playing';

  // Throttle builds speed through sw2d.vehicles; distance is the arcade score; pause freezes it.
  await harness.keyDown('ArrowUp');
  await harness.stepFrames(20);
  const moving = await read();
  await harness.keyUp('ArrowUp');
  evidence.moving = moving.drive;
  const movingOk = (moving.drive?.speed ?? 0) > 0 && (moving.drive?.score ?? 0) > initial.drive!.score;
  const paused = await pauseResume(harness);
  const afterPause = await read();
  const pauseOk = paused.pausedDuring && !paused.pausedAfter && (afterPause.drive?.score ?? 0) - (moving.drive?.score ?? 0) < 10;

  const done = await holdUntil(harness, ['ArrowUp'], read, (s) => s.drive?.outcome === 'complete');
  evidence.done = done.drive;
  const doneOk = done.drive?.outcome === 'complete' && done.drive.lastResult === 'distance' && done.drive.score >= 80;

  const run = await restartRun(harness);
  const fresh = await read();
  evidence.restart = { ...run, drive: fresh.drive };
  const restartOk = run.after === run.before + 1 && fresh.drive?.outcome === 'playing' && fresh.drive.score < 80;

  const passed = startedOk && idleOk && movingOk && pauseOk && doneOk && restartOk;
  return { passed, details: { ...evidence, startedOk, idleOk, movingOk, pauseOk, doneOk, restartOk } };
}
