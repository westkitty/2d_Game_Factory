import type { Harness } from '../src/harness.ts';
import { restartRun, shellReader, startPlay, waitUntil, waitWall } from '../src/journey.ts';
import { readSnapshot } from '../src/snapshot.ts';
import type { SmokeOutcome } from '../src/smokeRunner.ts';

interface Timing {
  readonly active: boolean;
  readonly mode: string | null;
  readonly windowOpen: boolean;
  readonly hits: number;
  readonly misses: number;
  readonly nextBeatInMs: number | null;
  readonly cueIndex: number;
  readonly lastResult: string | null;
  readonly outcome: string;
}
interface Shell {
  readonly timing?: Timing;
}

export async function run(harness: Harness): Promise<SmokeOutcome> {
  const read = shellReader<Shell>(harness, 'game.ui-simulation-shell');
  const t = async () => (await read()).timing!;
  const evidence: Record<string, unknown> = {};
  await startPlay(harness, 4);
  const booted = await readSnapshot(harness);
  const initial = await t();
  evidence.initial = initial;
  const startedOk = booted.installedPacks.includes('sw2d.timing') && initial.active && initial.mode === 'rhythm' && initial.hits === 0 && initial.outcome === 'playing';

  // Hit three consecutive beat windows. Rhythm samples AudioContext.currentTime,
  // so the harness must let wall-clock advance (stepFrames alone does not).
  const hits: { window: boolean; hits: number; cue: number; last: string | null }[] = [];
  for (let i = 0; i < 3; i++) {
    let open = await t();
    for (let step = 0; step < 200 && !open.windowOpen; step++) {
      await waitWall(20);
      await harness.stepFrames(1);
      open = await t();
    }
    await harness.keyTap('Enter');
    await harness.stepFrames(3);
    const after = await t();
    hits.push({ window: open.windowOpen, hits: after.hits, cue: after.cueIndex, last: after.lastResult });
  }
  evidence.hits = hits;
  const beatsOk = hits.every((h) => h.window) && hits[0]!.hits >= 1 && hits[1]!.hits >= 2 && hits[2]!.hits >= 3;
  const done = (await waitUntil(harness, read, (s) => s.timing?.outcome === 'complete', 20, 2)).timing!;
  evidence.done = { hits: done.hits, misses: done.misses, outcome: done.outcome };
  const doneOk = done.outcome === 'complete' && done.hits >= 3;

  const run = await restartRun(harness);
  const fresh = await t();
  evidence.restart = { ...run, hits: fresh.hits, cue: fresh.cueIndex, outcome: fresh.outcome };
  const restartOk = run.after === run.before + 1 && fresh.hits === 0 && fresh.outcome === 'playing';

  const passed = startedOk && beatsOk && doneOk && restartOk;
  return { passed, details: { ...evidence, startedOk, beatsOk, doneOk, restartOk } };
}
