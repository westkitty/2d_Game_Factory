import type { Harness } from '../src/harness.ts';
import { holdUntil, restartRun, shellReader, startPlay } from '../src/journey.ts';
import { readSnapshot } from '../src/snapshot.ts';
import type { SmokeOutcome } from '../src/smokeRunner.ts';

interface Command {
  readonly active: boolean;
  readonly mode: string | null;
  readonly owned: number;
  readonly lastResult: string | null;
  readonly outcome: string;
}
interface Shell {
  readonly x: number;
  readonly y: number;
  readonly command?: Command;
}

export async function run(harness: Harness): Promise<SmokeOutcome> {
  const read = shellReader<Shell>(harness, 'game.top-down-shell');
  const evidence: Record<string, unknown> = {};
  await startPlay(harness, 12);
  const booted = await readSnapshot(harness);
  const initial = await read();
  evidence.initial = { x: initial.x, command: initial.command };
  const startedOk = booted.installedPacks.includes('sw2d.territory') && initial.command?.mode === 'zone' && initial.command.owned === 0 && initial.command.outcome === 'playing';

  // Standing in zone A long enough captures it; passing through does not.
  const enteredA = await holdUntil(harness, ['ArrowRight'], read, (s) => s.x >= 270);
  const passThrough = enteredA.command!;
  const passOk = passThrough.owned === 0;
  await harness.stepFrames(30);
  const ownedA = (await read()).command!;
  evidence.ownedA = ownedA;
  const ownedAOk = ownedA.owned === 1 && ownedA.outcome === 'playing';

  // Leaving A keeps it owned (capture, not presence); zone B completes the map.
  await holdUntil(harness, ['ArrowRight'], read, (s) => s.x >= 480);
  const between = (await read()).command!;
  const keptOk = between.owned === 1;
  await holdUntil(harness, ['ArrowRight'], read, (s) => s.x >= 690);
  await harness.stepFrames(30);
  const done = (await read()).command!;
  evidence.done = done;
  const doneOk = done.owned === 2 && done.lastResult === 'owned' && done.outcome === 'complete';

  const run = await restartRun(harness);
  const fresh = await read();
  evidence.restart = { ...run, x: fresh.x, command: fresh.command };
  const restartOk = run.after === run.before + 1 && fresh.command?.owned === 0 && fresh.command.outcome === 'playing' && fresh.x === initial.x;

  const passed = startedOk && passOk && ownedAOk && keptOk && doneOk && restartOk;
  return { passed, details: { ...evidence, startedOk, passOk, ownedAOk, keptOk, doneOk, restartOk } };
}
