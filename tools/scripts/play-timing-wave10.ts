import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { findSystemChrome, readShellState, runSmoke, type Harness, type SmokeOutcome } from '@sw2d/qa';

/**
 * Category-C Wave 10 play journeys against factory-generated games
 * (not starter-kit overlays). Proves reaction delay/false-start vs
 * rhythm in-window hits through sw2d.timing.
 */

const REPO_ROOT = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '../..');

interface TimingSnap {
  readonly active: boolean;
  readonly mode: string | null;
  readonly phase: string;
  readonly windowOpen: boolean;
  readonly elapsedMs: number;
  readonly hits: number;
  readonly misses: number;
  readonly lastResult: string | null;
  readonly lastLatencyMs: number | null;
  readonly nextBeatInMs: number | null;
  readonly cueIndex: number;
  readonly outcome: string;
}

interface UiShell {
  readonly selectionIndex?: number;
  readonly confirmed?: boolean;
  readonly timing?: TimingSnap;
}

async function start(harness: Harness): Promise<void> {
  await harness.keyTap('Space');
  await harness.stepFrames(24);
}

async function waitTiming(
  harness: Harness,
  predicate: (state: UiShell) => boolean,
  maxSteps = 40,
  framesPerStep = 2,
): Promise<UiShell> {
  let state = await readShellState<UiShell>(harness, 'game.ui-simulation-shell');
  for (let step = 0; step < maxSteps && !predicate(state); step++) {
    await harness.stepFrames(framesPerStep);
    state = await readShellState<UiShell>(harness, 'game.ui-simulation-shell');
  }
  return state;
}

async function reactionRun(harness: Harness): Promise<SmokeOutcome> {
  await start(harness);
  const initial = await readShellState<UiShell>(harness, 'game.ui-simulation-shell');

  const firstGo = await waitTiming(harness, (state) => state.timing?.windowOpen === true, 50, 2);
  await harness.keyTap('Enter');
  await harness.stepFrames(4);
  const afterFirst = await readShellState<UiShell>(harness, 'game.ui-simulation-shell');

  const secondGo = await waitTiming(harness, (state) => state.timing?.windowOpen === true, 50, 2);
  await harness.keyTap('Enter');
  const done = await waitTiming(harness, (state) => state.timing?.outcome === 'complete', 20, 2);

  const passed =
    initial.timing?.mode === 'reaction' &&
    initial.timing.active === true &&
    initial.timing.outcome === 'playing' &&
    initial.timing.hits === 0 &&
    firstGo.timing?.windowOpen === true &&
    (afterFirst.timing?.hits ?? 0) >= 1 &&
    secondGo.timing?.windowOpen === true &&
    done.timing?.outcome === 'complete' &&
    (done.timing?.hits ?? 0) >= 2;
  return {
    passed,
    details: {
      initial: initial.timing,
      firstGo: firstGo.timing,
      afterFirst: afterFirst.timing,
      secondGo: secondGo.timing,
      done: done.timing,
    },
  };
}

async function rhythmRun(harness: Harness): Promise<SmokeOutcome> {
  await start(harness);
  const initial = await readShellState<UiShell>(harness, 'game.ui-simulation-shell');

  const hits: TimingSnap[] = [];
  for (let i = 0; i < 3; i++) {
    const open = await waitTiming(harness, (state) => state.timing?.windowOpen === true, 50, 2);
    await harness.keyTap('Enter');
    await harness.stepFrames(3);
    const after = await readShellState<UiShell>(harness, 'game.ui-simulation-shell');
    hits.push(after.timing ?? open.timing!);
  }
  const done = await waitTiming(harness, (state) => state.timing?.outcome === 'complete', 20, 2);

  const passed =
    initial.timing?.mode === 'rhythm' &&
    initial.timing.active === true &&
    initial.timing.outcome === 'playing' &&
    initial.timing.hits === 0 &&
    (hits[0]?.hits ?? 0) >= 1 &&
    (hits[1]?.hits ?? 0) >= 2 &&
    done.timing?.outcome === 'complete' &&
    (done.timing?.hits ?? hits[2]?.hits ?? 0) >= 3;
  return {
    passed,
    details: {
      initial: initial.timing,
      hits,
      done: done.timing,
    },
  };
}

async function main(): Promise<number> {
  if (!findSystemChrome()) {
    console.error('Wave-10 play is INCOMPLETE: no system Chrome found.');
    return 1;
  }
  const games = [
    { id: 'wave10-reaction-timing', run: reactionRun },
    { id: 'wave10-rhythm-action', run: rhythmRun },
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
  console.log(`\n${games.length - failed}/${games.length} Wave-10 generated games played.`);
  return failed === 0 ? 0 : 1;
}

process.exit(await main());
