import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { findSystemChrome, readShellState, runSmoke, type Harness, type SmokeOutcome } from '@sw2d/qa';

/**
 * Category-C Wave 8 play journeys against factory-generated games
 * (not starter-kit overlays). Proves horizontal vs vertical stage scroll,
 * player-band motion, default fire dir, and stage-clear.
 */

const REPO_ROOT = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '../..');

interface StageSnap {
  readonly active: boolean;
  readonly mode: string | null;
  readonly offset: number;
  readonly progress: number;
  readonly playerX: number;
  readonly playerY: number;
  readonly fireX: number;
  readonly fireY: number;
  readonly lastHit: string | null;
  readonly outcome: string;
  readonly hazardsVisible: number;
}

interface BattleSnap {
  readonly projectilesSpawned?: number;
  readonly playerBulletsSpawned?: number;
}

interface TopDownShell {
  readonly x: number;
  readonly y: number;
  readonly stageScroll?: StageSnap;
  readonly battle?: BattleSnap;
}

async function start(harness: Harness): Promise<void> {
  await harness.keyTap('Space');
  await harness.stepFrames(8);
}

async function waitStage(
  harness: Harness,
  predicate: (state: TopDownShell) => boolean,
  maxSteps = 80,
  framesPerStep = 8,
): Promise<TopDownShell> {
  let state = await readShellState<TopDownShell>(harness, 'game.top-down-shell');
  for (let step = 0; step < maxSteps && !predicate(state); step++) {
    await harness.stepFrames(framesPerStep);
    state = await readShellState<TopDownShell>(harness, 'game.top-down-shell');
  }
  return state;
}

async function horizontalRun(harness: Harness): Promise<SmokeOutcome> {
  await start(harness);
  const initial = await readShellState<TopDownShell>(harness, 'game.top-down-shell');

  await harness.keyDown('ArrowDown');
  await harness.stepFrames(20);
  const moved = await readShellState<TopDownShell>(harness, 'game.top-down-shell');
  await harness.keyUp('ArrowDown');
  await harness.stepFrames(2);

  await harness.keyTap('KeyJ');
  await harness.stepFrames(6);
  const fired = await readShellState<TopDownShell>(harness, 'game.top-down-shell');

  const done = await waitStage(harness, (state) => state.stageScroll?.outcome === 'complete', 90, 8);

  const passed =
    initial.stageScroll?.mode === 'horizontal' &&
    initial.stageScroll.active === true &&
    initial.stageScroll.fireX === 1 &&
    initial.stageScroll.fireY === 0 &&
    initial.stageScroll.outcome === 'playing' &&
    (moved.stageScroll?.playerY ?? 0) > (initial.stageScroll?.playerY ?? 0) + 8 &&
    (fired.battle?.projectilesSpawned ?? 0) >= 1 &&
    done.stageScroll?.outcome === 'complete' &&
    (done.stageScroll?.offset ?? 0) >= 720 &&
    (done.stageScroll?.progress ?? 0) >= 1;
  return {
    passed,
    details: {
      initial: initial.stageScroll,
      moved: { playerY: moved.stageScroll?.playerY, offset: moved.stageScroll?.offset },
      fired: fired.battle,
      done: done.stageScroll,
    },
  };
}

async function verticalRun(harness: Harness): Promise<SmokeOutcome> {
  await start(harness);
  const initial = await readShellState<TopDownShell>(harness, 'game.top-down-shell');

  await harness.keyDown('ArrowRight');
  await harness.stepFrames(20);
  const moved = await readShellState<TopDownShell>(harness, 'game.top-down-shell');
  await harness.keyUp('ArrowRight');
  await harness.stepFrames(2);

  await harness.keyTap('KeyJ');
  await harness.stepFrames(6);
  const fired = await readShellState<TopDownShell>(harness, 'game.top-down-shell');

  const done = await waitStage(harness, (state) => state.stageScroll?.outcome === 'complete', 90, 8);

  const passed =
    initial.stageScroll?.mode === 'vertical' &&
    initial.stageScroll.active === true &&
    initial.stageScroll.fireX === 0 &&
    initial.stageScroll.fireY === -1 &&
    initial.stageScroll.outcome === 'playing' &&
    (moved.stageScroll?.playerX ?? 0) > (initial.stageScroll?.playerX ?? 0) + 8 &&
    (fired.battle?.projectilesSpawned ?? 0) >= 1 &&
    done.stageScroll?.outcome === 'complete' &&
    (done.stageScroll?.offset ?? 0) >= 720 &&
    (done.stageScroll?.progress ?? 0) >= 1;
  return {
    passed,
    details: {
      initial: initial.stageScroll,
      moved: { playerX: moved.stageScroll?.playerX, offset: moved.stageScroll?.offset },
      fired: fired.battle,
      done: done.stageScroll,
    },
  };
}

async function main(): Promise<number> {
  if (!findSystemChrome()) {
    console.error('Wave-8 play is INCOMPLETE: no system Chrome found.');
    return 1;
  }
  const games = [
    { id: 'wave8-horizontal-shmup', run: horizontalRun },
    { id: 'wave8-vertical-shmup', run: verticalRun },
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
  console.log(`\n${games.length - failed}/${games.length} Wave-8 generated games played.`);
  return failed === 0 ? 0 : 1;
}

process.exit(await main());
