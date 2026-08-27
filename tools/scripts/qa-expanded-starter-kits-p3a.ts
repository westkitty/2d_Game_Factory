import { existsSync, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createGame } from '@sw2d/cli/factory';
import { findSystemChrome, readShellState, runSmoke, type Harness, type SmokeOutcome } from '@sw2d/qa';
import { runCli } from '../../packages/cli/src/index.ts';
import type { StarterKit } from '../../workbench/server/starterKits/contracts.ts';
import { starterKit as asteroidsShooter } from '../../workbench/server/starterKits/expanded/asteroids-shooter.ts';
import { starterKit as galleryShooter } from '../../workbench/server/starterKits/expanded/gallery-shooter.ts';
import { starterKit as railShooter } from '../../workbench/server/starterKits/expanded/rail-shooter.ts';

const REPO_ROOT = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '../..');
const GAMES_ROOT = path.join(REPO_ROOT, 'games');
const LOCKFILE = path.join(REPO_ROOT, 'package-lock.json');
const DEBUG_KEY = 'game.expanded-starter';

interface Candidate {
  readonly id: string;
  readonly kit: StarterKit;
  run(harness: Harness): Promise<SmokeOutcome>;
}

async function start(harness: Harness): Promise<void> {
  await harness.keyTap('Space');
  await harness.stepFrames(8);
}

async function shell<T>(harness: Harness): Promise<T> {
  return readShellState<T>(harness, DEBUG_KEY);
}

async function waitUntil<T>(
  harness: Harness,
  predicate: (state: T) => boolean,
  maxSteps = 100,
  framesPerStep = 4,
): Promise<T> {
  let state = await shell<T>(harness);
  for (let step = 0; step < maxSteps && !predicate(state); step++) {
    await harness.stepFrames(framesPerStep);
    state = await shell<T>(harness);
  }
  return state;
}

async function holdUntil<T>(
  harness: Harness,
  code: string,
  predicate: (state: T) => boolean,
  maxSteps = 100,
  framesPerStep = 4,
): Promise<T> {
  await harness.keyDown(code);
  try {
    return await waitUntil<T>(harness, predicate, maxSteps, framesPerStep);
  } finally {
    await harness.keyUp(code);
  }
}

function angleDelta(target: number, current: number): number {
  return Math.atan2(Math.sin(target - current), Math.cos(target - current));
}

async function asteroidsRun(harness: Harness): Promise<SmokeOutcome> {
  type EnemyState = { index: number; x: number; y: number; health: number; alive: boolean };
  type S = {
    x: number; y: number; playerHealth: number; enemiesRemaining: number; score: number;
    shotsFired: number; hits: number; heading: number; shipSpeed: number;
    enemyStates: EnemyState[]; outcome: string;
  };

  await start(harness);
  const initial = await shell<S>(harness);
  const accelerated = await holdUntil<S>(harness, 'ArrowUp', (state) => state.shipSpeed >= 120, 80, 4);
  const nearEdge = await holdUntil<S>(harness, 'ArrowUp', (state) => state.x >= 850, 120, 4);
  const wrapped = await holdUntil<S>(harness, 'ArrowUp', (state) => state.x <= 90, 70, 3);
  const rotated = await holdUntil<S>(harness, 'ArrowRight', (state) => Math.abs(state.heading - wrapped.heading) >= 0.25, 20, 2);
  const braked = await holdUntil<S>(harness, 'ArrowDown', (state) => Math.abs(state.shipSpeed) <= 24, 70, 2);

  let state = braked;
  for (let targetPass = 0; targetPass < 3 && state.outcome === 'playing'; targetPass++) {
    const target = state.enemyStates.find((enemy) => enemy.alive);
    if (!target) break;

    for (let hitAttempt = 0; hitAttempt < 8 && state.enemyStates[target.index]?.alive; hitAttempt++) {
      const live = state.enemyStates[target.index];
      if (!live?.alive) break;
      const desired = Math.atan2(live.y - state.y, live.x - state.x);

      for (let turn = 0; turn < 90; turn++) {
        const delta = angleDelta(desired, state.heading);
        if (Math.abs(delta) <= 0.065) break;
        const key = delta > 0 ? 'ArrowRight' : 'ArrowLeft';
        await harness.keyDown(key);
        await harness.stepFrames(1);
        await harness.keyUp(key);
        state = await shell<S>(harness);
      }

      const healthBefore = state.enemyStates[target.index]?.health ?? 0;
      await harness.keyTap('KeyX');
      state = await waitUntil<S>(
        harness,
        (next) => {
          const enemy = next.enemyStates[target.index];
          return !enemy?.alive || enemy.health < healthBefore || next.outcome !== 'playing';
        },
        65,
        2,
      );
    }
  }

  const victory = await waitUntil<S>(harness, (next) => next.outcome !== 'playing', 30, 3);
  const passed =
    initial.enemiesRemaining === 3 && initial.shipSpeed === 0 &&
    accelerated.shipSpeed >= 120 && nearEdge.x >= 850 &&
    wrapped.x <= 90 && wrapped.shipSpeed > 0 &&
    Math.abs(rotated.heading - wrapped.heading) >= 0.25 &&
    Math.abs(braked.shipSpeed) <= 24 &&
    victory.enemiesRemaining === 0 && victory.hits >= 3 && victory.shotsFired >= 6 &&
    victory.score >= 30 && victory.playerHealth > 0 && victory.outcome === 'victory';
  return { passed, details: { initial, accelerated, nearEdge, wrapped, rotated, braked, victory } };
}

