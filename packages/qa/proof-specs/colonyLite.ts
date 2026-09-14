import type { Harness } from '../src/harness.ts';
import { restartRun, shellReader, startPlay, waitUntil } from '../src/journey.ts';
import { readSnapshot } from '../src/snapshot.ts';
import type { SmokeOutcome } from '../src/smokeRunner.ts';

interface Worker {
  readonly id: string;
  readonly busy: boolean;
  readonly phase: string;
  readonly job: string | null;
  readonly assignmentReason: string;
  readonly x: number;
  readonly y: number;
  readonly hunger: number;
  readonly rest: number;
  readonly pathLength: number;
}
interface Simulation {
  readonly mode: string | null;
  readonly selectedIndex: number;
  readonly materials: number;
  readonly workers: readonly Worker[];
  readonly constructing: boolean;
  readonly built: boolean;
  readonly lastResult: string | null;
  readonly outcome: string;
}
interface Shell { readonly simulation?: Simulation; }

export async function run(harness: Harness): Promise<SmokeOutcome> {
  const read = shellReader<Shell>(harness, 'game.ui-simulation-shell');
  const sim = async () => (await read()).simulation!;
  const evidence: Record<string, unknown> = {};
  await startPlay(harness, 12);
  const booted = await readSnapshot(harness);
  const initial = await sim();
  evidence.initial = initial;
  const startedOk =
    booted.installedPacks.includes('sw2d.simulation') &&
    booted.installedPacks.includes('sw2d.needs') &&
    booted.installedPacks.includes('sw2d.navigation') &&
    initial.mode === 'colony' &&
    initial.workers.length === 3 &&
    initial.workers.every((worker) => worker.hunger > 0 && worker.rest > 0);

  // A hall cannot be placed until the existing simulation ledger can pay its cost.
  await harness.keyTap('ArrowRight');
  await harness.keyTap('ArrowRight');
  await harness.keyTap('Enter');
  const refused = await sim();
  const costGateOk = refused.lastResult === 'need-resources';

  // Wood priority deterministically selects the healthiest idle colonists and routes both through sw2d.navigation.
  await harness.keyTap('ArrowLeft');
  await harness.keyTap('ArrowLeft');
  await harness.keyTap('Enter');
  await harness.keyTap('Enter');
  const traveling = await sim();
  evidence.traveling = traveling.workers;
  const assignmentOk = traveling.workers.filter((worker) => worker.phase === 'traveling' && worker.job === 'wood').length === 2 && traveling.workers.filter((worker) => worker.busy).every((worker) => worker.pathLength > 1 && worker.assignmentReason === 'priority:wood');
  const wood = (await waitUntil(harness, read, (state) => (state.simulation?.materials ?? 0) >= 2, 160, 4)).simulation!;

  // Stone priority changes the assigned job and therefore the resource produced.
  await harness.keyTap('ArrowRight');
  await harness.keyTap('Enter');
  const stoneTravel = await sim();
  const stoneAssignmentOk = stoneTravel.workers.some((worker) => worker.job === 'stone' && worker.pathLength > 1);
  const stocked = (await waitUntil(harness, read, (state) => (state.simulation?.materials ?? 0) >= 3, 180, 4)).simulation!;
  evidence.stocked = stocked;

  // Placement consumes 2 wood + 1 stone, routes a colonist to the build site, then completes.
  await harness.keyTap('ArrowRight');
  await harness.keyTap('Enter');
  const building = await sim();
  evidence.building = building;
  const buildStartedOk = building.constructing && building.workers.some((worker) => worker.job === 'construct' && worker.phase === 'traveling');
  const done = (await waitUntil(harness, read, (state) => state.simulation?.built === true, 180, 4)).simulation!;
  const doneOk = done.outcome === 'complete' && done.built && done.materials === 0;

  const run = await restartRun(harness);
  const fresh = await sim();
  const restartOk = run.after === run.before + 1 && fresh.outcome === 'playing' && !fresh.built && fresh.materials === 0 && fresh.workers.every((worker) => !worker.busy);
  await harness.stepFrames(2400);
  const failed = await sim();
  const failureOk = failed.outcome === 'failed' && failed.lastResult === 'colonist-need-failed' && failed.workers.some((worker) => worker.hunger <= 5 || worker.rest <= 5);

  const passed = startedOk && costGateOk && assignmentOk && wood.materials >= 2 && stoneAssignmentOk && stocked.materials >= 3 && buildStartedOk && doneOk && restartOk && failureOk;
  return { passed, details: { ...evidence, done, fresh, failed, startedOk, costGateOk, assignmentOk, stoneAssignmentOk, buildStartedOk, doneOk, restartOk, failureOk } };
}
