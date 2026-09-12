import type { Harness } from '../src/harness.ts';
import { restartRun, shellReader, startPlay } from '../src/journey.ts';
import { readSnapshot } from '../src/snapshot.ts';
import type { SmokeOutcome } from '../src/smokeRunner.ts';

interface Arcade {
  readonly active: boolean;
  readonly mode: string | null;
  readonly score: number;
  readonly phase: string;
  readonly selectedIndex: number;
  readonly recipeStep: number;
  readonly mistakes: number;
  readonly lastResult: string | null;
  readonly outcome: string;
}
interface Shell {
  readonly arcade?: Arcade;
}

export async function run(harness: Harness): Promise<SmokeOutcome> {
  const read = shellReader<Shell>(harness, 'game.ui-simulation-shell');
  const a = async () => (await read()).arcade!;
  const evidence: Record<string, unknown> = {};
  await startPlay(harness, 12);
  const booted = await readSnapshot(harness);
  const initial = await a();
  evidence.initial = initial;
  const startedOk = booted.installedPacks.includes('sw2d.arcade') && initial.mode === 'cooking' && initial.phase === 'cook' && initial.recipeStep === 0 && initial.score === 0;

  // Adding the wrong ingredient first is a counted mistake and does not advance the recipe.
  await harness.keyTap('ArrowRight');
  await harness.keyTap('Enter');
  const wrong = await a();
  evidence.wrong = { last: wrong.lastResult, mistakes: wrong.mistakes, step: wrong.recipeStep };
  const wrongOk = wrong.lastResult === 'wrong' && wrong.mistakes === 1 && wrong.recipeStep === 0;

  // The ordered sequence flour -> egg -> next advances the recipe step by step.
  await harness.keyTap('ArrowLeft');
  await harness.keyTap('Enter');
  const flour = await a();
  await harness.keyTap('ArrowRight');
  await harness.keyTap('Enter');
  const egg = await a();
  evidence.steps = [
    { last: flour.lastResult, step: flour.recipeStep },
    { last: egg.lastResult, step: egg.recipeStep },
  ];
  const orderOk = flour.lastResult === 'added' && flour.recipeStep === 1 && egg.lastResult === 'added' && egg.recipeStep === 2;
  await harness.keyTap('ArrowRight');
  await harness.keyTap('Enter');
  const done = await a();
  evidence.done = { last: done.lastResult, step: done.recipeStep, mistakes: done.mistakes, score: done.score, outcome: done.outcome };
  const doneOk = done.lastResult === 'ready' && done.recipeStep === 3 && done.mistakes === 1 && done.score > 0 && done.outcome === 'complete';

  const run = await restartRun(harness);
  const fresh = await a();
  evidence.restart = { ...run, step: fresh.recipeStep, mistakes: fresh.mistakes, score: fresh.score, outcome: fresh.outcome };
  const restartOk = run.after === run.before + 1 && fresh.recipeStep === 0 && fresh.mistakes === 0 && fresh.score === 0 && fresh.outcome === 'playing';

  const passed = startedOk && wrongOk && orderOk && doneOk && restartOk;
  return { passed, details: { ...evidence, startedOk, wrongOk, orderOk, doneOk, restartOk } };
}
