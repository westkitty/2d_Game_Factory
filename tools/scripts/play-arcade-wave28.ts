import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { findSystemChrome, readShellState, runSmoke, type Harness, type SmokeOutcome } from '@sw2d/qa';

/**
 * Category-C Wave 28 play journey against a factory-generated game
 * (not a starter-kit overlay). Proves a third sw2d.arcade presentation:
 * tap-then-mash microgame rounds. Not a scheduler pack.
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
  readonly round: number;
  readonly mash: number;
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

async function microRun(harness: Harness): Promise<SmokeOutcome> {
  await start(harness);
  const initial = await snapArcade(harness);

  const go = await waitPhase(harness, 'go');
  await harness.keyTap('Enter');
  await harness.stepFrames(4);
  const tapped = await snapArcade(harness);

  for (let i = 0; i < 5; i++) {
    await harness.keyTap('KeyJ');
    await harness.stepFrames(2);
  }
  const done = await snapArcade(harness);

  const passed =
    initial?.mode === 'micro' &&
    initial.phase === 'wait' &&
    initial.round === 1 &&
    initial.mash === 0 &&
    initial.score === 0 &&
    initial.outcome === 'playing' &&
    go?.phase === 'go' &&
    go.lastResult === 'go' &&
    tapped?.lastResult === 'tapped' &&
    tapped.phase === 'mash' &&
    tapped.round === 2 &&
    tapped.score === 50 &&
    done?.lastResult === 'set' &&
    done.mash === 5 &&
    done.round === 2 &&
    done.score === 100 &&
    done.outcome === 'complete';
  return { passed, details: { initial, go, tapped, done } };
}

async function main(): Promise<number> {
  if (!findSystemChrome()) {
    console.error('Wave-28 play is INCOMPLETE: no system Chrome found.');
    return 1;
  }
  const games = [{ id: 'wave28-microgame-collection', run: microRun }] as const;
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
  console.log(`\n${games.length - failed}/${games.length} Wave-28 generated games played.`);
  return failed === 0 ? 0 : 1;
}

process.exit(await main());
