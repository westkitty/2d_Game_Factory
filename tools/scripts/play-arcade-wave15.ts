import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { findSystemChrome, readShellState, runSmoke, type Harness, type SmokeOutcome } from '@sw2d/qa';

/**
 * Category-C Wave 15 play journeys against factory-generated games
 * (not starter-kit overlays). Proves two different sw2d.arcade
 * presentations: timed bite fishing vs ordered-recipe cooking.
 */

const REPO_ROOT = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '../..');

interface ArcadeSnap {
  readonly active: boolean;
  readonly mode: string | null;
  readonly score: number;
  readonly elapsedMs: number;
  readonly phase: string;
  readonly caught: number;
  readonly missed: number;
  readonly selectedIndex: number;
  readonly recipeStep: number;
  readonly mistakes: number;
  readonly lastResult: string | null;
  readonly outcome: string;
}

interface UiShell {
  readonly arcade?: ArcadeSnap;
}

async function start(harness: Harness): Promise<void> {
  await harness.keyTap('Space');
  await harness.stepFrames(12);
}

async function snapArcade(harness: Harness): Promise<ArcadeSnap | undefined> {
  return (await readShellState<UiShell>(harness, 'game.ui-simulation-shell')).arcade;
}

async function waitPhase(harness: Harness, phase: string, maxSteps = 90): Promise<ArcadeSnap | undefined> {
  let state = await snapArcade(harness);
  for (let step = 0; step < maxSteps && state?.phase !== phase; step++) {
    await harness.stepFrames(2);
    state = await snapArcade(harness);
  }
  return state;
}

async function fishingRun(harness: Harness): Promise<SmokeOutcome> {
  await start(harness);
  const initial = await snapArcade(harness);

  await harness.keyTap('Enter');
  await harness.stepFrames(4);
  const cast = await snapArcade(harness);
  const bite = await waitPhase(harness, 'bite');
  const missed = await waitPhase(harness, 'idle');

  await harness.keyTap('Enter');
  await harness.stepFrames(4);
  const recast = await waitPhase(harness, 'bite');
  await harness.keyTap('Enter');
  await harness.stepFrames(4);
  const first = await snapArcade(harness);

  const idle = await waitPhase(harness, 'idle');
  await harness.keyTap('Enter');
  await harness.stepFrames(4);
  const secondBite = await waitPhase(harness, 'bite');
  await harness.keyTap('Enter');
  await harness.stepFrames(4);
  const done = await snapArcade(harness);

  const passed =
    initial?.mode === 'fishing' &&
    initial.phase === 'idle' &&
    initial.caught === 0 &&
    initial.score === 0 &&
    initial.outcome === 'playing' &&
    (cast?.lastResult === 'cast' || bite?.phase === 'bite') &&
    bite?.phase === 'bite' &&
    missed?.lastResult === 'missed' &&
    missed.phase === 'idle' &&
    missed.missed >= 1 &&
    recast?.phase === 'bite' &&
    first?.lastResult === 'landed' &&
    first.caught === 1 &&
    first.score === 50 &&
    idle?.phase === 'idle' &&
    secondBite?.phase === 'bite' &&
    done?.lastResult === 'landed' &&
    done.caught === 2 &&
    done.score === 100 &&
    done.outcome === 'complete';
  return { passed, details: { initial, cast, bite, missed, recast, first, idle, secondBite, done } };
}

async function cookingRun(harness: Harness): Promise<SmokeOutcome> {
  await start(harness);
  const initial = await snapArcade(harness);

  await harness.keyTap('ArrowRight');
  await harness.stepFrames(2);
  const pickedEgg = await snapArcade(harness);
  await harness.keyTap('Enter');
  await harness.stepFrames(4);
  const wrong = await snapArcade(harness);

  await harness.keyTap('ArrowLeft');
  await harness.stepFrames(2);
  await harness.keyTap('Enter');
  await harness.stepFrames(4);
  const flour = await snapArcade(harness);

  await harness.keyTap('ArrowRight');
  await harness.stepFrames(2);
  await harness.keyTap('Enter');
  await harness.stepFrames(4);
  const egg = await snapArcade(harness);

  await harness.keyTap('ArrowRight');
  await harness.stepFrames(2);
  await harness.keyTap('Enter');
  await harness.stepFrames(4);
  const done = await snapArcade(harness);

  const passed =
    initial?.mode === 'cooking' &&
    initial.phase === 'cook' &&
    initial.selectedIndex === 0 &&
    initial.recipeStep === 0 &&
    initial.score === 0 &&
    initial.outcome === 'playing' &&
    pickedEgg?.selectedIndex === 1 &&
    wrong?.lastResult === 'wrong' &&
    wrong.mistakes === 1 &&
    wrong.recipeStep === 0 &&
    flour?.lastResult === 'added' &&
    flour.recipeStep === 1 &&
    egg?.lastResult === 'added' &&
    egg.recipeStep === 2 &&
    done?.lastResult === 'ready' &&
    done.recipeStep === 3 &&
    done.mistakes === 1 &&
    done.score === 80 &&
    done.outcome === 'complete';
  return { passed, details: { initial, pickedEgg, wrong, flour, egg, done } };
}

async function main(): Promise<number> {
  if (!findSystemChrome()) {
    console.error('Wave-15 play is INCOMPLETE: no system Chrome found.');
    return 1;
  }
  const games = [
    { id: 'wave15-fishing-game', run: fishingRun },
    { id: 'wave15-cooking-game', run: cookingRun },
  ] as const;
  let failed = 0;
  for (const game of games) {
    process.stdout.write(`Playing ${game.id}...\n`);
    const result = await runSmoke({
      id: game.id,
      buildDir: path.join(REPO_ROOT, 'games', game.id, 'dist'),
      run: game.run,
    });
    const ok = result.passed;
    if (!ok) failed += 1;
    console.log(
      `[${ok ? 'PASS' : 'FAIL'}] ${game.id} console=${JSON.stringify(result.consoleErrors)} external=${JSON.stringify(result.externalRequests)} details=${JSON.stringify(result.details)}`,
    );
  }
  console.log(`\n${games.length - failed}/${games.length} Wave-15 generated games played.`);
  return failed === 0 ? 0 : 1;
}

process.exit(await main());
