import type { Harness } from '../src/harness.ts';
import { pauseResume, restartRun, shellReader, startPlay, waitUntil } from '../src/journey.ts';
import { readSnapshot } from '../src/snapshot.ts';
import type { SmokeOutcome } from '../src/smokeRunner.ts';

interface Progression {
  readonly active: boolean;
  readonly mode: string | null;
  readonly xp: number;
  readonly kills: number;
  readonly unlocked: readonly string[];
  readonly lastResult: string | null;
  readonly outcome: string;
}
interface Battle {
  readonly projectilesSpawned: number;
  readonly enemiesAlive: number;
  readonly kills: number;
  readonly playerDeaths: number;
  readonly playerHealth: { readonly current: number; readonly max: number } | null;
}
interface Shell {
  readonly x: number;
  readonly y: number;
  readonly progression?: Progression;
  readonly battle?: Battle;
}

export async function run(harness: Harness): Promise<SmokeOutcome> {
  const read = shellReader<Shell>(harness, 'game.top-down-shell');
  const evidence: Record<string, unknown> = {};
  await startPlay(harness, 4);
  const booted = await readSnapshot(harness);
  const initial = await read();
  evidence.initial = { progression: initial.progression, battle: initial.battle };
  const startedOk =
    booted.installedPacks.includes('sw2d.progression') && booted.installedPacks.includes('sw2d.encounters') &&
    initial.progression?.mode === 'survive' && initial.progression.xp === 0 && initial.progression.outcome === 'playing' &&
    (initial.battle?.enemiesAlive ?? 0) >= 1;

  // Survival XP ticks on the clock, but slowly: a second in is still far from the surge.
  await harness.stepFrames(62);
  const ticked = (await read()).progression!;
  evidence.ticked = { xp: ticked.xp, last: ticked.lastResult, outcome: ticked.outcome };
  const tickOk = ticked.xp >= 1 && ticked.xp < 6 && ticked.outcome === 'playing';

  // Pause freezes the survival clock.
  const paused = await pauseResume(harness);
  const afterPause = (await read()).progression!;
  const pauseOk = paused.pausedDuring && !paused.pausedAfter && afterPause.xp === ticked.xp;

  // Fight: the swarm spawns at the top edge and chases. Aim up (AIM_UP, independent of movement)
  // and hold fire; a kill is worth 2 XP and reports 'kill'.
  await harness.keyDown('Numpad8');
  await harness.keyDown('KeyJ');
  const killed = await waitUntil(harness, read, (s) => (s.progression?.kills ?? 0) >= 1, 120, 4);
  evidence.killed = { progression: killed.progression, battle: killed.battle };
  const killOk = (killed.progression?.kills ?? 0) >= 1 && (killed.battle?.kills ?? 0) >= 1 && (killed.battle?.projectilesSpawned ?? 0) >= 1;

  // Kills + survival reach the surge unlock.
  const done = await waitUntil(harness, read, (s) => s.progression?.outcome === 'complete', 160, 4);
  await harness.keyUp('KeyJ');
  await harness.keyUp('Numpad8');
  evidence.done = { progression: done.progression, battle: done.battle };
  const doneOk = done.progression?.outcome === 'complete' && done.progression.unlocked.includes('surge') && done.progression.lastResult === 'surged' && done.progression.xp >= 6;

  const run = await restartRun(harness);
  const fresh = (await read()).progression!;
  evidence.restart = { ...run, xp: fresh.xp, kills: fresh.kills, outcome: fresh.outcome };
  const restartOk = run.after === run.before + 1 && fresh.xp === 0 && fresh.kills === 0 && fresh.outcome === 'playing';

  const passed = startedOk && tickOk && pauseOk && killOk && doneOk && restartOk;
  return { passed, details: { ...evidence, startedOk, tickOk, pauseOk, killOk, doneOk, restartOk } };
}
