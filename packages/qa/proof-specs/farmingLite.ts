import type { Harness } from '../src/harness.ts';
import { restartRun, shellReader, startPlay, waitUntil } from '../src/journey.ts';
import { readSnapshot } from '../src/snapshot.ts';
import type { SmokeOutcome } from '../src/smokeRunner.ts';

interface Simulation {
  readonly active: boolean;
  readonly mode: string | null;
  readonly selectedIndex: number;
  readonly crops: number;
  readonly plots: readonly { readonly phase: string; readonly remainingMs: number }[];
  readonly lastResult: string | null;
  readonly outcome: string;
  readonly jobCount: number;
}
interface Shell {
  readonly simulation?: Simulation;
}

export async function run(harness: Harness): Promise<SmokeOutcome> {
  const read = shellReader<Shell>(harness, 'game.ui-simulation-shell');
  const sim = async () => (await read()).simulation!;
  const evidence: Record<string, unknown> = {};
  await startPlay(harness, 12);
  const booted = await readSnapshot(harness);
  const initial = await sim();
  evidence.initial = { mode: initial.mode, crops: initial.crops, plots: initial.plots.map((p) => p.phase) };
  const startedOk = booted.installedPacks.includes('sw2d.simulation') && initial.mode === 'farm' && initial.crops === 0 && initial.plots[0]?.phase === 'empty';

  // Plant plot 0: it is dry until watered, then grows on the pack clock.
  await harness.keyTap('Enter');
  const planted = await sim();
  evidence.planted = { last: planted.lastResult, phase: planted.plots[0]?.phase };
  const plantOk = planted.lastResult === 'planted' && planted.plots[0]?.phase === 'dry';
  await harness.keyTap('Enter');
  const watered = await sim();
  evidence.watered = { last: watered.lastResult, phase: watered.plots[0]?.phase };
  const waterOk = watered.lastResult === 'watered' && watered.plots[0]?.phase === 'growing';
  // Harvesting while still growing is refused.
  await harness.keyTap('Enter');
  const tooEarly = await sim();
  const earlyOk = tooEarly.crops === 0 && tooEarly.plots[0]?.phase === 'growing';
  const ripe = (await waitUntil(harness, read, (s) => s.simulation?.plots[0]?.phase === 'ripe', 60, 5)).simulation!;
  await harness.keyTap('Enter');
  const harvested = await sim();
  evidence.harvested = { ripe: ripe.plots[0]?.phase, crops: harvested.crops, last: harvested.lastResult };
  const harvestOk = ripe.plots[0]?.phase === 'ripe' && harvested.crops === 1 && harvested.lastResult === 'harvested';

  // Plots 1 and 2 complete the quota: plant, water, harvest.
  for (const plot of [1, 2]) {
    await harness.keyTap('ArrowRight');
    await harness.keyTap('Enter');
    await harness.keyTap('Enter');
    await waitUntil(harness, read, (s) => s.simulation?.plots[plot]?.phase === 'ripe', 60, 5);
    await harness.keyTap('Enter');
  }
  const done = await sim();
  evidence.done = { crops: done.crops, outcome: done.outcome, plots: done.plots.map((p) => p.phase) };
  const doneOk = done.crops === 3 && done.outcome === 'complete';

  const run = await restartRun(harness);
  const fresh = await sim();
  evidence.restart = { ...run, crops: fresh.crops, outcome: fresh.outcome, plots: fresh.plots.map((p) => p.phase) };
  const restartOk = run.after === run.before + 1 && fresh.crops === 0 && fresh.outcome === 'playing' && fresh.plots.every((p) => p.phase === 'empty');

  const passed = startedOk && plantOk && waterOk && earlyOk && harvestOk && doneOk && restartOk;
  return { passed, details: { ...evidence, startedOk, plantOk, waterOk, earlyOk, harvestOk, doneOk, restartOk } };
}
