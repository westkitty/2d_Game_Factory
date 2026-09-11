import type { Harness } from '../src/harness.ts';
import { holdUntil, restartRun, shellReader, startPlay } from '../src/journey.ts';
import { readSnapshot } from '../src/snapshot.ts';
import type { SmokeOutcome } from '../src/smokeRunner.ts';

interface Perception {
  readonly active: boolean;
  readonly mode: string | null;
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
  const startedOk = booted.installedPacks.includes('sw2d.perception') && initial.perception?.mode === 'heist' && initial.perception.outcome === 'playing' && !initial.perception.alarm;

  // The exit is not a win before the loot is taken.
  await holdUntil(harness, ['ArrowUp'], read, (s) => s.y <= 100, 55, 4);
  await harness.stepFrames(3);
  const blocked = await read();
  evidence.blocked = blocked.perception;
  const blockedOk = blocked.perception?.objectiveCollected === false && blocked.perception.outcome === 'playing';

  // Grab the loot: the heist alarm trips (that is the mode's difference from infiltrate).
  await holdUntil(harness, ['ArrowRight'], read, (s) => s.x >= 760, 120, 4);
  const stolen = await holdUntil(harness, ['ArrowDown'], read, (s) => s.perception?.objectiveCollected === true, 40, 3);
  evidence.stolen = stolen.perception;
  const stolenOk = stolen.perception?.objectiveCollected === true && stolen.perception.alarm === true && stolen.perception.outcome === 'playing';

  // Escape under alarm.
  await holdUntil(harness, ['ArrowUp'], read, (s) => s.y <= 100, 40, 3);
  const escaped = await holdUntil(harness, ['ArrowLeft'], read, (s) => s.perception?.outcome === 'complete', 160, 4);
  evidence.escaped = escaped.perception;
  const escapedOk = escaped.perception?.outcome === 'complete' && escaped.perception.alarm === true;

  const run = await restartRun(harness);
  const fresh = await read();
  evidence.restart = { ...run, perception: fresh.perception };
  const restartOk = run.after === run.before + 1 && fresh.perception?.outcome === 'playing' && !fresh.perception.alarm && !fresh.perception.objectiveCollected;

  const passed = startedOk && blockedOk && stolenOk && escapedOk && restartOk;
  return { passed, details: { ...evidence, startedOk, blockedOk, stolenOk, escapedOk, restartOk } };
}
