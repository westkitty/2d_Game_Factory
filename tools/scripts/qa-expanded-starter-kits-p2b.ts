import { existsSync, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createGame } from '@sw2d/cli/factory';
import { findSystemChrome, readShellState, runSmoke, type Harness, type SmokeOutcome } from '@sw2d/qa';
import type { StarterKit } from '../../workbench/server/starterKits/contracts.ts';
import { runCli } from '../../packages/cli/src/index.ts';
import { starterKit as actionAdventure } from '../../workbench/server/starterKits/expanded/action-adventure.ts';
import { starterKit as arenaCombat } from '../../workbench/server/starterKits/expanded/arena-combat.ts';
import { starterKit as baseDefense } from '../../workbench/server/starterKits/expanded/base-defense.ts';
import { starterKit as breakout } from '../../workbench/server/starterKits/expanded/breakout.ts';
import { starterKit as collectathonPlatformer } from '../../workbench/server/starterKits/expanded/collectathon-platformer.ts';
import { starterKit as dungeonCrawler } from '../../workbench/server/starterKits/expanded/dungeon-crawler.ts';
import { starterKit as endlessRunner } from '../../workbench/server/starterKits/expanded/endless-runner.ts';

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

async function attack(harness: Harness, times: number): Promise<void> {
  for (let hit = 0; hit < times; hit++) {
    await harness.keyTap('KeyX');
    await harness.stepFrames(3);
  }
}

async function actionAdventureRun(harness: Harness): Promise<SmokeOutcome> {
  type S = { x: number; y: number; objectiveCollected: boolean; enemiesRemaining: number; playerHealth: number; lastAction: string; outcome: string };
  await start(harness);
  const initial = await shell<S>(harness);
  const approach = await holdUntil<S>(harness, 'ArrowRight', (state) => state.x >= 350, 60, 4);
  await attack(harness, 3);
  const cleared = await shell<S>(harness);
  await holdUntil<S>(harness, 'ArrowUp', (state) => state.y <= 185, 50, 4);
  const objective = await holdUntil<S>(harness, 'ArrowRight', (state) => state.objectiveCollected, 80, 4);
  await holdUntil<S>(harness, 'ArrowDown', (state) => state.y >= 395, 70, 4);
  const victory = await holdUntil<S>(harness, 'ArrowRight', (state) => state.outcome === 'victory', 60, 4);

  const passed =
    initial.enemiesRemaining === 1 &&
    approach.x >= 350 &&
    cleared.enemiesRemaining === 0 &&
    cleared.lastAction === 'attack' &&
    objective.objectiveCollected === true &&
    victory.objectiveCollected === true &&
    victory.enemiesRemaining === 0 &&
    victory.playerHealth > 0 &&
    victory.outcome === 'victory';
  return { passed, details: { initial, approach, cleared, objective, victory } };
}

async function arenaCombatRun(harness: Harness): Promise<SmokeOutcome> {
  type S = { x: number; y: number; enemiesRemaining: number; playerHealth: number; lastAction: string; outcome: string };
  await start(harness);
  const initial = await shell<S>(harness);

  await holdUntil<S>(harness, 'ArrowUp', (state) => state.y <= 175, 50, 4);
  await holdUntil<S>(harness, 'ArrowRight', (state) => state.x >= 330, 50, 4);
  await attack(harness, 2);
  const first = await shell<S>(harness);

  await holdUntil<S>(harness, 'ArrowDown', (state) => state.y >= 265, 45, 4);
  await holdUntil<S>(harness, 'ArrowRight', (state) => state.x >= 455, 45, 4);
  await attack(harness, 2);
  const second = await shell<S>(harness);

  await attack(harness, 2);
  const victory = await waitUntil<S>(harness, (state) => state.outcome === 'victory', 20, 3);

  const passed =
    initial.enemiesRemaining === 3 &&
    first.enemiesRemaining === 2 &&
    second.enemiesRemaining === 1 &&
    victory.enemiesRemaining === 0 &&
    victory.playerHealth > 0 &&
    victory.outcome === 'victory';
  return { passed, details: { initial, first, second, victory } };
}

