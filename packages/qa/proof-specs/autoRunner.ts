import type { Harness } from '../src/harness.ts';
import { pauseResume, restartRun, shellReader, startPlay, waitUntil } from '../src/journey.ts';
import { readSnapshot } from '../src/snapshot.ts';
import type { SmokeOutcome } from '../src/smokeRunner.ts';

/**
 * auto-runner defining journey. Category-C Wave 22 auto-run course plus the
 * Final Product Completion program's runner pressure (matrix L02): the
 * reusable sw2d.pursuit chaser trails the runner and closes while it trips
 * on the authored blocks.
 */

interface Run {
  readonly active: boolean;
  readonly mode: string | null;
  readonly x: number;
  readonly onGround: boolean;
  readonly score: number;
  readonly jumps: number;
  readonly stumbles: number;
  readonly stumbling: boolean;
  readonly chaserX: number;
  readonly gap: number;
  readonly hazardsLeft: number;
  readonly lastResult: string | null;
  readonly outcome: string;
}
interface Shell {
  readonly x: number;
  readonly y: number;
  readonly run?: Run;
}

async function jumpAt(harness: Harness, read: () => Promise<Shell>, x: number): Promise<Shell> {
  const before = await waitUntil(harness, read, (s) => (s.x >= x && s.onGround) || s.run?.outcome !== 'playing', 200, 2);
  if (before.run?.outcome === 'playing') await harness.keyTap('Space');
  return before;
}

export async function run(harness: Harness): Promise<SmokeOutcome> {
  const read = shellReader<Shell>(harness, 'game.platform-shell');
  const evidence: Record<string, unknown> = {};
  await startPlay(harness, 12);
  const booted = await readSnapshot(harness);
  const initial = await read();
  evidence.initial = { x: initial.x, run: initial.run };
  const startedOk =
    booted.installedPacks.includes('sw2d.generation') &&
    booted.installedPacks.includes('sw2d.pursuit') &&
    initial.run?.mode === 'course' &&
    initial.run.outcome === 'playing' &&
    initial.run.jumps === 0 &&
    initial.run.hazardsLeft === 2 &&
    initial.run.chaserX < initial.x &&
    initial.x > 90 &&
    initial.x < 220;

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
  const fellOk = fell.run?.outcome === 'failed' && fell.run.jumps === 0 && fell.run.lastResult === 'fell';

  // Restart; jump the gap, trip on both blocks: the chaser catches the runner.
  const run1 = await restartRun(harness);
  const fresh1 = await read();
  const restart1Ok = run1.after === run1.before + 1 && fresh1.run?.outcome === 'playing' && fresh1.run.jumps === 0 && fresh1.run.stumbles === 0;
  await jumpAt(harness, read, 210);
  const tripped = await waitUntil(harness, read, (s) => (s.run?.stumbles ?? 0) >= 1, 200, 2);
  const caught = await waitUntil(harness, read, (s) => s.run?.outcome !== 'playing', 300, 3);
  evidence.caught = { tripped: tripped.run, caught: caught.run };
  const caughtOk = tripped.run?.stumbling === true && caught.run?.outcome === 'failed' && caught.run.lastResult === 'caught' && caught.run.stumbles === 2;

  // Restart; jump the gap and both blocks and finish the course ahead of the chaser.
  const run2 = await restartRun(harness);
  const fresh2 = await read();
  const restart2Ok = run2.after === run2.before + 1 && fresh2.run?.outcome === 'playing' && fresh2.run.hazardsLeft === 2 && fresh2.run.gap > 100;
  await jumpAt(harness, read, 210);
  await jumpAt(harness, read, 455);
  await jumpAt(harness, read, 700);
  const done = await waitUntil(harness, read, (s) => s.run?.outcome !== 'playing', 200, 3);
  evidence.done = done.run;
  const doneOk = done.run?.outcome === 'complete' && done.run.lastResult === 'escaped' && done.run.jumps === 3 && done.run.stumbles === 0 && done.run.x >= 820;

  const passed = startedOk && autoOk && pauseOk && fellOk && restart1Ok && caughtOk && restart2Ok && doneOk;
  return { passed, details: { ...evidence, startedOk, autoOk, pauseOk, fellOk, restart1Ok, caughtOk, restart2Ok, doneOk } };
}
