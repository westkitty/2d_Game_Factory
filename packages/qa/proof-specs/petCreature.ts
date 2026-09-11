import type { Harness } from '../src/harness.ts';
import { pauseResume, restartRun, shellReader, startPlay, waitUntil } from '../src/journey.ts';
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
  readonly affinity: number;
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
  evidence.initial = { mode: initial.mode, hunger: initial.needValues.hunger, mood: initial.needValues.mood };
  const startedOk = booted.installedPacks.includes('sw2d.needs') && initial.active && initial.mode === 'creature' && initial.outcome === 'playing';

  // Meters decay on the simulation clock while nothing is pressed.
  await harness.stepFrames(30);
  const decayed = (await read()).needs!;
  evidence.decayed = { hunger: decayed.needValues.hunger };
  const decayOk = decayed.needValues.hunger! < initial.needValues.hunger!;

  // Feed raises hunger; spam feeding clamps at the meter ceiling.
  await harness.keyTap('KeyJ');
  const fed = (await read()).needs!;
  for (let i = 0; i < 12; i++) await harness.keyTap('KeyJ');
  const spam = (await read()).needs!;
  evidence.fed = { hunger: fed.needValues.hunger, actions: fed.actionsTaken };
  evidence.spam = { hunger: spam.needValues.hunger, actions: spam.actionsTaken };
  const feedOk = fed.needValues.hunger! > decayed.needValues.hunger! && fed.actionsTaken >= 1 && spam.needValues.hunger! <= 100;

  // Play raises mood; the hold window then completes the care loop.
  await harness.keyTap('KeyK');
  const played = (await read()).needs!;
  evidence.played = { mood: played.needValues.mood, actions: played.actionsTaken, hold: played.holdMs };
  const playOk = played.needValues.mood! > initial.needValues.mood! && played.actionsTaken >= 2;
  const complete = (await waitUntil(harness, read, (s) => s.needs?.outcome === 'complete', 80, 4)).needs!;
  evidence.complete = { outcome: complete.outcome, hold: complete.holdMs, affinity: complete.affinity };
  const completeOk = complete.outcome === 'complete' && complete.holdMs >= 1600 && complete.affinity > 0;

  const paused = await pauseResume(harness);
  const resumed = (await read()).needs!;
  const pauseOk = paused.pausedDuring && !paused.pausedAfter && resumed.outcome === 'complete';
  const run = await restartRun(harness);
  const fresh = (await read()).needs!;
  evidence.restart = { ...run, outcome: fresh.outcome, actions: fresh.actionsTaken, affinity: fresh.affinity };
  const restartOk = run.after === run.before + 1 && fresh.outcome === 'playing' && fresh.actionsTaken === 0 && fresh.affinity === 0;

  const passed = startedOk && decayOk && feedOk && playOk && completeOk && pauseOk && restartOk;
  return { passed, details: { ...evidence, startedOk, decayOk, feedOk, playOk, completeOk, pauseOk, restartOk } };
}
