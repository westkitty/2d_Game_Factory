import type { Harness } from '../src/harness.ts';
import { pauseResume, restartRun, shellReader, startPlay, waitUntil } from '../src/journey.ts';
import { readSnapshot } from '../src/snapshot.ts';
import type { SmokeOutcome } from '../src/smokeRunner.ts';

interface Run {
  readonly active: boolean;
  readonly mode: string | null;
  readonly x: number;
  readonly onGround: boolean;
  readonly score: number;
  readonly jumps: number;
  readonly lastResult: string | null;
  readonly outcome: string;
}
interface Shell {
  readonly x: number;
  readonly y: number;
  readonly run?: Run;
}

export async function run(harness: Harness): Promise<SmokeOutcome> {
  const read = shellReader<Shell>(harness, 'game.platform-shell');
  const evidence: Record<string, unknown> = {};
  await startPlay(harness, 12);
  const booted = await readSnapshot(harness);
  const initial = await read();
  evidence.initial = { x: initial.x, run: initial.run };
  const startedOk = booted.installedPacks.includes('sw2d.generation') && initial.run?.mode === 'course' && initial.run.outcome === 'playing' && initial.run.jumps === 0 && initial.x > 90 && initial.x < 220;

  // The runner moves on its own; pause freezes it.
  await harness.stepFrames(6);
  const auto = await read();
  const autoOk = auto.x > initial.x;
  const paused = await pauseResume(harness);
  const afterPause = await read();
  const pauseOk = paused.pausedDuring && !paused.pausedAfter && afterPause.x - auto.x < 40;

  // Doing nothing at the gap fails the course.
  const fell = await waitUntil(harness, read, (s) => s.run?.outcome !== 'playing', 120, 4);
  evidence.fell = { x: fell.x, run: fell.run };
  const fellOk = fell.run?.outcome === 'failed' && fell.run.jumps === 0;

  // Restart; jump the gap at the right moment and finish the course.
  const run = await restartRun(harness);
  const fresh = await read();
  const restartOk = run.after === run.before + 1 && fresh.run?.outcome === 'playing' && fresh.run.jumps === 0;
  const before = await waitUntil(harness, read, (s) => (s.run?.x ?? s.x) >= 200, 120, 4);
  await harness.keyTap('Space');
  await harness.stepFrames(8);
  const jumped = await read();
  const done = await waitUntil(harness, read, (s) => s.run?.outcome !== 'playing', 120, 4);
  evidence.done = { beforeX: before.run?.x, jumped: jumped.run, done: done.run };
  const doneOk = jumped.run?.jumps === 1 && jumped.run.lastResult === 'jump' && done.run?.outcome === 'complete' && done.run.lastResult === 'finished' && done.run.x >= 820;

  const passed = startedOk && autoOk && pauseOk && fellOk && restartOk && doneOk;
  return { passed, details: { ...evidence, startedOk, autoOk, pauseOk, fellOk, restartOk, doneOk } };
}
