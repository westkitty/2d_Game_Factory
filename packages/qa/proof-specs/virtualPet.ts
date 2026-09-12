import type { Harness } from '../src/harness.ts';
import { restartRun, shellReader, startPlay } from '../src/journey.ts';
import { readSnapshot } from '../src/snapshot.ts';
import type { SmokeOutcome } from '../src/smokeRunner.ts';

interface Needs {
  readonly active: boolean;
  readonly mode: string | null;
  readonly needValues: Readonly<Record<string, number>>;
  readonly actionsTaken: number;
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
  evidence.initial = { mode: initial.mode, hunger: initial.needValues.hunger, happiness: initial.needValues.happiness };
  const startedOk = booted.installedPacks.includes('sw2d.needs') && initial.mode === 'companion' && initial.outcome === 'playing';

  // One meter alone does not complete the companion; both above threshold after two acts does.
  await harness.keyTap('KeyJ');
  const fed = (await read()).needs!;
  evidence.fed = { hunger: fed.needValues.hunger, outcome: fed.outcome, actions: fed.actionsTaken };
  const fedOk = fed.needValues.hunger! > initial.needValues.hunger! && fed.outcome === 'playing' && fed.actionsTaken === 1;
  await harness.keyTap('KeyK');
  const finished = (await read()).needs!;
  evidence.finished = { happiness: finished.needValues.happiness, actions: finished.actionsTaken, outcome: finished.outcome };
  const finishedOk = finished.needValues.happiness! > initial.needValues.happiness! && finished.actionsTaken === 2 && finished.outcome === 'complete';

  // Acting after completion is inert (no further counting).
  await harness.keyTap('KeyJ');
  const after = (await read()).needs!;
  const inertOk = after.actionsTaken === 2 && after.outcome === 'complete';

  const run = await restartRun(harness);
  const fresh = (await read()).needs!;
  evidence.restart = { ...run, outcome: fresh.outcome, actions: fresh.actionsTaken };
  const restartOk = run.after === run.before + 1 && fresh.outcome === 'playing' && fresh.actionsTaken === 0;

  const passed = startedOk && fedOk && finishedOk && inertOk && restartOk;
  return { passed, details: { ...evidence, startedOk, fedOk, finishedOk, inertOk, restartOk } };
}