async function dungeonCrawlerRun(harness: Harness): Promise<SmokeOutcome> {
  type S = { x: number; y: number; objectiveCollected: boolean; enemiesRemaining: number; playerHealth: number; lastAction: string; outcome: string };
  await start(harness);
  const initial = await shell<S>(harness);

  await holdUntil<S>(harness, 'ArrowUp', (state) => state.y <= 220, 45, 4);
  await holdUntil<S>(harness, 'ArrowRight', (state) => state.x >= 330, 50, 4);
  await attack(harness, 2);
  const first = await shell<S>(harness);

  await holdUntil<S>(harness, 'ArrowDown', (state) => state.y >= 315, 45, 4);
  await holdUntil<S>(harness, 'ArrowRight', (state) => state.x >= 465, 45, 4);
  await attack(harness, 2);
  const cleared = await shell<S>(harness);

  await holdUntil<S>(harness, 'ArrowUp', (state) => state.y <= 285, 30, 4);
  const objective = await holdUntil<S>(harness, 'ArrowRight', (state) => state.objectiveCollected, 70, 4);
  const victory = await holdUntil<S>(harness, 'ArrowRight', (state) => state.outcome === 'victory', 45, 4);

  const passed =
    initial.enemiesRemaining === 2 &&
    first.enemiesRemaining === 1 &&
    cleared.enemiesRemaining === 0 &&
    objective.objectiveCollected === true &&
    victory.enemiesRemaining === 0 &&
    victory.playerHealth > 0 &&
    victory.outcome === 'victory';
  return { passed, details: { initial, first, cleared, objective, victory } };
}

async function baseDefenseRun(harness: Harness): Promise<SmokeOutcome> {
  type S = { enemiesRemaining: number; baseHealth: number; lastAction: string; outcome: string };
  await start(harness);
  const initial = await shell<S>(harness);
  await attack(harness, 5);
  const victory = await waitUntil<S>(harness, (state) => state.outcome !== 'playing', 20, 3);

  const passed =
    initial.enemiesRemaining === 2 &&
    initial.baseHealth === 6 &&
    victory.enemiesRemaining === 0 &&
    victory.baseHealth > 0 &&
    victory.outcome === 'victory';
  return { passed, details: { initial, victory } };
}

async function breakoutRun(harness: Harness): Promise<SmokeOutcome> {
  type S = { paddleX: number; ballX: number; ballY: number; bricksRemaining: number; lives: number; score: number; lastAction: string; outcome: string };
  await start(harness);
  const initial = await shell<S>(harness);
  let state = initial;

  // Three-frame tracking is intentionally conservative: it proved stable with
  // all lives intact in the shorter run. Extend the same control policy instead
  // of sampling more coarsely and accidentally turning QA into a worse player.
  for (let step = 0; step < 1400 && state.outcome === 'playing'; step++) {
    const delta = state.ballX - state.paddleX;
    if (Math.abs(delta) > 14) {
      const key = delta < 0 ? 'ArrowLeft' : 'ArrowRight';
      await harness.keyDown(key);
      await harness.stepFrames(3);
      await harness.keyUp(key);
    } else {
      await harness.stepFrames(3);
    }
    state = await shell<S>(harness);
  }

  const passed =
    initial.bricksRemaining === 12 &&
    state.bricksRemaining === 0 &&
    state.score >= 120 &&
    state.lives > 0 &&
    state.outcome === 'complete';
  return { passed, details: { initial, final: state } };
}

async function collectathonRun(harness: Harness): Promise<SmokeOutcome> {
  type S = { x: number; collected: number; score: number; finishBlockedCount: number; lastAction: string; outcome: string };
  await start(harness);
  const initial = await shell<S>(harness);
  const complete = await holdUntil<S>(harness, 'ArrowRight', (state) => state.outcome === 'complete', 150, 4);

  const passed =
    initial.collected === 0 &&
    complete.collected === 3 &&
    complete.score >= 15 &&
    complete.finishBlockedCount === 0 &&
    complete.outcome === 'complete';
  return { passed, details: { initial, complete } };
}

