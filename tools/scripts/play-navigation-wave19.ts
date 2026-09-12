import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { findSystemChrome, readShellState, runSmoke, type Harness, type SmokeOutcome } from '@sw2d/qa';

/**
 * Category-C Wave 19 play journeys against factory-generated games
 * (not starter-kit overlays). Proves two different sw2d.navigation
 * presentations: walkable occupancy vs autonomous re-path.
 */

const REPO_ROOT = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '../..');

interface NavSnap {
  readonly active: boolean;
  readonly mode: string | null;
  readonly playerCol: number;
  readonly playerRow: number;
  readonly cursorCol: number;
  readonly cursorRow: number;
  readonly runnerCol: number;
  readonly runnerRow: number;
  readonly exitCol: number;
  readonly exitRow: number;
  readonly pathLength: number;
  readonly blockedCount: number;
  readonly lastResult: string | null;
  readonly outcome: string;
}

interface GridShell {
  readonly col: number;
  readonly row: number;
  readonly navigation?: NavSnap;
}

async function start(harness: Harness): Promise<void> {
  await harness.keyTap('Space');
  await harness.stepFrames(12);
}

async function snapGrid(harness: Harness): Promise<GridShell> {
  return readShellState<GridShell>(harness, 'game.grid-shell');
}

async function waitGrid(
  harness: Harness,
  predicate: (state: GridShell) => boolean,
  maxSteps = 120,
  framesPerStep = 4,
): Promise<GridShell> {
  let state = await snapGrid(harness);
  for (let step = 0; step < maxSteps && !predicate(state); step++) {
    await harness.stepFrames(framesPerStep);
    state = await snapGrid(harness);
  }
  return state;
}

async function mazeRun(harness: Harness): Promise<SmokeOutcome> {
  await start(harness);
  const initial = await snapGrid(harness);

  await harness.keyTap('ArrowUp');
  await harness.stepFrames(4);
  const wall = await snapGrid(harness);

  await harness.keyTap('ArrowRight');
  await harness.stepFrames(4);
  await harness.keyTap('ArrowRight');
  await harness.stepFrames(4);
  const corner = await snapGrid(harness);

  await harness.keyTap('ArrowDown');
  await harness.stepFrames(4);
  await harness.keyTap('ArrowDown');
  await harness.stepFrames(4);
  for (let i = 0; i < 4; i++) {
    await harness.keyTap('ArrowRight');
    await harness.stepFrames(4);
  }
  await harness.keyTap('ArrowUp');
  await harness.stepFrames(4);
  await harness.keyTap('ArrowUp');
  await harness.stepFrames(4);
  await harness.keyTap('ArrowRight');
  await harness.stepFrames(4);
  await harness.keyTap('ArrowRight');
  await harness.stepFrames(4);
  const done = await snapGrid(harness);

  const passed =
    initial.navigation?.mode === 'maze' &&
    initial.navigation.playerCol === 4 &&
    initial.navigation.playerRow === 8 &&
    initial.navigation.exitCol === 12 &&
    initial.navigation.exitRow === 8 &&
    initial.navigation.pathLength === 13 &&
    initial.navigation.outcome === 'playing' &&
    wall.navigation?.lastResult === 'wall' &&
    wall.navigation.playerCol === 4 &&
    wall.navigation.playerRow === 8 &&
    corner.navigation?.playerCol === 6 &&
    corner.navigation.playerRow === 8 &&
    corner.navigation.lastResult === 'moved' &&
    done.navigation?.lastResult === 'escaped' &&
    done.navigation.playerCol === 12 &&
    done.navigation.playerRow === 8 &&
    done.navigation.outcome === 'complete';
  return {
    passed,
    details: {
      initial: initial.navigation,
      wall: wall.navigation,
      corner: corner.navigation,
      done: done.navigation,
    },
  };
}

async function laneRun(harness: Harness): Promise<SmokeOutcome> {
  await start(harness);
  const initial = await snapGrid(harness);
  const initialPath = initial.navigation?.pathLength ?? 0;

  await harness.keyTap('KeyJ');
  await harness.stepFrames(4);
  const placed = await snapGrid(harness);

  const done = await waitGrid(harness, (s) => s.navigation?.outcome === 'complete');

  const passed =
    initial.navigation?.mode === 'lane' &&
    initial.navigation.runnerRow === 8 &&
    initial.navigation.runnerCol >= 4 &&
    initial.navigation.runnerCol < 10 &&
    initial.navigation.cursorCol === 10 &&
    initial.navigation.cursorRow === 8 &&
    initial.navigation.exitCol === 16 &&
    initial.navigation.blockedCount === 0 &&
    initial.navigation.outcome === 'playing' &&
    initialPath > 0 &&
    placed.navigation?.lastResult === 'placed' &&
    placed.navigation.blockedCount === 1 &&
    (placed.navigation.pathLength ?? 0) > initialPath &&
    done.navigation?.lastResult === 'arrived' &&
    done.navigation.outcome === 'complete' &&
    done.navigation.runnerCol === 16 &&
    done.navigation.runnerRow === 8;
  return {
    passed,
    details: {
      initial: initial.navigation,
      placed: placed.navigation,
      done: done.navigation,
    },
  };
}

async function main(): Promise<number> {
  if (!findSystemChrome()) {
    console.error('Wave-19 play is INCOMPLETE: no system Chrome found.');
    return 1;
  }
  const games = [
    { id: 'wave19-maze-game', run: mazeRun },
    { id: 'wave19-lane-defense', run: laneRun },
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
  console.log(`\n${games.length - failed}/${games.length} Wave-19 generated games played.`);
  return failed === 0 ? 0 : 1;
}

process.exit(await main());
