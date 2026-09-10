import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { findSystemChrome, readShellState, runSmoke, type Harness, type SmokeOutcome } from '@sw2d/qa';

/**
 * Category-C Wave 26 play journeys against factory-generated games.
 * Museum plaques vs approaching rail targets.
 */

const REPO_ROOT = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '../..');

interface LookSnap {
  readonly active: boolean;
  readonly mode: string | null;
  readonly inspected: number;
  readonly foesAlive: number;
  readonly nearId: string | null;
  readonly lastResult: string | null;
  readonly outcome: string;
}

interface TopDownShell {
  readonly x: number;
  readonly look?: LookSnap;
}

interface PointerShell {
  readonly look?: LookSnap;
}

async function start(harness: Harness): Promise<void> {
  await harness.keyTap('Space');
  await harness.stepFrames(12);
}

async function holdUntil(
  harness: Harness,
  codes: readonly string[],
  predicate: (state: TopDownShell) => boolean,
  maxSteps = 140,
  framesPerStep = 4,
): Promise<TopDownShell> {
  for (const code of codes) await harness.keyDown(code);
  try {
    let state = await readShellState<TopDownShell>(harness, 'game.top-down-shell');
    for (let step = 0; step < maxSteps && !predicate(state); step++) {
      await harness.stepFrames(framesPerStep);
      state = await readShellState<TopDownShell>(harness, 'game.top-down-shell');
    }
    return state;
  } finally {
    for (const code of [...codes].reverse()) await harness.keyUp(code);
    await harness.stepFrames(2);
  }
}

async function museumRun(harness: Harness): Promise<SmokeOutcome> {
  await start(harness);
  const initial = await readShellState<TopDownShell>(harness, 'game.top-down-shell');
  await harness.keyTap('KeyJ');
  await harness.stepFrames(4);
  const tooFar = await readShellState<TopDownShell>(harness, 'game.top-down-shell');
  const atPlinth = await holdUntil(harness, ['ArrowRight'], (s) => s.look?.nearId === 'plinth' || s.x >= 240);
  await harness.keyTap('KeyJ');
  await harness.stepFrames(4);
  const one = await readShellState<TopDownShell>(harness, 'game.top-down-shell');
  const atBust = await holdUntil(harness, ['ArrowRight'], (s) => s.look?.nearId === 'bust' || s.x >= 660);
  await harness.keyTap('KeyJ');
  await harness.stepFrames(6);
  const done = await readShellState<TopDownShell>(harness, 'game.top-down-shell');
  const passed =
    initial.look?.mode === 'museum' &&
    initial.look.inspected === 0 &&
    initial.look.outcome === 'playing' &&
    tooFar.look?.lastResult === 'too-far' &&
    (one.look?.inspected ?? 0) >= 1 &&
    done.look?.outcome === 'complete' &&
    done.look.inspected === 2 &&
    done.look.lastResult === 'read';
  return {
    passed,
    details: {
      initial: initial.look,
      tooFar: tooFar.look,
      atPlinth: { x: atPlinth.x, look: atPlinth.look },
      one: one.look,
      atBust: { x: atBust.x, look: atBust.look },
      done: done.look,
    },
  };
}

async function railRun(harness: Harness): Promise<SmokeOutcome> {
  await start(harness);
  const initial = await readShellState<PointerShell>(harness, 'game.pointer-shell');
  let live = initial;
  for (let step = 0; step < 200 && live.look?.outcome !== 'complete'; step++) {
    if (live.look?.nearId) await harness.keyTap('KeyJ');
    await harness.stepFrames(4);
    live = await readShellState<PointerShell>(harness, 'game.pointer-shell');
  }
  const passed =
    initial.look?.mode === 'rail' &&
    initial.look.foesAlive === 2 &&
    initial.look.outcome === 'playing' &&
    live.look?.outcome === 'complete' &&
    live.look.foesAlive === 0 &&
    live.look.lastResult === 'cleared';
  return { passed, details: { initial: initial.look, done: live.look } };
}

async function main(): Promise<number> {
  if (!findSystemChrome()) {
    console.error('Wave-26 play is INCOMPLETE: no system Chrome found.');
    return 1;
  }
  const games = [
    { id: 'wave26-museum-exhibit', run: museumRun },
    { id: 'wave26-rail-shooter', run: railRun },
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
  console.log(`\n${games.length - failed}/${games.length} Wave-26 generated games played.`);
  return failed === 0 ? 0 : 1;
}

process.exit(await main());