async function endlessRunnerRun(harness: Harness): Promise<SmokeOutcome> {
  type S = { x: number; y: number; elapsedMs: number; collected: number; score: number; hazardHits: number; distanceScore: number; lastAction: string; outcome: string };
  await start(harness);
  const initial = await shell<S>(harness);

  // The player controls jump timing. Launch close enough to the authored
  // obstacle that the normal arc crosses it while airborne rather than landing
  // on it after an unnecessarily early jump.
  const launch = await waitUntil<S>(harness, (state) => state.x >= 405 || state.outcome !== 'playing', 120, 2);
  await harness.keyDown('Space');
  await harness.stepFrames(2);
  await harness.keyUp('Space');
  await harness.stepFrames(5);
  const airborne = await shell<S>(harness);
  const crossed = await waitUntil<S>(harness, (state) => state.x >= 600 || state.outcome !== 'playing', 100, 2);
  const complete = await waitUntil<S>(harness, (state) => state.outcome !== 'playing', 180, 5);

  const passed =
    initial.outcome === 'playing' &&
    launch.collected >= 1 &&
    airborne.lastAction === 'jump' &&
    airborne.y < launch.y &&
    crossed.x >= 600 && crossed.hazardHits === 0 &&
    complete.collected >= 1 &&
    complete.score >= 10 &&
    complete.hazardHits === 0 &&
    complete.elapsedMs >= 9000 &&
    complete.lastAction === 'survived' &&
    complete.outcome === 'complete';
  return { passed, details: { initial, launch, airborne, crossed, complete } };
}

const CANDIDATES: readonly Candidate[] = [
  { id: 'action-adventure', kit: actionAdventure, run: actionAdventureRun },
  { id: 'arena-combat', kit: arenaCombat, run: arenaCombatRun },
  { id: 'base-defense', kit: baseDefense, run: baseDefenseRun },
  { id: 'breakout', kit: breakout, run: breakoutRun },
  { id: 'collectathon-platformer', kit: collectathonPlatformer, run: collectathonRun },
  { id: 'dungeon-crawler', kit: dungeonCrawler, run: dungeonCrawlerRun },
  { id: 'endless-runner', kit: endlessRunner, run: endlessRunnerRun },
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
    console.error('Expanded starter-kit P2-B QA is INCOMPLETE: no system Chrome found.');
    return 1;
  }

  const lockBefore = existsSync(LOCKFILE) ? readFileSync(LOCKFILE, 'utf8') : null;
  const only = new Set(process.argv.slice(2));
  const candidates = only.size > 0 ? CANDIDATES.filter((candidate) => only.has(candidate.id)) : CANDIDATES;
  if (candidates.length === 0) {
    console.error(`No P2-B candidate matched. Known: ${CANDIDATES.map((candidate) => candidate.id).join(', ')}`);
    return 1;
  }

  const results: Result[] = [];
  for (const candidate of candidates) {
    process.stdout.write(`Running P2-B starter candidate ${candidate.id}...\n`);
    const result = await runCandidate(candidate);
    results.push(result);
    console.log(`[${result.passed ? 'PASS' : 'FAIL'}] ${candidate.id}${result.passed ? '' : ` - ${result.detail}`}`);
  }

  const lockAfter = existsSync(LOCKFILE) ? readFileSync(LOCKFILE, 'utf8') : null;
  const lockfileClean = lockBefore === lockAfter;
  console.log(`[${lockfileClean ? 'PASS' : 'FAIL'}] package-lock.json unchanged by P2-B candidate generation/validation`);

  const failed = results.filter((result) => !result.passed);
  console.log(`\n${results.length - failed.length}/${results.length} P2-B starter candidate(s) passed.`);
  return failed.length === 0 && lockfileClean ? 0 : 1;
}

process.exitCode = await main();
