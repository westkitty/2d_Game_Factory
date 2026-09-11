import type { Harness } from '../src/harness.ts';
import { holdUntil, restartRun, shellReader, startPlay } from '../src/journey.ts';
import { readSnapshot } from '../src/snapshot.ts';
import type { SmokeOutcome } from '../src/smokeRunner.ts';

interface Combat {
  readonly active: boolean;
  readonly mode: string | null;
  readonly playerHealth: number;
  readonly baseHealth: number;
  readonly foesAlive: number;
  readonly nearId: string | null;
  readonly lastResult: string | null;
  readonly outcome: string;
}
interface Shell {
  readonly x: number;
  readonly y: number;
  readonly combat?: Combat;
}

async function strikeTwice(harness: Harness, read: () => Promise<Shell>): Promise<Shell> {
  await harness.keyTap('KeyJ');
  await harness.stepFrames(12);
  await harness.keyTap('KeyJ');
  await harness.stepFrames(12);
  return read();
}

export async function run(harness: Harness): Promise<SmokeOutcome> {
  const read = shellReader<Shell>(harness, 'game.top-down-shell');
  const evidence: Record<string, unknown> = {};
  await startPlay(harness, 12);
  const booted = await readSnapshot(harness);
  const initial = await read();
  evidence.initial = { x: initial.x, combat: initial.combat };
  const startedOk = booted.installedPacks.includes('sw2d.combat') && initial.combat?.mode === 'hold' && initial.combat.foesAlive === 2 && initial.combat.baseHealth === 3 && initial.x === 480;

  // A swing with no raider in reach misses.
  await harness.keyTap('KeyJ');
  await harness.stepFrames(4);
  const miss = (await read()).combat!;
  const missOk = miss.lastResult === 'miss' && miss.foesAlive === 2;

  // Intercept the first raider marching on the base and kill it.
  const atFirst = await holdUntil(harness, ['ArrowLeft'], read, (s) => s.combat?.nearId === 'raider' || s.combat?.nearId === 'raider-2');
  const firstId = atFirst.combat?.nearId;
  const afterFirst = await strikeTwice(harness, read);
  evidence.first = { id: firstId, at: { x: atFirst.x, y: atFirst.y }, combat: afterFirst.combat };
  const firstOk = (firstId === 'raider' || firstId === 'raider-2') && afterFirst.combat?.foesAlive === 1 && afterFirst.combat.outcome === 'playing';

  // Then the second; the base is never breached.
  const atSecond = await holdUntil(harness, [atFirst.y < 270 ? 'ArrowDown' : 'ArrowUp'], read, (s) => Boolean(s.combat?.nearId && s.combat.nearId !== firstId));
  const done = await strikeTwice(harness, read);
  evidence.done = { at: { x: atSecond.x, y: atSecond.y, near: atSecond.combat?.nearId }, combat: done.combat };
  const doneOk = Boolean(atSecond.combat?.nearId) && done.combat?.foesAlive === 0 && done.combat.outcome === 'complete' && done.combat.baseHealth === 3;

  const run = await restartRun(harness);
  const fresh = await read();
  evidence.restart = { ...run, x: fresh.x, combat: fresh.combat };
  const restartOk = run.after === run.before + 1 && fresh.combat?.foesAlive === 2 && fresh.combat.baseHealth === 3 && fresh.combat.outcome === 'playing' && fresh.x === 480;

  const passed = startedOk && missOk && firstOk && doneOk && restartOk;
  return { passed, details: { ...evidence, startedOk, missOk, firstOk, doneOk, restartOk } };
}
