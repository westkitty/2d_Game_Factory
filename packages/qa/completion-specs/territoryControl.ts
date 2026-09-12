import type { Harness } from '../src/harness.ts';
import { holdUntil, restartRun, shellReader, startPlay } from '../src/journey.ts';
import { readSnapshot } from '../src/snapshot.ts';
import type { SmokeOutcome } from '../src/smokeRunner.ts';

interface Command {
  readonly owned: number;
  readonly score: number;
  readonly contested: number;
  readonly lastResult: string | null;
  readonly outcome: string;
}
interface Shell {
  readonly x: number;
  readonly command?: Command;
}

export async function run(harness: Harness): Promise<SmokeOutcome> {
  const read = shellReader<Shell>(harness, 'game.top-down-shell');
  const evidence: Record<string, unknown> = {};
  await startPlay(harness, 12);
  const booted = await readSnapshot(harness);
  const initial = await read();
  const startedOk = booted.installedPacks.includes('sw2d.territory') && initial.command?.owned === 0 && initial.command.score === 0;

  await holdUntil(harness, ['ArrowRight'], read, (s) => s.x >= 270);
  await harness.stepFrames(30);
  const ownedA = (await read()).command!;
  evidence.ownedA = ownedA;
  const ownedAOk = ownedA.owned === 1 && ownedA.score >= 1;

  await holdUntil(harness, ['ArrowRight'], read, (s) => s.x >= 690);
  await harness.stepFrames(30);
  const ownedB = (await read()).command!;
  evidence.ownedB = ownedB;
  const ownedBOk = ownedB.owned === 2 && ownedB.outcome === 'complete';

  const run = await restartRun(harness);
  const fresh = await read();
  const restartOk = run.after === run.before + 1 && fresh.command?.owned === 0 && fresh.command.outcome === 'playing';

  const passed = startedOk && ownedAOk && ownedBOk && restartOk;
  return { passed, details: { ...evidence, startedOk, ownedAOk, ownedBOk, restartOk } };
}
