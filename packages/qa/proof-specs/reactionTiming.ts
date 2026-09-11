import type { Harness } from '../src/harness.ts';
import { restartRun, shellReader, startPlay, waitUntil } from '../src/journey.ts';
import { readSnapshot } from '../src/snapshot.ts';
import type { SmokeOutcome } from '../src/smokeRunner.ts';

interface Timing {
  readonly active: boolean;
  readonly mode: string | null;
  readonly phase: string;
  readonly windowOpen: boolean;
  readonly hits: number;
  readonly misses: number;
  readonly lastResult: string | null;
  readonly lastLatencyMs: number | null;
  readonly outcome: string;
}
interface Shell {
  readonly timing?: Timing;
}

export async function run(harness: Harness): Promise<SmokeOutcome> {
  const read = shellReader<Shell>(harness, 'game.ui-simulation-shell');
  const t = async () => (await read()).timing!;
  const evidence: Record<string, unknown> = {};
  await startPlay(harness, 24);
  const booted = await readSnapshot(harness);
  const initial = await t();
  evidence.initial = initial;
  const startedOk = booted.installedPacks.includes('sw2d.timing') && initial.active && initial.mode === 'reaction' && initial.hits === 0 && initial.outcome === 'playing';

  // Pressing before the cue is a false start / miss, not a hit.
  await harness.keyTap('Enter');
  const early = await t();
  evidence.early = { last: early.lastResult, hits: early.hits, misses: early.misses };
  const earlyOk = early.hits === 0;

  // Wait for the visual "go" window, then react: one hit with a measured latency.
  const go = (await waitUntil(harness, read, (s) => s.timing?.windowOpen === true, 60, 2)).timing!;
  await harness.keyTap('Enter');
  await harness.stepFrames(4);
  const first = await t();
  evidence.first = { window: go.windowOpen, hits: first.hits, latency: first.lastLatencyMs, last: first.lastResult };
  const firstOk = go.windowOpen && first.hits === 1 && typeof first.lastLatencyMs === 'number';

  const secondGo = (await waitUntil(harness, read, (s) => s.timing?.windowOpen === true, 60, 2)).timing!;
  await harness.keyTap('Enter');
  const done = (await waitUntil(harness, read, (s) => s.timing?.outcome === 'complete', 20, 2)).timing!;
  evidence.done = { hits: done.hits, misses: done.misses, outcome: done.outcome };
  const doneOk = secondGo.windowOpen && done.hits >= 2 && done.outcome === 'complete';

  const run = await restartRun(harness);
  const fresh = await t();
  evidence.restart = { ...run, hits: fresh.hits, outcome: fresh.outcome };
  const restartOk = run.after === run.before + 1 && fresh.hits === 0 && fresh.outcome === 'playing';

  const passed = startedOk && earlyOk && firstOk && doneOk && restartOk;
  return { passed, details: { ...evidence, startedOk, earlyOk, firstOk, doneOk, restartOk } };
}
