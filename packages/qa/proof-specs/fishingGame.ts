import type { Harness } from '../src/harness.ts';
import { restartRun, shellReader, startPlay, waitUntil } from '../src/journey.ts';
import { readSnapshot } from '../src/snapshot.ts';
import type { SmokeOutcome } from '../src/smokeRunner.ts';

interface Arcade {
  readonly active: boolean;
  readonly mode: string | null;
  readonly score: number;
  readonly phase: string;
  readonly caught: number;
  readonly missed: number;
  readonly lastResult: string | null;
  readonly outcome: string;
}
interface Shell {
  readonly arcade?: Arcade;
}

export async function run(harness: Harness): Promise<SmokeOutcome> {
  const read = shellReader<Shell>(harness, 'game.ui-simulation-shell');
  const a = async () => (await read()).arcade!;
  const phase = (p: string) => waitUntil(harness, read, (s) => s.arcade?.phase === p, 90, 2).then((s) => s.arcade!);
  const evidence: Record<string, unknown> = {};
  await startPlay(harness, 12);
  const booted = await readSnapshot(harness);
  const initial = await a();
  evidence.initial = initial;
  const startedOk = booted.installedPacks.includes('sw2d.arcade') && initial.mode === 'fishing' && initial.phase === 'idle' && initial.caught === 0 && initial.score === 0;

  // Cast, wait for the bite, let it go: a miss, back to idle.
  await harness.keyTap('Enter');
  const cast = await a();
  const bite = await phase('bite');
  const missed = await phase('idle');
  evidence.cast = { last: cast.lastResult, phase: cast.phase };
  evidence.missed = { last: missed.lastResult, missed: missed.missed, score: missed.score };
  const missOk = bite.phase === 'bite' && missed.lastResult === 'missed' && missed.missed >= 1 && missed.score === 0;

  // Cast again and strike during the bite window: a landed fish scores.
  await harness.keyTap('Enter');
  const recast = await phase('bite');
  await harness.keyTap('Enter');
  const first = await a();
  evidence.first = { last: first.lastResult, caught: first.caught, score: first.score };
  const landOk = recast.phase === 'bite' && first.lastResult === 'landed' && first.caught === 1 && first.score > 0;

  // Second fish completes the quota.
  await phase('idle');
  await harness.keyTap('Enter');
  await phase('bite');
  await harness.keyTap('Enter');
  const done = await a();
  evidence.done = { caught: done.caught, score: done.score, outcome: done.outcome };
  const doneOk = done.caught === 2 && done.score === first.score * 2 && done.outcome === 'complete';

  const run = await restartRun(harness);
  const fresh = await a();
  evidence.restart = { ...run, caught: fresh.caught, score: fresh.score, phase: fresh.phase, outcome: fresh.outcome };
  const restartOk = run.after === run.before + 1 && fresh.caught === 0 && fresh.score === 0 && fresh.phase === 'idle' && fresh.outcome === 'playing';

  const passed = startedOk && missOk && landOk && doneOk && restartOk;
  return { passed, details: { ...evidence, startedOk, missOk, landOk, doneOk, restartOk } };
}
