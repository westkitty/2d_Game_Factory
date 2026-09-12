import type { Harness } from '../src/harness.ts';
import { restartRun, shellReader, startPlay, waitUntil } from '../src/journey.ts';
import { readSnapshot } from '../src/snapshot.ts';
import type { SmokeOutcome } from '../src/smokeRunner.ts';

interface Needs {
  readonly active: boolean;
  readonly mode: string | null;
  readonly needValues: Readonly<Record<string, number>>;
  readonly actionsTaken: number;
  readonly holdMs: number;
  readonly outcome: string;
  readonly lastResult: string | null;
}
interface Shell {
  readonly needs?: Needs;
}

export async function run(harness: Harness): Promise<SmokeOutcome> {
  const read = shellReader<Shell>(harness, 'game.ui-simulation-shell');
  const evidence: Record<string, unknown> = {};
  await startPlay(harness);
  const booted = await readSnapshot(harness);
  const initial = (await read()).needs!;
  evidence.initial = { mode: initial.mode, water: initial.needValues.water, food: initial.needValues.food };
  const startedOk = booted.installedPacks.includes('sw2d.needs') && initial.mode === 'habitat' && initial.outcome === 'playing';

  // Feed and refresh the water: two distinct care actions on two meters.
  await harness.keyTap('KeyJ');
  const fed = (await read()).needs!;
  await harness.keyTap('KeyK');
  const refreshed = (await read()).needs!;
  evidence.fed = { food: fed.needValues.food };
  evidence.refreshed = { water: refreshed.needValues.water, actions: refreshed.actionsTaken };
  const careOk = fed.needValues.food! > initial.needValues.food! && refreshed.needValues.water! > initial.needValues.water! && refreshed.actionsTaken === 2;

  // The habitat must be held healthy for a long window (7 s of simulation time), not just touched once.
  const early = (await waitUntil(harness, read, (s) => (s.needs?.holdMs ?? 0) >= 2000, 40, 6)).needs!;
  const earlyOk = early.outcome === 'playing' && early.holdMs >= 2000 && early.holdMs < 7000;
  const complete = (await waitUntil(harness, read, (s) => s.needs?.outcome === 'complete', 120, 6)).needs!;
  evidence.complete = { outcome: complete.outcome, hold: complete.holdMs };
  const completeOk = complete.outcome === 'complete' && complete.holdMs >= 7000;

  const run = await restartRun(harness);
  const fresh = (await read()).needs!;
  evidence.restart = { ...run, outcome: fresh.outcome, hold: fresh.holdMs, actions: fresh.actionsTaken };
  // Fresh meters start above the completion floor, so the hold clock is already running - but only for the settle frames.
  const restartOk = run.after === run.before + 1 && fresh.outcome === 'playing' && fresh.holdMs < 1000 && fresh.actionsTaken === 0;

  const passed = startedOk && careOk && earlyOk && completeOk && restartOk;
  return { passed, details: { ...evidence, startedOk, careOk, earlyOk, completeOk, restartOk } };
}
