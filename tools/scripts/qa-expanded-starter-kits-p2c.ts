import { existsSync, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createGame } from '@sw2d/cli/factory';
import { findSystemChrome, readShellState, runSmoke, type Harness, type SmokeOutcome } from '@sw2d/qa';
import type { StarterKit } from '../../workbench/server/starterKits/contracts.ts';
import { runCli } from '../../packages/cli/src/index.ts';
import { starterKit as explorationGame } from '../../workbench/server/starterKits/expanded/exploration-game.ts';
import { starterKit as horizontalShmup } from '../../workbench/server/starterKits/expanded/horizontal-shmup.ts';
import { starterKit as laneDefense } from '../../workbench/server/starterKits/expanded/lane-defense.ts';
import { starterKit as mazeGame } from '../../workbench/server/starterKits/expanded/maze-game.ts';
import { starterKit as museumExhibit } from '../../workbench/server/starterKits/expanded/museum-exhibit.ts';
import { starterKit as precisionPlatformer } from '../../workbench/server/starterKits/expanded/precision-platformer.ts';
import { starterKit as runAndGun } from '../../workbench/server/starterKits/expanded/run-and-gun.ts';
import { starterKit as verticalShmup } from '../../workbench/server/starterKits/expanded/vertical-shmup.ts';

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

