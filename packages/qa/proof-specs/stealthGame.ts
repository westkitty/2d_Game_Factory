import type { Harness } from '../src/harness.ts';
import { holdUntil, restartRun, shellReader, startPlay } from '../src/journey.ts';
import { readSnapshot } from '../src/snapshot.ts';
import type { SmokeOutcome } from '../src/smokeRunner.ts';

interface Perception {
  readonly active: boolean;
  readonly mode: string | null;
  readonly hidden: boolean;
  readonly seen: boolean;
  readonly alarm: boolean;
  readonly suspicion: number;
  readonly objectiveCollected: boolean;
  readonly outcome: string;
  readonly lastResult: string | null;
}
interface Shell {
  readonly x: number;
  readonly y: number;
  readonly perception?: Perception;
}

export async function run(harness: Harness): Promise<SmokeOutcome> {
  const read = shellReader<Shell>(harness, 'game.top-down-shell');
  const evidence: Record<string, unknown> = {};
  await startPlay(harness);
  const booted = await readSnapshot(harness);
  const initial = await read();
  evidence.initial = initial.perception;
  const startedOk = booted.installedPacks.includes('sw2d.perception') && initial.perception?.mode === 'infiltrate' && initial.perception.outcome === 'playing' && !initial.perception.seen;

  // Walk straight into the guard's vision cone: seen -> failed.
  const spotted = await holdUntil(harness, ['ArrowRight'], read, (s) => s.perception?.outcome === 'failed', 80, 4);
  evidence.spotted = spotted.perception;
  const spottedOk = spotted.perception?.seen === true && spotted.perception.outcome === 'failed' && spotted.perception.suspicion > 0;

  // Restart reinstalls: not seen, objective not collected.
  const run = await restartRun(harness);
  const fresh = await read();
  evidence.restart = { ...run, perception: fresh.perception };
  const restartOk = run.after === run.before + 1 && fresh.perception?.outcome === 'playing' && !fresh.perception.seen && !fresh.perception.objectiveCollected;

  // Sneak: go up out of the cone, reach the loot unseen, return to the exit with no alarm.
  await holdUntil(harness, ['ArrowUp'], read, (s) => s.y <= 120, 60, 4);
  const loot = await holdUntil(harness, ['ArrowRight'], read, (s) => s.perception?.objectiveCollected === true, 140, 4);
  evidence.loot = loot.perception;
  const lootOk = loot.perception?.objectiveCollected === true && loot.perception.alarm === false && loot.perception.outcome === 'playing';
  await holdUntil(harness, ['ArrowUp'], read, (s) => s.y <= 100, 40, 4);
  const escaped = await holdUntil(harness, ['ArrowLeft'], read, (s) => s.perception?.outcome === 'complete', 160, 4);
  evidence.escaped = escaped.perception;
  const escapedOk = escaped.perception?.outcome === 'complete' && escaped.perception.alarm === false;

  const passed = startedOk && spottedOk && restartOk && lootOk && escapedOk;
  return { passed, details: { ...evidence, startedOk, spottedOk, restartOk, lootOk, escapedOk } };
}