async function galleryRun(harness: Harness): Promise<SmokeOutcome> {
  type S = { enemiesRemaining: number; cursorIndex: number; shotsFired: number; hits: number; score: number; elapsedMs: number; outcome: string };
  await start(harness);
  const initial = await shell<S>(harness);
  await harness.keyTap('ArrowRight');
  await harness.stepFrames(2);
  const movedCursor = await shell<S>(harness);

  const clears: S[] = [];
  for (let i = 0; i < 5; i++) {
    await harness.keyTap('Space');
    await harness.stepFrames(2);
    clears.push(await shell<S>(harness));
  }
  const victory = await waitUntil<S>(harness, (state) => state.outcome !== 'playing', 15, 2);

  const passed =
    initial.enemiesRemaining === 5 && initial.elapsedMs < 12000 &&
    movedCursor.cursorIndex === 1 &&
    clears.some((state) => state.enemiesRemaining < 5) &&
    victory.enemiesRemaining === 0 && victory.shotsFired === 5 && victory.hits === 5 &&
    victory.score === 50 && victory.elapsedMs < 12000 && victory.outcome === 'victory';
  return { passed, details: { initial, movedCursor, clears, victory } };
}

async function railRun(harness: Harness): Promise<SmokeOutcome> {
  type S = {
    currentStage: number; activeTargets: number; enemiesRemaining: number; cursorIndex: number;
    transitionMs: number; routeProgress: number; shotsFired: number; hits: number; score: number;
    lastAction: string; outcome: string;
  };
  await start(harness);
  const initial = await shell<S>(harness);

  await harness.keyTap('Space');
  await harness.stepFrames(2);
  const stageOneHit = await shell<S>(harness);
  await harness.keyTap('Space');
  await harness.stepFrames(2);
  const firstTransition = await shell<S>(harness);
  const stageTwo = await waitUntil<S>(harness, (state) => state.currentStage === 1 && state.activeTargets === 2, 30, 2);

  await harness.keyTap('ArrowRight');
  await harness.stepFrames(2);
  const movedCursor = await shell<S>(harness);
  await harness.keyTap('Space');
  await harness.stepFrames(2);
  await harness.keyTap('Space');
  await harness.stepFrames(2);
  const secondTransition = await shell<S>(harness);
  const stageThree = await waitUntil<S>(harness, (state) => state.currentStage === 2 && state.activeTargets === 1, 30, 2);

  await harness.keyTap('Space');
  const victory = await waitUntil<S>(harness, (state) => state.outcome !== 'playing', 15, 2);

  const passed =
    initial.currentStage === 0 && initial.activeTargets === 2 && initial.enemiesRemaining === 5 &&
    stageOneHit.activeTargets === 1 && stageOneHit.hits === 1 &&
    firstTransition.activeTargets === 0 && firstTransition.lastAction === 'route-advance' && firstTransition.routeProgress === 0.5 &&
    stageTwo.currentStage === 1 && stageTwo.activeTargets === 2 && stageTwo.routeProgress === 1 &&
    movedCursor.cursorIndex === 1 &&
    secondTransition.activeTargets === 0 && secondTransition.lastAction === 'route-advance' && secondTransition.routeProgress === 1.5 &&
    stageThree.currentStage === 2 && stageThree.activeTargets === 1 && stageThree.routeProgress === 2 &&
    victory.enemiesRemaining === 0 && victory.routeProgress === 3 &&
    victory.shotsFired === 5 && victory.hits === 5 && victory.score === 50 &&
    victory.lastAction === 'route-complete' && victory.outcome === 'victory';
  return { passed, details: { initial, stageOneHit, firstTransition, stageTwo, movedCursor, secondTransition, stageThree, victory } };
}