async function holdUntil<T>(
  harness: Harness,
  code: string,
  predicate: (state: T) => boolean,
  maxSteps = 100,
  framesPerStep = 4,
): Promise<T> {
  await harness.keyDown(code);
  try {
    let state = await shell<T>(harness);
    for (let step = 0; step < maxSteps && !predicate(state); step++) {
      await harness.stepFrames(framesPerStep);
      state = await shell<T>(harness);
    }
  } finally {
    await harness.keyUp(code);
  }
  await harness.stepFrames(2);
  return shell<T>(harness);
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

async function tapMany(harness: Harness, code: string, times: number, frames = 2): Promise<void> {
  for (let i = 0; i < times; i++) {
    await harness.keyTap(code);
    await harness.stepFrames(frames);
  }
}

async function worldDiscoveryRun(harness: Harness, museum: boolean): Promise<SmokeOutcome> {
  type S = { x: number; y: number; discovered: boolean[]; clueCount: number; lastAction: string; outcome: string };
  await start(harness);
  const initial = await shell<S>(harness);

  await holdUntil<S>(harness, 'ArrowUp', (state) => state.y <= 155, 60, 4);
  const nearFirst = await holdUntil<S>(harness, 'ArrowRight', (state) => state.x >= 300, 60, 4);
  const beforeFirstInteract = await shell<S>(harness);
  await harness.keyTap('KeyE');
  await harness.stepFrames(2);
  const first = await shell<S>(harness);

  await holdUntil<S>(harness, 'ArrowDown', (state) => state.y >= 335, 70, 4);
  const nearSecond = await holdUntil<S>(harness, 'ArrowRight', (state) => state.x >= 535, 70, 4);
  const beforeSecondInteract = await shell<S>(harness);
  await harness.keyTap('KeyE');
  await harness.stepFrames(2);
  const second = await shell<S>(harness);

  await holdUntil<S>(harness, 'ArrowDown', (state) => state.y >= 415, 45, 4);
  const complete = await holdUntil<S>(harness, 'ArrowRight', (state) => state.outcome === 'complete', 90, 4);

  const expectedAction = museum ? 'view-exhibit' : 'discover';
  const passed =
    initial.discovered.every((value) => value === false) &&
    nearFirst.x >= 300 && beforeFirstInteract.discovered[0] === false &&
    first.discovered[0] === true && first.lastAction === expectedAction &&
    nearSecond.x >= 535 && beforeSecondInteract.discovered[1] === false &&
    second.discovered[1] === true && second.lastAction === expectedAction &&
    complete.discovered.filter(Boolean).length >= 2 &&
    complete.outcome === 'complete';
  return { passed, details: { initial, nearFirst, beforeFirstInteract, first, nearSecond, beforeSecondInteract, second, complete } };
}

async function explorationRun(harness: Harness): Promise<SmokeOutcome> {
  return worldDiscoveryRun(harness, false);
}

async function museumRun(harness: Harness): Promise<SmokeOutcome> {
  return worldDiscoveryRun(harness, true);
}

async function horizontalShmupRun(harness: Harness): Promise<SmokeOutcome> {
  type S = { x: number; y: number; playerHealth: number; enemiesRemaining: number; shotsFired: number; hits: number; outcome: string };
  await start(harness);
  const initial = await shell<S>(harness);

  await holdUntil<S>(harness, 'ArrowUp', (state) => state.y <= 175, 45, 4);
  await tapMany(harness, 'KeyX', 3, 12);
  const first = await waitUntil<S>(harness, (state) => state.enemiesRemaining <= 2, 30, 4);

  await holdUntil<S>(harness, 'ArrowDown', (state) => state.y >= 295, 45, 4);
  await tapMany(harness, 'KeyX', 3, 12);
  const second = await waitUntil<S>(harness, (state) => state.enemiesRemaining <= 1, 35, 4);

  await holdUntil<S>(harness, 'ArrowUp', (state) => state.y <= 225, 35, 4);
  await tapMany(harness, 'KeyX', 3, 12);
  const victory = await waitUntil<S>(harness, (state) => state.outcome !== 'playing', 45, 4);

  const passed =
    initial.enemiesRemaining === 3 &&
    first.enemiesRemaining === 2 &&
    second.enemiesRemaining === 1 &&
    victory.enemiesRemaining === 0 &&
    victory.shotsFired >= 6 &&
    victory.hits >= 3 &&
    victory.playerHealth > 0 &&
    victory.outcome === 'victory';
  return { passed, details: { initial, first, second, victory } };
}

async function verticalShmupRun(harness: Harness): Promise<SmokeOutcome> {
  type S = { x: number; y: number; playerHealth: number; enemiesRemaining: number; shotsFired: number; hits: number; outcome: string };
  await start(harness);
  const initial = await shell<S>(harness);

  await holdUntil<S>(harness, 'ArrowRight', (state) => state.x >= 275, 55, 4);
  await tapMany(harness, 'KeyX', 3, 12);
  const first = await waitUntil<S>(harness, (state) => state.enemiesRemaining <= 2, 35, 4);

  await holdUntil<S>(harness, 'ArrowRight', (state) => state.x >= 475, 55, 4);
  await tapMany(harness, 'KeyX', 3, 12);
  const second = await waitUntil<S>(harness, (state) => state.enemiesRemaining <= 1, 35, 4);

  await holdUntil<S>(harness, 'ArrowRight', (state) => state.x >= 695, 60, 4);
  await tapMany(harness, 'KeyX', 3, 12);
  const victory = await waitUntil<S>(harness, (state) => state.outcome !== 'playing', 45, 4);

  const passed =
    initial.enemiesRemaining === 3 &&
    first.enemiesRemaining === 2 &&
    second.enemiesRemaining === 1 &&
    victory.enemiesRemaining === 0 &&
    victory.shotsFired >= 6 &&
    victory.hits >= 3 &&
    victory.playerHealth > 0 &&
    victory.outcome === 'victory';
  return { passed, details: { initial, first, second, victory } };
}

async function laneDefenseRun(harness: Harness): Promise<SmokeOutcome> {
  type S = { cursor: { col: number; row: number }; enemiesRemaining: number; baseHealth: number; defenderLane: number | null; lastAction: string; outcome: string };
  await start(harness);
  const initial = await shell<S>(harness);
  await harness.keyTap('Space');
  await harness.stepFrames(4);
  const laneZero = await shell<S>(harness);
  const firstDown = await waitUntil<S>(harness, (state) => state.enemiesRemaining <= 1, 30, 4);

  await harness.keyTap('ArrowDown');
  await harness.keyTap('ArrowDown');
  await harness.keyTap('Space');
  await harness.stepFrames(4);
  const laneTwo = await shell<S>(harness);
  const victory = await waitUntil<S>(harness, (state) => state.outcome !== 'playing', 50, 5);

  const passed =
    initial.enemiesRemaining === 2 && initial.baseHealth === 6 &&
    laneZero.defenderLane === 0 &&
    firstDown.enemiesRemaining <= 1 &&
    laneTwo.cursor.row === 5 && laneTwo.defenderLane === 2 &&
    victory.enemiesRemaining === 0 && victory.baseHealth > 0 &&
    victory.outcome === 'victory';
  return { passed, details: { initial, laneZero, firstDown, laneTwo, victory } };
}

async function mazeRun(harness: Harness): Promise<SmokeOutcome> {
  type S = { mazeCell: { col: number; row: number }; mazeHasPickup: boolean; lastAction: string; outcome: string };
  await start(harness);
  const initial = await shell<S>(harness);

  await harness.keyTap('ArrowRight');
  await harness.keyTap('ArrowDown');
  await harness.stepFrames(2);
  const wall = await shell<S>(harness);
  await harness.keyTap('ArrowLeft');
  await tapMany(harness, 'ArrowDown', 4, 1);
  const pickup = await shell<S>(harness);
  await tapMany(harness, 'ArrowRight', 4, 1);
  const complete = await shell<S>(harness);

  const passed =
    initial.mazeCell.col === 0 && initial.mazeCell.row === 0 &&
    wall.mazeCell.col === 1 && wall.mazeCell.row === 0 && wall.lastAction === 'wall' &&
    pickup.mazeCell.col === 0 && pickup.mazeCell.row === 4 && pickup.mazeHasPickup === true &&
    complete.mazeCell.col === 4 && complete.mazeCell.row === 4 &&
    complete.mazeHasPickup === true && complete.outcome === 'complete';
  return { passed, details: { initial, wall, pickup, complete } };
}

async function precisionRun(harness: Harness): Promise<SmokeOutcome> {
  type S = { x: number; y: number; hazardHits: number; respawns: number; maxHeightReached: number; lastAction: string; outcome: string };
  await start(harness);
  await harness.stepFrames(20);
  const initial = await shell<S>(harness);

  await harness.keyDown('ArrowRight');
  let state = initial;
  for (let step = 0; step < 60 && state.x < 175 && state.hazardHits === 0; step++) {
    await harness.stepFrames(2);
    state = await shell<S>(harness);
  }
  await harness.keyTap('Space');
  const first = await waitUntil<S>(harness, (next) => next.x >= 320 || next.hazardHits > 0, 60, 2);
  await harness.stepFrames(12);
  const firstSettled = await shell<S>(harness);

  await harness.keyTap('Space');
  const second = await waitUntil<S>(harness, (next) => next.x >= 490 || next.hazardHits > 0, 70, 2);
  await harness.stepFrames(12);
  const secondSettled = await shell<S>(harness);

  await harness.keyTap('Space');
  const third = await waitUntil<S>(harness, (next) => next.x >= 650 || next.hazardHits > 0, 70, 2);
  await harness.stepFrames(10);
  const checkpoint = await shell<S>(harness);

  await harness.keyTap('Space');
  const finishFloor = await waitUntil<S>(harness, (next) => next.x >= 810 || next.hazardHits > 0, 80, 2);
  const complete = await waitUntil<S>(harness, (next) => next.outcome === 'complete' || next.hazardHits > 0, 50, 2);
  await harness.keyUp('ArrowRight');

  const passed =
    initial.hazardHits === 0 &&
    first.x >= 320 && first.hazardHits === 0 &&
    firstSettled.y < initial.y &&
    second.x >= 490 && second.hazardHits === 0 &&
    secondSettled.y < firstSettled.y &&
    third.x >= 650 && third.hazardHits === 0 &&
    checkpoint.lastAction === 'checkpoint' &&
    finishFloor.x >= 810 && finishFloor.hazardHits === 0 &&
    complete.hazardHits === 0 && complete.respawns === 0 &&
    complete.outcome === 'complete';
  return { passed, details: { initial, first, firstSettled, second, secondSettled, third, checkpoint, finishFloor, complete } };
}

async function runAndGunRun(harness: Harness): Promise<SmokeOutcome> {
  type S = { x: number; y: number; playerHealth: number; enemiesRemaining: number; shotsFired: number; hits: number; outcome: string };
  await start(harness);
  const grounded = await waitUntil<S>(harness, (state) => state.y >= 460, 50, 3);
  const approach = await holdUntil<S>(harness, 'ArrowRight', (state) => state.x >= 280, 55, 4);

  await harness.keyDown('ArrowRight');
  await harness.keyTap('Space');
  await harness.stepFrames(7);
  const airborne = await shell<S>(harness);
  await harness.keyUp('ArrowRight');
  const landed = await waitUntil<S>(harness, (state) => state.y >= 460, 45, 3);

  await tapMany(harness, 'KeyX', 3, 12);
  const first = await waitUntil<S>(harness, (state) => state.enemiesRemaining <= 2, 30, 4);
  await holdUntil<S>(harness, 'ArrowRight', (state) => state.x >= 520, 55, 4);
  await tapMany(harness, 'KeyX', 3, 12);
  const second = await waitUntil<S>(harness, (state) => state.enemiesRemaining <= 1, 30, 4);
  await holdUntil<S>(harness, 'ArrowRight', (state) => state.x >= 690, 50, 4);
  await tapMany(harness, 'KeyX', 3, 12);
  const cleared = await waitUntil<S>(harness, (state) => state.enemiesRemaining === 0, 30, 4);
  const victory = await holdUntil<S>(harness, 'ArrowRight', (state) => state.outcome === 'victory', 60, 4);

  const passed =
    grounded.y >= 460 && approach.x >= 280 &&
    airborne.y < approach.y && landed.y >= 460 &&
    first.enemiesRemaining === 2 && second.enemiesRemaining === 1 &&
    cleared.enemiesRemaining === 0 &&
    victory.shotsFired >= 6 && victory.hits >= 3 &&
    victory.playerHealth > 0 && victory.outcome === 'victory';
  return { passed, details: { grounded, approach, airborne, landed, first, second, cleared, victory } };
}

const CANDIDATES: readonly Candidate[] = [
  { id: 'exploration-game', kit: explorationGame, run: explorationRun },
  { id: 'horizontal-shmup', kit: horizontalShmup, run: horizontalShmupRun },
  { id: 'lane-defense', kit: laneDefense, run: laneDefenseRun },
  { id: 'maze-game', kit: mazeGame, run: mazeRun },
  { id: 'museum-exhibit', kit: museumExhibit, run: museumRun },
  { id: 'precision-platformer', kit: precisionPlatformer, run: precisionRun },
  { id: 'run-and-gun', kit: runAndGun, run: runAndGunRun },
  { id: 'vertical-shmup', kit: verticalShmup, run: verticalShmupRun },
];

interface Result {
  readonly id: string;
  readonly passed: boolean;
  readonly detail: string;
}

async function runCandidate(candidate: Candidate): Promise<Result> {
  const gameId = `qa-kit-${candidate.id}`;
  const gamePath = path.join(GAMES_ROOT, gameId);
  rmSync(gamePath, { recursive: true, force: true });

  try {
    createGame({
      gameId,
      presetId: candidate.id,
      overlay: candidate.kit.overlay(gameId, `QA ${candidate.id}`),
    });
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
    console.error('Expanded starter-kit P2-C QA is INCOMPLETE: no system Chrome found.');
    return 1;
  }

  const lockBefore = existsSync(LOCKFILE) ? readFileSync(LOCKFILE, 'utf8') : null;
  const only = new Set(process.argv.slice(2));
  const candidates = only.size > 0 ? CANDIDATES.filter((candidate) => only.has(candidate.id)) : CANDIDATES;
  if (candidates.length === 0) {
    console.error(`No P2-C candidate matched. Known: ${CANDIDATES.map((candidate) => candidate.id).join(', ')}`);
    return 1;
  }

  const results: Result[] = [];
  for (const candidate of candidates) {
    process.stdout.write(`Running P2-C starter candidate ${candidate.id}...\n`);
    const result = await runCandidate(candidate);
    results.push(result);
    console.log(`[${result.passed ? 'PASS' : 'FAIL'}] ${candidate.id}${result.passed ? '' : ` - ${result.detail}`}`);
  }

  const lockAfter = existsSync(LOCKFILE) ? readFileSync(LOCKFILE, 'utf8') : null;
  const lockfileClean = lockBefore === lockAfter;
  console.log(`[${lockfileClean ? 'PASS' : 'FAIL'}] package-lock.json unchanged by P2-C candidate generation/validation`);

  const failed = results.filter((result) => !result.passed);
  console.log(`\n${results.length - failed.length}/${results.length} P2-C starter candidate(s) passed.`);
  return failed.length === 0 && lockfileClean ? 0 : 1;
}

process.exitCode = await main();
