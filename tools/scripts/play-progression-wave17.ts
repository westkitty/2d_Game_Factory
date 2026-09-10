import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { findSystemChrome, readShellState, runSmoke, type Harness, type SmokeOutcome } from '@sw2d/qa';

/**
 * Category-C Wave 17 play journeys against factory-generated games
 * (not starter-kit overlays). Proves two different sw2d.progression
 * presentations: in-run XP while surviving vs walk-and-take relics.
 */

const REPO_ROOT = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '../..');

interface ProgressionSnap {
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

interface TopDownShell {
  readonly x: number;
  readonly y: number;
  readonly progression?: ProgressionSnap;
}

async function start(harness: Harness): Promise<void> {
  await harness.keyTap('Space');
  await harness.stepFrames(12);
}

async function snapShell(harness: Harness): Promise<TopDownShell> {
  return readShellState<TopDownShell>(harness, 'game.top-down-shell');
}

async function waitUntil(
  harness: Harness,
  predicate: (state: TopDownShell) => boolean,
  maxSteps = 80,
  framesPerStep = 4,
): Promise<TopDownShell> {
  let state = await snapShell(harness);
  for (let step = 0; step < maxSteps && !predicate(state); step++) {
    await harness.stepFrames(framesPerStep);
    state = await snapShell(harness);
  }
  return state;
}

async function holdUntil(
  harness: Harness,
  code: string,
  predicate: (state: TopDownShell) => boolean,
  maxSteps = 80,
  framesPerStep = 4,
): Promise<TopDownShell> {
  await harness.keyDown(code);
  try {
    let state = await snapShell(harness);
    for (let step = 0; step < maxSteps && !predicate(state); step++) {
      await harness.stepFrames(framesPerStep);
      state = await snapShell(harness);
    }
  } finally {
    await harness.keyUp(code);
  }
  await harness.stepFrames(2);
  return snapShell(harness);
}

async function surviveRun(harness: Harness): Promise<SmokeOutcome> {
  await start(harness);
  const initial = await snapShell(harness);
  const done = await waitUntil(harness, (s) => s.progression?.outcome === 'complete');

  const passed =
    initial.progression?.mode === 'survive' &&
    initial.progression.xp === 0 &&
    initial.progression.outcome === 'playing' &&
    (done.progression?.xp ?? 0) >= 2 &&
    done.progression?.unlocked.includes('surge') === true &&
    done.progression.lastResult === 'surged' &&
    done.progression.outcome === 'complete';
  return { passed, details: { initial: initial.progression, done: done.progression } };
}

async function runRun(harness: Harness): Promise<SmokeOutcome> {
  await start(harness);
  const initial = await snapShell(harness);

  await harness.keyTap('KeyJ');
  await harness.stepFrames(4);
  const tooFar = await snapShell(harness);

  const atCore = await holdUntil(harness, 'ArrowRight', (s) => s.progression?.nearId === 'core');
  await harness.keyTap('KeyJ');
  await harness.stepFrames(4);
  const core = await snapShell(harness);

  const atSpark = await holdUntil(harness, 'ArrowRight', (s) => s.progression?.nearId === 'spark');
  await harness.keyTap('KeyJ');
  await harness.stepFrames(4);
  const done = await snapShell(harness);

  const passed =
    initial.progression?.mode === 'run' &&
    initial.progression.items.length === 0 &&
    initial.progression.currency === 0 &&
    initial.x === 120 &&
    tooFar.progression?.lastResult === 'too-far' &&
    atCore.progression?.nearId === 'core' &&
    core.progression?.lastResult === 'taken' &&
    core.progression.items.includes('core') &&
    core.progression.currency === 1 &&
    core.progression.outcome === 'playing' &&
    atSpark.progression?.nearId === 'spark' &&
    done.progression?.lastResult === 'cleared' &&
    done.progression.items.includes('core') &&
    done.progression.items.includes('spark') &&
    done.progression.currency === 2 &&
    done.progression.xp === 10 &&
    done.progression.unlocked.includes('run-cleared') &&
    done.progression.outcome === 'complete';
  return {
    passed,
    details: {
      initial: { x: initial.x, progression: initial.progression },
      tooFar: tooFar.progression,
      atCore: { x: atCore.x, progression: atCore.progression },
      core: core.progression,
      atSpark: { x: atSpark.x, progression: atSpark.progression },
      done: done.progression,
    },
  };
}

async function main(): Promise<number> {
  if (!findSystemChrome()) {
    console.error('Wave-17 play is INCOMPLETE: no system Chrome found.');
    return 1;
  }
  const games = [
    { id: 'wave17-survivor-like', run: surviveRun },
    { id: 'wave17-action-roguelite', run: runRun },
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
  console.log(`\n${games.length - failed}/${games.length} Wave-17 generated games played.`);
  return failed === 0 ? 0 : 1;
}

process.exit(await main());