const CANDIDATES: readonly Candidate[] = [
  { id: 'asteroids-shooter', kit: asteroidsShooter, run: asteroidsRun },
  { id: 'gallery-shooter', kit: galleryShooter, run: galleryRun },
  { id: 'rail-shooter', kit: railShooter, run: railRun },
];

interface Result { readonly id: string; readonly passed: boolean; readonly detail: string }

async function runCandidate(candidate: Candidate): Promise<Result> {
  const gameId = `qa-kit-${candidate.id}`;
  const gamePath = path.join(GAMES_ROOT, gameId);
  rmSync(gamePath, { recursive: true, force: true });
  try {
    createGame({ gameId, presetId: candidate.id, overlay: candidate.kit.overlay(gameId, `QA ${candidate.id}`) });
    const validateCode = await runCli(['validate', gameId]);
    if (validateCode !== 0) return { id: candidate.id, passed: false, detail: 'canonical validate failed' };
    const result = await runSmoke({ id: candidate.id, buildDir: path.join(gamePath, 'dist'), run: candidate.run });
    if (!result.passed) {
      return {
        id: candidate.id,
        passed: false,
        detail: `mechanic proof failed; console=${JSON.stringify(result.consoleErrors)} external=${JSON.stringify(result.externalRequests)} details=${JSON.stringify(result.details)}`,
      };
    }
    return { id: candidate.id, passed: true, detail: JSON.stringify(result.details) };
  } catch (error) {
    return { id: candidate.id, passed: false, detail: error instanceof Error ? `${error.name}: ${error.message}` : String(error) };
  } finally {
    rmSync(gamePath, { recursive: true, force: true });
  }
}

async function main(): Promise<number> {
  if (!findSystemChrome()) {
    console.error('Expanded starter-kit P3-A QA is INCOMPLETE: no system Chrome found.');
    return 1;
  }
  const lockBefore = existsSync(LOCKFILE) ? readFileSync(LOCKFILE, 'utf8') : null;
  const results: Result[] = [];
  for (const candidate of CANDIDATES) {
    process.stdout.write(`Running P3-A starter candidate ${candidate.id}...\n`);
    const result = await runCandidate(candidate);
    results.push(result);
    console.log(`[${result.passed ? 'PASS' : 'FAIL'}] ${candidate.id}${result.passed ? '' : ` - ${result.detail}`}`);
  }
  const lockAfter = existsSync(LOCKFILE) ? readFileSync(LOCKFILE, 'utf8') : null;
  const lockfileClean = lockBefore === lockAfter;
  console.log(`[${lockfileClean ? 'PASS' : 'FAIL'}] package-lock.json unchanged by P3-A candidate generation/validation`);
  const failed = results.filter((result) => !result.passed);
  console.log(`\n${results.length - failed.length}/${results.length} P3-A starter candidate(s) passed.`);
  return failed.length === 0 && lockfileClean ? 0 : 1;
}

process.exitCode = await main();
