import type { Harness } from '../src/harness.ts';
import { restartRun, shellReader, startPlay, waitUntil } from '../src/journey.ts';
import { readSnapshot } from '../src/snapshot.ts';
import type { SmokeOutcome } from '../src/smokeRunner.ts';

interface Look {
  readonly active: boolean;
  readonly mode: string | null;
  readonly foesAlive: number;
  readonly nearId: string | null;
  readonly lastResult: string | null;
  readonly outcome: string;
}
interface Shell {
  readonly look?: Look;
}

export async function run(harness: Harness): Promise<SmokeOutcome> {
  const read = shellReader<Shell>(harness, 'game.pointer-shell');
  const lk = async () => (await read()).look!;
  const evidence: Record<string, unknown> = {};
  await startPlay(harness, 12);
  const booted = await readSnapshot(harness);
  const initial = await lk();
  evidence.initial = initial;
  const startedOk = booted.installedPacks.includes('sw2d.camera') && booted.installedPacks.includes('sw2d.combat') && initial.mode === 'rail' && initial.foesAlive === 2 && initial.outcome === 'playing';

  // Firing with no target in the reticle is a miss, not a kill.
  await harness.keyTap('KeyJ');
  await harness.stepFrames(2);
  const miss = await lk();
  const missOk = miss.foesAlive === 2;

  // The rail camera brings targets into the reticle on its own; fire only when one is near.
  let live = miss;
  let shots = 0;
  let firstKill: Look | null = null;
  for (let step = 0; step < 200 && live.outcome !== 'complete'; step++) {
    if (live.nearId) {
      await harness.keyTap('KeyJ');
      shots += 1;
    }
    await harness.stepFrames(4);
    live = await lk();
    if (!firstKill && live.foesAlive === 1) firstKill = live;
  }
  evidence.firstKill = firstKill;
  evidence.done = { ...live, shots };
  const killOk = firstKill !== null && firstKill.foesAlive === 1 && firstKill.outcome === 'playing';
  const doneOk = live.outcome === 'complete' && live.foesAlive === 0 && live.lastResult === 'cleared' && shots >= 2;

  const run = await restartRun(harness);
  const fresh = await lk();
  evidence.restart = { ...run, foes: fresh.foesAlive, outcome: fresh.outcome };
  const restartOk = run.after === run.before + 1 && fresh.foesAlive === 2 && fresh.outcome === 'playing';

  const passed = startedOk && missOk && killOk && doneOk && restartOk;
  return { passed, details: { ...evidence, startedOk, missOk, killOk, doneOk, restartOk } };
}
