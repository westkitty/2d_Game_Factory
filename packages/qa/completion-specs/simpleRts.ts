import type { Harness } from '../src/harness.ts';
import { clickAt, pointerAt, restartRun, shellReader, startPlay, waitUntil } from '../src/journey.ts';
import { readSnapshot } from '../src/snapshot.ts';
import type { SmokeOutcome } from '../src/smokeRunner.ts';

interface Command {
  readonly selectedCount: number;
  readonly queued: number;
  readonly alive: number;
  readonly unitX: number;
  readonly lastResult: string | null;
  readonly outcome: string;
}
interface Shell {
  readonly command?: Command;
}

export async function run(harness: Harness): Promise<SmokeOutcome> {
  const read = shellReader<Shell>(harness, 'game.top-down-shell');
  const c = async () => (await read()).command!;
  const evidence: Record<string, unknown> = {};
  await startPlay(harness, 12);
  const booted = await readSnapshot(harness);
  const initial = await c();
  const startedOk =
    booted.installedPacks.includes('sw2d.navigation') &&
    initial.alive === 3 &&
    initial.selectedCount === 0 &&
    initial.outcome === 'playing';

  await pointerAt(harness, 'pointermove', 160, 230);
  await harness.stepFrames(2);
  await pointerAt(harness, 'pointerdown', 160, 230);
  await harness.stepFrames(4);
  await pointerAt(harness, 'pointermove', 250, 520);
  await harness.stepFrames(6);
  await pointerAt(harness, 'pointerup', 250, 520);
  await harness.stepFrames(6);
  const boxed = await c();
  const boxOk = boxed.selectedCount === 3 && boxed.lastResult === 'boxed';

  await clickAt(harness, 820, 270);
  await harness.stepFrames(8);
  const queued = await c();
  evidence.queued = queued;
  const queuedOk = (queued.queued ?? 0) >= 1 || queued.lastResult === 'queued';

  const done = await waitUntil(harness, read, (s) => s.command?.outcome === 'complete', 200, 4);
  evidence.done = done.command;
  const doneOk = done.command?.outcome === 'complete';

  await clickAt(harness, 80, 80);
  const afterHazard = await waitUntil(harness, read, (s) => (s.command?.alive ?? 3) < 3, 40, 4);
  evidence.dead = afterHazard.command;

  const run = await restartRun(harness);
  const fresh = await c();
  const restartOk = run.after === run.before + 1 && fresh.alive === 3 && fresh.outcome === 'playing';

  const passed = startedOk && boxOk && queuedOk && doneOk && restartOk;
  return { passed, details: { ...evidence, startedOk, boxOk, queuedOk, doneOk, restartOk } };
}
