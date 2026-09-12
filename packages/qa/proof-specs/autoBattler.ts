import type { Harness } from '../src/harness.ts';
import { restartRun, shellReader, startPlay, waitUntil } from '../src/journey.ts';
import { readSnapshot } from '../src/snapshot.ts';
import type { SmokeOutcome } from '../src/smokeRunner.ts';

interface Strategy {
  readonly active: boolean;
  readonly mode: string | null;
  readonly team: string | null;
  readonly fighter: string | null;
  readonly cpuHealth: number;
  readonly lastResult: string | null;
  readonly outcome: string;
}
interface Shell {
  readonly strategy?: Strategy;
}

export async function run(harness: Harness): Promise<SmokeOutcome> {
  const read = shellReader<Shell>(harness, 'game.ui-simulation-shell');
  const st = async () => (await read()).strategy!;
  const evidence: Record<string, unknown> = {};
  await startPlay(harness, 4);
  const booted = await readSnapshot(harness);
  const initial = await st();
  evidence.initial = initial;
  const startedOk =
    booted.installedPacks.includes('sw2d.strategy') &&
    booted.installedPacks.includes('sw2d.targeting') &&
    initial.mode === 'battler' && initial.outcome === 'playing' && initial.cpuHealth > 0;

  // Pick phase: nothing fights until the lineup is locked; fighter selection cycles the lineup.
  await harness.stepFrames(40);
  const waiting = await st();
  const pickPhaseOk = waiting.cpuHealth === initial.cpuHealth && waiting.outcome === 'playing';
  await harness.keyTap('ArrowRight');
  const picked = await st();
  evidence.picked = { fighter: picked.fighter, from: initial.fighter };
  const pickOk = picked.fighter !== null && picked.fighter !== initial.fighter;

  // CONFIRM locks the lineup and starts the autonomous fight (sw2d.targeting auto mode); the pick is frozen and
  // a second CONFIRM is not a strike.
  await harness.keyTap('Enter');
  const confirmed = await st();
  await harness.keyTap('ArrowRight');
  const locked = await st();
  await harness.keyTap('Enter');
  const again = await st();
  evidence.fight = { last: confirmed.lastResult, locked: locked.fighter, again: again.lastResult };
  const autoOk = confirmed.lastResult === 'fight' && locked.fighter === picked.fighter && again.lastResult === 'auto';
  const mid = (await waitUntil(harness, read, (s) => (s.strategy?.cpuHealth ?? 99) < initial.cpuHealth, 60, 4)).strategy!;
  evidence.mid = { cpuHealth: mid.cpuHealth, outcome: mid.outcome };
  const midOk = mid.cpuHealth < initial.cpuHealth && mid.cpuHealth > 0;
  const done = (await waitUntil(harness, read, (s) => s.strategy?.outcome === 'complete', 120, 4)).strategy!;
  evidence.done = { cpuHealth: done.cpuHealth, last: done.lastResult, outcome: done.outcome };
  const doneOk = done.outcome === 'complete' && done.lastResult === 'won' && done.cpuHealth <= 0;

  const run = await restartRun(harness);
  const fresh = await st();
  evidence.restart = { ...run, cpuHealth: fresh.cpuHealth, outcome: fresh.outcome };
  const restartOk = run.after === run.before + 1 && fresh.outcome === 'playing' && fresh.cpuHealth === initial.cpuHealth;

  const passed = startedOk && pickPhaseOk && pickOk && autoOk && midOk && doneOk && restartOk;
  return { passed, details: { ...evidence, startedOk, pickPhaseOk, pickOk, autoOk, midOk, doneOk, restartOk } };
}
