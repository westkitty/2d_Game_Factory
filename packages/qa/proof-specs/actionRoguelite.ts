import type { Harness } from '../src/harness.ts';
import { holdUntil, restartRun, shellReader, startPlay } from '../src/journey.ts';
import { readSnapshot } from '../src/snapshot.ts';
import type { SmokeOutcome } from '../src/smokeRunner.ts';

interface Progression {
  readonly active: boolean;
  readonly mode: string | null;
  readonly xp: number;
  readonly currency: number;
  readonly items: readonly string[];
  readonly unlocked: readonly string[];
  readonly nearId: string | null;
  readonly lastResult: string | null;
  readonly outcome: string;
}
interface Shell {
  readonly x: number;
  readonly y: number;
  readonly progression?: Progression;
  readonly generation?: { readonly valid?: boolean };
}

export async function run(harness: Harness): Promise<SmokeOutcome> {
  const read = shellReader<Shell>(harness, 'game.top-down-shell');
  const evidence: Record<string, unknown> = {};
  await startPlay(harness, 12);
  const booted = await readSnapshot(harness);
  const initial = await read();
  evidence.initial = { x: initial.x, progression: initial.progression, generation: initial.generation };
  const startedOk =
    booted.installedPacks.includes('sw2d.progression') && booted.installedPacks.includes('sw2d.generation') &&
    initial.progression?.mode === 'run' && initial.progression.items.length === 0 && initial.progression.currency === 0 && initial.x === 120;

  // Taking with no relic in reach is refused.
  await harness.keyTap('KeyJ');
  await harness.stepFrames(4);
  const tooFar = (await read()).progression!;
  const tooFarOk = tooFar.lastResult === 'too-far' && tooFar.items.length === 0;

  // Walk to the core relic and take it: item + currency, run still open.
  const atCore = await holdUntil(harness, ['ArrowRight'], read, (s) => s.progression?.nearId === 'core');
  await harness.keyTap('KeyJ');
  await harness.stepFrames(4);
  const core = (await read()).progression!;
  evidence.core = { x: atCore.x, progression: core };
  const coreOk = atCore.progression?.nearId === 'core' && core.lastResult === 'taken' && core.items.includes('core') && core.currency === 1 && core.outcome === 'playing';
  // Taking the same relic twice does not double-credit.
  await harness.keyTap('KeyJ');
  await harness.stepFrames(4);
  const again = (await read()).progression!;
  const noDoubleOk = again.currency === 1 && again.items.length === 1;

  // The second relic clears the run: XP, unlock flag, complete.
  const atSpark = await holdUntil(harness, ['ArrowRight'], read, (s) => s.progression?.nearId === 'spark');
  await harness.keyTap('KeyJ');
  await harness.stepFrames(4);
  const done = (await read()).progression!;
  evidence.done = { x: atSpark.x, progression: done };
  const doneOk = done.lastResult === 'cleared' && done.items.includes('spark') && done.currency === 2 && done.xp === 10 && done.unlocked.includes('run-cleared') && done.outcome === 'complete';

  const run = await restartRun(harness);
  const fresh = await read();
  evidence.restart = { ...run, x: fresh.x, progression: fresh.progression };
  const restartOk = run.after === run.before + 1 && fresh.progression?.items.length === 0 && fresh.progression.currency === 0 && fresh.progression.outcome === 'playing' && fresh.x === 120;

  const passed = startedOk && tooFarOk && coreOk && noDoubleOk && doneOk && restartOk;
  return { passed, details: { ...evidence, startedOk, tooFarOk, coreOk, noDoubleOk, doneOk, restartOk } };
}
