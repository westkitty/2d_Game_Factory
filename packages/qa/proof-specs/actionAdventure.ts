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

export async function run(harness: Harness): Promise<SmokeOutcome> {
  const read = shellReader<Shell>(harness, 'game.top-down-shell');
  const evidence: Record<string, unknown> = {};
  await startPlay(harness);
  const booted = await readSnapshot(harness);
  const initial = await read();
  evidence.initial = { x: initial.x, melee: initial.melee };
  const startedOk = booted.installedPacks.includes('sw2d.melee') && initial.melee?.mode === 'skirmish' && initial.melee.foesAlive === 1 && initial.melee.playerHealth === 5;

  // Swinging at nothing is a whiff, not a hit.
  await harness.keyTap('KeyX');
  await harness.stepFrames(3);
  const whiff = (await read()).melee!;
  evidence.whiff = whiff;
  const whiffOk = whiff.foesAlive === 1 && whiff.lastResult !== 'hit';

  // Close the distance, strike three times: the foe takes knockback/hit-stun and dies; the room clears.
  const approach = await holdUntil(harness, ['ArrowRight'], read, (s) => s.x >= 350, 60, 4);
  const approachOk = approach.x >= 350;
  await harness.keyTap('KeyX');
  await harness.stepFrames(3);
  const first = (await read()).melee!;
  evidence.first = first;
  const firstOk = first.lastResult === 'hit' && first.foesAlive === 1 && first.outcome === 'playing';
  await harness.keyTap('KeyX');
  await harness.stepFrames(3);
  await harness.keyTap('KeyX');
  await harness.stepFrames(3);
  const cleared = (await read()).melee!;
  evidence.cleared = cleared;
  const clearedOk = cleared.foesAlive === 0 && cleared.lastResult === 'hit' && cleared.playerHealth > 0 && cleared.outcome === 'complete';

  const run = await restartRun(harness);
  const fresh = await read();
  evidence.restart = { ...run, x: fresh.x, melee: fresh.melee };
  const restartOk = run.after === run.before + 1 && fresh.melee?.foesAlive === 1 && fresh.melee.outcome === 'playing' && fresh.x === initial.x;

  const passed = startedOk && whiffOk && approachOk && firstOk && clearedOk && restartOk;
  return { passed, details: { ...evidence, startedOk, whiffOk, approachOk, firstOk, clearedOk, restartOk } };
}
