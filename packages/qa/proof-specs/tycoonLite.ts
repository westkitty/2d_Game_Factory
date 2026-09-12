import type { Harness } from '../src/harness.ts';
import { pauseResume, restartRun, shellReader, startPlay, waitUntil } from '../src/journey.ts';
import { readSnapshot } from '../src/snapshot.ts';
import type { SmokeOutcome } from '../src/smokeRunner.ts';

interface Economy {
  readonly active: boolean;
  readonly mode: string | null;
  readonly cash: number;
  readonly queue: readonly { id: string; goodId: string }[];
  readonly served: number;
  readonly produced: number;
  readonly producing: { recipeId: string; remainingMs: number } | null;
  readonly lastResult: string | null;
}
interface Shell {
  readonly economy?: Economy;
}

export async function run(harness: Harness): Promise<SmokeOutcome> {
  const read = shellReader<Shell>(harness, 'game.ui-simulation-shell');
  const evidence: Record<string, unknown> = {};
  await startPlay(harness);
  const booted = await readSnapshot(harness);
  const initial = (await read()).economy;
  evidence.initial = initial;
  const startedOk = booted.scene === 'sw2d.play' && booted.installedPacks.includes('sw2d.economy') && initial?.mode === 'factory';

  // A buyer queues; a production job runs for real time, then auto-sells.
  const buyer = (await waitUntil(harness, read, (s) => (s.economy?.queue.length ?? 0) >= 1)).economy!;
  await harness.keyTap('KeyK');
  const started = (await read()).economy!;
  evidence.started = { producing: started.producing, last: started.lastResult };
  const jobOk = started.producing !== null;
  // Production is time-gated: the job is still running a few frames later.
  await harness.stepFrames(3);
  const midJob = (await read()).economy!;
  const timeGatedOk = midJob.produced === buyer.produced && midJob.served === 0;
  const sold = (await waitUntil(harness, read, (s) => (s.economy?.served ?? 0) >= 1, 120, 4)).economy!;
  evidence.sold = { served: sold.served, cash: sold.cash, produced: sold.produced, last: sold.lastResult };
  const soldOk = sold.served === 1 && sold.cash > buyer.cash && sold.produced >= 1;

  // Second cycle; production spam while a job runs does not start a second job.
  await harness.keyTap('KeyK');
  for (let i = 0; i < 5; i++) await harness.keyTap('KeyK');
  const busy = (await read()).economy!;
  evidence.busy = { producing: busy.producing, last: busy.lastResult, produced: busy.produced };
  const busyOk = busy.produced === sold.produced;
  const second = (await waitUntil(harness, read, (s) => (s.economy?.served ?? 0) >= 2, 120, 4)).economy!;
  evidence.second = { served: second.served, cash: second.cash };
  const secondOk = second.served === 2 && second.cash > sold.cash;

  const paused = await pauseResume(harness);
  const resumed = (await read()).economy!;
  const pauseOk = paused.pausedDuring && !paused.pausedAfter && resumed.served === 2;
  const run = await restartRun(harness);
  const fresh = (await read()).economy!;
  evidence.restart = { ...run, served: fresh.served, cash: fresh.cash };
  const restartOk = run.after === run.before + 1 && fresh.served === 0 && fresh.produced === 0 && fresh.cash === initial!.cash;

  const passed = startedOk && jobOk && timeGatedOk && soldOk && busyOk && secondOk && pauseOk && restartOk;
  return { passed, details: { ...evidence, startedOk, jobOk, timeGatedOk, soldOk, busyOk, secondOk, pauseOk, restartOk } };
}
