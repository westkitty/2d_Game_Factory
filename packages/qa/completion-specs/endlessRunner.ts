import type { Harness } from '../src/harness.ts';
import { restartRun, shellReader, startPlay, waitUntil } from '../src/journey.ts';
import { readSnapshot } from '../src/snapshot.ts';
import type { SmokeOutcome } from '../src/smokeRunner.ts';

/**
 * endless-runner completion journey (matrix L02): the reusable sw2d.pursuit
 * chaser trails the auto-runner. Tripping on both hazards lets it catch up;
 * jumping the gap and both blocks survives to the score target with the
 * chaser still behind.
 */

interface Run {
  readonly mode: string | null;
  readonly x: number;
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
  readonly onGround: boolean;
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
    booted.installedPacks.includes('sw2d.pursuit') &&
    booted.installedPacks.includes('sw2d.generation') &&
    initial.run?.mode === 'endless' &&
    initial.run.outcome === 'playing' &&
    initial.run.hazardsLeft === 2 &&
    initial.run.gap > 100 &&
    initial.run.chaserX < initial.x;

  // Jump the gap, then trip on both blocks: the chaser closes and catches.
  await jumpAt(harness, read, 210);
  const tripped = await waitUntil(harness, read, (s) => (s.run?.stumbles ?? 0) >= 1, 200, 2);
  evidence.tripped = tripped.run;
  const trippedOk = tripped.run?.stumbles === 1 && tripped.run.stumbling && tripped.run.outcome === 'playing';
  const caught = await waitUntil(harness, read, (s) => s.run?.outcome !== 'playing', 300, 3);
  evidence.caught = caught.run;
  const caughtOk = caught.run?.outcome === 'failed' && caught.run.lastResult === 'caught' && caught.run.stumbles === 2 && caught.run.gap <= 24;

  // Restart: chaser back to its gap; jump the gap and both blocks; survive.
  const restart = await restartRun(harness);
  const fresh = await read();
  const restartOk = restart.after === restart.before + 1 && fresh.run?.outcome === 'playing' && fresh.run.stumbles === 0 && fresh.run.hazardsLeft === 2 && fresh.run.gap > 100;
  await jumpAt(harness, read, 210);
  await jumpAt(harness, read, 455);
  await jumpAt(harness, read, 700);
  const done = await waitUntil(harness, read, (s) => s.run?.outcome !== 'playing', 300, 3);
  evidence.done = done.run;
  const doneOk = done.run?.outcome === 'complete' && done.run.lastResult === 'survived' && done.run.stumbles === 0 && done.run.jumps === 3 && done.run.gap > 100;

  const passed = startedOk && trippedOk && caughtOk && restartOk && doneOk;
  return { passed, details: { ...evidence, startedOk, trippedOk, caughtOk, restartOk, doneOk } };
}
