import type { Harness } from '../src/harness.ts';
import { holdUntil, restartRun, shellReader, startPlay } from '../src/journey.ts';
import { readSnapshot } from '../src/snapshot.ts';
import type { SmokeOutcome } from '../src/smokeRunner.ts';

interface Melee {
  readonly active: boolean;
  readonly mode: string | null;
  readonly playerHealth: number;
  readonly foesAlive: number;
  readonly lastResult: string | null;
  readonly outcome: string;
}
interface Shell {
  readonly x: number;
  readonly y: number;
  readonly melee?: Melee;
}

async function attack(harness: Harness, times: number): Promise<void> {
  for (let hit = 0; hit < times; hit++) {
    await harness.keyTap('KeyX');
    await harness.stepFrames(3);
  }
}

export async function run(harness: Harness): Promise<SmokeOutcome> {
  const read = shellReader<Shell>(harness, 'game.top-down-shell');
  const evidence: Record<string, unknown> = {};
  await startPlay(harness);
  const booted = await readSnapshot(harness);
  const initial = await read();
  evidence.initial = initial.melee;
  const startedOk = booted.installedPacks.includes('sw2d.melee') && initial.melee?.mode === 'arena' && initial.melee.foesAlive === 3 && initial.melee.outcome === 'playing';

  // Three foes around the arena; each falls to two strikes at close range.
  await holdUntil(harness, ['ArrowUp'], read, (s) => s.y <= 175, 50, 4);
  await holdUntil(harness, ['ArrowRight'], read, (s) => s.x >= 330, 50, 4);
  await attack(harness, 2);
  const first = (await read()).melee!;
  await holdUntil(harness, ['ArrowDown'], read, (s) => s.y >= 265, 45, 4);
  await holdUntil(harness, ['ArrowRight'], read, (s) => s.x >= 455, 45, 4);
  await attack(harness, 2);
  const second = (await read()).melee!;
  await attack(harness, 2);
  const victory = (await read()).melee!;
  evidence.first = first;
  evidence.second = second;
  evidence.victory = victory;
  const firstOk = first.foesAlive === 2 && first.outcome === 'playing';
  const secondOk = second.foesAlive === 1 && second.outcome === 'playing';
  const victoryOk = victory.foesAlive === 0 && victory.playerHealth > 0 && victory.outcome === 'complete';
  // Striking after the arena is cleared is inert.
  await attack(harness, 1);
  const after = (await read()).melee!;
  const inertOk = after.foesAlive === 0 && after.outcome === 'complete';

  const run = await restartRun(harness);
  const fresh = (await read()).melee!;
  evidence.restart = { ...run, foes: fresh.foesAlive, outcome: fresh.outcome };
  const restartOk = run.after === run.before + 1 && fresh.foesAlive === 3 && fresh.outcome === 'playing';

  const passed = startedOk && firstOk && secondOk && victoryOk && inertOk && restartOk;
  return { passed, details: { ...evidence, startedOk, firstOk, secondOk, victoryOk, inertOk, restartOk } };
}
