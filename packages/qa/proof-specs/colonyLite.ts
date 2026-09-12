import type { Harness } from '../src/harness.ts';
import { restartRun, shellReader, startPlay, waitUntil } from '../src/journey.ts';
import { readSnapshot } from '../src/snapshot.ts';
import type { SmokeOutcome } from '../src/smokeRunner.ts';

interface Simulation {
  readonly active: boolean;
  readonly mode: string | null;
  readonly selectedIndex: number;
  readonly materials: number;
  readonly workers: readonly { readonly busy: boolean; readonly remainingMs: number }[];
  readonly constructing: boolean;
  readonly built: boolean;
  readonly lastResult: string | null;
  readonly outcome: string;
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
  evidence.initial = { mode: initial.mode, materials: initial.materials, workers: initial.workers.map((w) => w.busy), built: initial.built };
  const startedOk = booted.installedPacks.includes('sw2d.simulation') && initial.mode === 'colony' && initial.materials === 0 && initial.built === false;

  // Building before gathering is refused for lack of materials.
  await harness.keyTap('ArrowRight');
  await harness.keyTap('ArrowRight');
  await harness.keyTap('Enter');
  const need = await sim();
  evidence.need = { last: need.lastResult, selected: need.selectedIndex };
  const needOk = need.lastResult === 'need-materials' && need.selectedIndex === 2;

  // Assign worker 0 to gather: the worker is busy for real time, then the ledger gains a material.
  await harness.keyTap('ArrowLeft');
  await harness.keyTap('ArrowLeft');
  await harness.keyTap('Enter');
  const assigned = await sim();
  evidence.assigned = { last: assigned.lastResult, busy: assigned.workers[0]?.busy };
  const assignOk = assigned.lastResult === 'assigned' && assigned.workers[0]?.busy === true;
  await harness.keyTap('Enter');
  const doubled = await sim();
  const busyRefusedOk = doubled.workers[0]?.busy === true && doubled.materials === 0;
  const gathered = (await waitUntil(harness, read, (s) => (s.simulation?.materials ?? 0) >= 1, 60, 5)).simulation!;
  evidence.gathered = { materials: gathered.materials, busy: gathered.workers[0]?.busy };
  const gatherOk = gathered.materials === 1 && gathered.workers[0]?.busy === false;

  // Second worker gathers; then construction runs and the structure is built.
  await harness.keyTap('ArrowRight');
  await harness.keyTap('Enter');
  await waitUntil(harness, read, (s) => (s.simulation?.materials ?? 0) >= 2, 60, 5);
  await harness.keyTap('ArrowRight');
  await harness.keyTap('Enter');
  const building = await sim();
  evidence.building = { constructing: building.constructing, last: building.lastResult, materials: building.materials };
  const buildOk = building.constructing === true && building.lastResult === 'building';
  const done = (await waitUntil(harness, read, (s) => s.simulation?.built === true, 60, 5)).simulation!;
  evidence.done = { built: done.built, outcome: done.outcome };
  const doneOk = done.built === true && done.outcome === 'complete';

  const run = await restartRun(harness);
  const fresh = await sim();
  evidence.restart = { ...run, materials: fresh.materials, built: fresh.built, outcome: fresh.outcome };
  const restartOk = run.after === run.before + 1 && fresh.materials === 0 && fresh.built === false && fresh.outcome === 'playing';

  const passed = startedOk && needOk && assignOk && busyRefusedOk && gatherOk && buildOk && doneOk && restartOk;
  return { passed, details: { ...evidence, startedOk, needOk, assignOk, busyRefusedOk, gatherOk, buildOk, doneOk, restartOk } };
}
