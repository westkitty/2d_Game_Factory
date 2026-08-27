import { existsSync, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createGame } from '@sw2d/cli/factory';
import { findSystemChrome, readShellState, runSmoke, type Harness, type SmokeOutcome } from '@sw2d/qa';
import type { StarterKit } from '../../workbench/server/starterKits/contracts.ts';
import { runCli } from '../../packages/cli/src/index.ts';
import { starterKit as traditionalPlatformer } from '../../workbench/server/starterKits/expanded/traditional-platformer.ts';
import { starterKit as metroidvania } from '../../workbench/server/starterKits/expanded/metroidvania.ts';
import { starterKit as bulletHell } from '../../workbench/server/starterKits/expanded/bullet-hell.ts';
import { starterKit as stealthGame } from '../../workbench/server/starterKits/expanded/stealth-game.ts';
import { starterKit as topDownRacer } from '../../workbench/server/starterKits/expanded/top-down-racer.ts';
import { starterKit as turnBasedTactics } from '../../workbench/server/starterKits/expanded/turn-based-tactics.ts';
import { starterKit as visualNovel } from '../../workbench/server/starterKits/expanded/visual-novel.ts';
import { starterKit as timeTrialRacer } from '../../workbench/server/starterKits/expanded/time-trial-racer.ts';
import { starterKit as reactionTiming } from '../../workbench/server/starterKits/expanded/reaction-timing.ts';
import { starterKit as shopkeeper } from '../../workbench/server/starterKits/expanded/shopkeeper.ts';
import { starterKit as tycoonLite } from '../../workbench/server/starterKits/expanded/tycoon-lite.ts';
import { starterKit as autoRunner } from '../../workbench/server/starterKits/expanded/auto-runner.ts';
import { starterKit as puzzlePlatformer } from '../../workbench/server/starterKits/expanded/puzzle-platformer.ts';
import { starterKit as topDownAdventure } from '../../workbench/server/starterKits/expanded/top-down-adventure.ts';

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

async function restartPlay(harness: Harness): Promise<void> {
  await harness.keyTap('KeyP');
  await harness.stepFrames(3);
  await harness.keyTap('KeyK');
  await harness.stepFrames(12);
}

async function shell<T>(harness: Harness): Promise<T> {
  return readShellState<T>(harness, DEBUG_KEY);
}

async function hold(harness: Harness, code: string, frames: number): Promise<void> {
  await harness.keyDown(code);
  await harness.stepFrames(frames);
  await harness.keyUp(code);
  await harness.stepFrames(2);
}

async function waitUntil<T>(
  harness: Harness,
  predicate: (state: T) => boolean,
  maxSteps = 80,
  framesPerStep = 5,
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
  maxSteps = 80,
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

async function traditionalRun(harness: Harness): Promise<SmokeOutcome> {
  type S = { x: number; y: number; collected: number; hazardHits: number; checkpoint: string | null; outcome: string };
  await start(harness);
  const initial = await shell<S>(harness);

  await hold(harness, 'ArrowRight', 70);
  const checkpoint = await shell<S>(harness);

  await harness.keyDown('ArrowRight');
  let afterHazard = checkpoint;
  for (let i = 0; i < 40 && afterHazard.hazardHits === checkpoint.hazardHits; i++) {
    await harness.stepFrames(2);
    afterHazard = await shell<S>(harness);
  }
  await harness.keyUp('ArrowRight');
  await harness.stepFrames(3);
  const respawned = await shell<S>(harness);

  await harness.stepFrames(10);
  const settled = await shell<S>(harness);
  await harness.keyDown('ArrowRight');
  await harness.keyTap('Space');
  await harness.stepFrames(7);
  const airborne = await shell<S>(harness);

  let cleared = airborne;
  for (let i = 0; i < 40 && cleared.x < 500 && cleared.hazardHits === settled.hazardHits; i++) {
    await harness.stepFrames(2);
    cleared = await shell<S>(harness);
  }
  await harness.keyUp('ArrowRight');
  await harness.stepFrames(4);

  await hold(harness, 'ArrowRight', 130);
  const finished = await shell<S>(harness);

  const passed =
    checkpoint.x > initial.x &&
    checkpoint.collected >= 1 &&
    checkpoint.checkpoint === 'mid' &&
    afterHazard.hazardHits === checkpoint.hazardHits + 1 &&
    respawned.hazardHits === afterHazard.hazardHits &&
    respawned.x < 350 &&
    settled.hazardHits === afterHazard.hazardHits &&
    airborne.x > settled.x &&
    airborne.y < settled.y &&
    cleared.x >= 500 &&
    cleared.hazardHits === settled.hazardHits &&
    finished.collected >= 2 &&
    finished.outcome === 'complete';
  return { passed, details: { initial, checkpoint, afterHazard, respawned, settled, airborne, cleared, finished } };
}

async function metroidvaniaRun(harness: Harness): Promise<SmokeOutcome> {
  type S = { x: number; abilityUnlocked: boolean; gateBlockedCount: number; doubleJumpUsed: boolean; outcome: string };
  await start(harness);
  await hold(harness, 'ArrowLeft', 55);
  const blocked = await shell<S>(harness);

  await hold(harness, 'ArrowRight', 185);
  const unlocked = await shell<S>(harness);

  await harness.keyTap('Space');
  await harness.stepFrames(4);
  await harness.keyTap('Space');
  await harness.stepFrames(8);
  const doubleJump = await shell<S>(harness);

  await hold(harness, 'ArrowLeft', 230);
  const backtracked = await shell<S>(harness);

  const passed =
    blocked.gateBlockedCount > 0 &&
    blocked.x >= 175 &&
    unlocked.abilityUnlocked === true &&
    doubleJump.doubleJumpUsed === true &&
    backtracked.x < 175 &&
    backtracked.outcome === 'complete';
  return { passed, details: { blocked, unlocked, doubleJump, backtracked } };
}

async function bulletHellRun(harness: Harness): Promise<SmokeOutcome> {
  type S = { patternBursts: number; enemyBulletsSpawned: number; playerHealth: number; enemiesRemaining: number; shotsFired: number; hits: number; outcome: string };
  await start(harness);
  await harness.stepFrames(80);
  const pattern = await shell<S>(harness);

  for (let shot = 0; shot < 12; shot++) {
    await harness.keyTap('KeyX');
    await harness.stepFrames(8);
  }
  await harness.stepFrames(100);
  const resolved = await shell<S>(harness);

  const passed =
    pattern.patternBursts >= 3 &&
    pattern.enemyBulletsSpawned >= 24 &&
    resolved.shotsFired >= 10 &&
    resolved.hits >= 1 &&
    resolved.enemiesRemaining === 0 &&
    resolved.outcome === 'victory' &&
    resolved.playerHealth > 0;
  return { passed, details: { pattern, resolved } };
}

async function stealthRun(harness: Harness): Promise<SmokeOutcome> {
  type S = { x: number; y: number; objectiveCollected: boolean; alarm: boolean; guardSeesPlayer: boolean; outcome: string };
  await start(harness);
  await hold(harness, 'ArrowRight', 100);
  const detected = await shell<S>(harness);

  await restartPlay(harness);
  await hold(harness, 'ArrowUp', 46);
  await hold(harness, 'ArrowRight', 185);
  const objective = await shell<S>(harness);
  await hold(harness, 'ArrowLeft', 190);
  const escaped = await shell<S>(harness);

  const passed =
    detected.alarm === true &&
    detected.outcome === 'failed' &&
    objective.objectiveCollected === true &&
    objective.alarm === false &&
    escaped.alarm === false &&
    escaped.outcome === 'victory';
  return { passed, details: { detected, objective, escaped } };
}

async function racerRun(harness: Harness): Promise<SmokeOutcome> {
  type S = { x: number; speed: number; checkpointIndex: number; finishTimeMs: number | null; outcome: string };
  await start(harness);
  const initial = await shell<S>(harness);
  await hold(harness, 'ArrowUp', 30);
  const accelerated = await shell<S>(harness);
  await hold(harness, 'ArrowDown', 10);
  const braked = await shell<S>(harness);

  await harness.keyDown('ArrowUp');
  let finished = braked;
  for (let block = 0; block < 25 && finished.outcome === 'racing'; block++) {
    await harness.stepFrames(20);
    finished = await shell<S>(harness);
  }
  await harness.keyUp('ArrowUp');

  const passed =
    accelerated.x > initial.x &&
    accelerated.speed > 0 &&
    braked.speed < accelerated.speed &&
    finished.checkpointIndex === 3 &&
    finished.finishTimeMs !== null &&
    finished.outcome === 'finished';
  return { passed, details: { initial, accelerated, braked, finished } };
}

async function tacticsRun(harness: Harness): Promise<SmokeOutcome> {
  type S = { playerCell: { col: number; row: number }; playerHp: number; turnsCompleted: number; enemiesRemaining: number; lastAction: string; outcome: string };
  await start(harness);
  await harness.keyTap('ArrowRight');
  await harness.keyTap('Space');
  const afterMove = await shell<S>(harness);

  await harness.keyTap('ArrowRight');
  await harness.keyTap('KeyX');
  const afterFirstAttack = await shell<S>(harness);
  await harness.keyTap('KeyX');
  const victory = await shell<S>(harness);

  const passed =
    afterMove.playerCell.col === 3 &&
    afterMove.turnsCompleted >= 1 &&
    afterMove.playerHp < 4 &&
    afterFirstAttack.enemiesRemaining === 1 &&
    victory.enemiesRemaining === 0 &&
    victory.lastAction === 'player-attack' &&
    victory.outcome === 'victory';
  return { passed, details: { afterMove, afterFirstAttack, victory } };
}

async function visualNovelRun(harness: Harness): Promise<SmokeOutcome> {
  type S = { dialogueStep: number; selectedChoice: number; branch: string | null; ending: string | null; outcome: string };
  await start(harness);
  await harness.keyTap('Space');
  await harness.keyTap('Space');
  await harness.keyTap('ArrowRight');
  const choosing = await shell<S>(harness);
  await harness.keyTap('Space');
  const branched = await shell<S>(harness);
  await harness.keyTap('Space');
  const midnight = await shell<S>(harness);

  await restartPlay(harness);
  await harness.keyTap('Space');
  await harness.keyTap('Space');
  await harness.keyTap('ArrowLeft');
  await harness.keyTap('Space');
  await harness.keyTap('Space');
  const dawn = await shell<S>(harness);

  const passed =
    choosing.dialogueStep === 2 && choosing.selectedChoice === 1 &&
    branched.branch === 'keep-the-secret' &&
    midnight.ending === 'midnight-ending' && midnight.outcome === 'complete' &&
    dawn.ending === 'dawn-ending' && dawn.outcome === 'complete';
  return { passed, details: { choosing, branched, midnight, dawn } };
}

async function timeTrialRun(harness: Harness): Promise<SmokeOutcome> {
  type S = { x: number; speed: number; checkpointIndex: number; lastCheckpointAttempt: number; finishTimeMs: number | null; targetBeaten: boolean | null; outcome: string };
  await start(harness);
  const initial = await shell<S>(harness);
  const finished = await holdUntil<S>(harness, 'ArrowUp', (state) => state.outcome === 'finished', 110, 8);
  const passed =
    finished.x > initial.x &&
    finished.speed > 0 &&
    finished.checkpointIndex === 3 &&
    finished.lastCheckpointAttempt === 2 &&
    finished.finishTimeMs !== null &&
    finished.finishTimeMs <= 12000 &&
    finished.targetBeaten === true &&
    finished.outcome === 'finished';
  return { passed, details: { initial, finished } };
}

async function reactionTimingRun(harness: Harness): Promise<SmokeOutcome> {
  type S = { reactionRound: number; reactionSignal: boolean; reactionTimes: number[]; falseStarts: number; lastAction: string; outcome: string };
  await start(harness);
  await harness.keyTap('KeyX');
  await harness.stepFrames(2);
  const falseStart = await shell<S>(harness);

  const signals: S[] = [];
  let final = falseStart;
  for (let round = 0; round < 3; round++) {
    const signaled = await waitUntil<S>(harness, (state) => state.reactionSignal, 60, 4);
    signals.push(signaled);
    if (!signaled.reactionSignal) break;
    await harness.keyTap('KeyX');
    await harness.stepFrames(2);
    final = await shell<S>(harness);
  }

  const passed =
    falseStart.falseStarts >= 1 &&
    signals.length === 3 &&
    signals.every((state) => state.reactionSignal) &&
    final.reactionRound === 3 &&
    final.reactionTimes.length === 3 &&
    final.reactionTimes.every((time) => time >= 0) &&
    final.outcome === 'complete';
  return { passed, details: { falseStart, signals, final } };
}

async function shopkeeperRun(harness: Harness): Promise<SmokeOutcome> {
  type S = { currency: number; stock: number; sellValue: number; sales: number; upgradeA: number; lastAction: string; outcome: string };
  await start(harness);
  for (let restock = 0; restock < 6; restock++) {
    await harness.keyTap('KeyX');
    await harness.stepFrames(2);
  }
  const stocked = await shell<S>(harness);
  const soldFour = await waitUntil<S>(harness, (state) => state.sales >= 4, 60, 10);
  await harness.keyTap('KeyC');
  await harness.stepFrames(2);
  const upgraded = await shell<S>(harness);
  const complete = await waitUntil<S>(harness, (state) => state.outcome === 'complete', 40, 10);

  const passed =
    stocked.stock >= 6 &&
    soldFour.sales >= 4 &&
    upgraded.upgradeA >= 1 &&
    upgraded.sellValue >= 8 &&
    complete.sales >= 5 &&
    complete.currency >= 18 &&
    complete.outcome === 'complete';
  return { passed, details: { stocked, soldFour, upgraded, complete } };
}

async function tycoonRun(harness: Harness): Promise<SmokeOutcome> {
  type S = { currency: number; upgradeA: number; upgradeB: number; incomeRate: number; businessValue: number; lastAction: string; outcome: string };
  await start(harness);
  await harness.keyTap('KeyC');
  await harness.stepFrames(2);
  const upgradeB = await shell<S>(harness);
  const fundedA = await waitUntil<S>(harness, (state) => state.currency >= 11, 60, 5);
  await harness.keyTap('KeyX');
  await harness.stepFrames(2);
  const upgradeA = await shell<S>(harness);
  const complete = await waitUntil<S>(harness, (state) => state.outcome === 'complete', 120, 5);

  const passed =
    upgradeB.upgradeB === 1 &&
    fundedA.currency >= 11 &&
    upgradeA.upgradeA === 1 &&
    upgradeA.upgradeB === 1 &&
    upgradeA.incomeRate >= 5 &&
    complete.businessValue >= 70 &&
    complete.outcome === 'complete';
  return { passed, details: { upgradeB, fundedA, upgradeA, complete } };
}

async function autoRunnerRun(harness: Harness): Promise<SmokeOutcome> {
  type S = { x: number; y: number; hazardHits: number; distanceScore: number; lastAction: string; outcome: string };
  await start(harness);
  const failed = await waitUntil<S>(harness, (state) => state.outcome === 'failed', 100, 4);

  await restartPlay(harness);
  const restarted = await shell<S>(harness);
  const launch = await waitUntil<S>(harness, (state) => state.x >= 300 || state.outcome !== 'playing', 100, 2);
  await harness.keyTap('Space');
  await harness.stepFrames(6);
  const airborne = await shell<S>(harness);
  const crossed = await waitUntil<S>(harness, (state) => state.x >= 520 || state.outcome !== 'playing', 100, 2);
  const complete = await waitUntil<S>(harness, (state) => state.outcome === 'complete', 160, 4);

  const passed =
    failed.hazardHits >= 1 &&
    failed.outcome === 'failed' &&
    restarted.hazardHits === 0 &&
    launch.x >= 300 && launch.x < 390 &&
    airborne.y < launch.y &&
    crossed.x >= 520 && crossed.hazardHits === 0 &&
    complete.hazardHits === 0 &&
    complete.outcome === 'complete';
  return { passed, details: { failed, restarted, launch, airborne, crossed, complete } };
}

async function puzzlePlatformerRun(harness: Harness): Promise<SmokeOutcome> {
  type S = { x: number; puzzleSolved: boolean; switchActivations: number; finishBlockedCount: number; lastAction: string; outcome: string };
  await start(harness);
  const blocked = await holdUntil<S>(harness, 'ArrowRight', (state) => state.finishBlockedCount > 0, 140, 4);

  await restartPlay(harness);
  const switchApproach = await holdUntil<S>(harness, 'ArrowRight', (state) => state.x >= 500, 100, 4);
  await harness.keyTap('KeyE');
  await harness.stepFrames(3);
  const solved = await shell<S>(harness);
  const complete = await holdUntil<S>(harness, 'ArrowRight', (state) => state.outcome === 'complete', 140, 4);

  const passed =
    blocked.finishBlockedCount > 0 &&
    blocked.puzzleSolved === false &&
    blocked.outcome === 'playing' &&
    switchApproach.x >= 500 &&
    solved.puzzleSolved === true &&
    solved.switchActivations >= 1 &&
    complete.outcome === 'complete';
  return { passed, details: { blocked, switchApproach, solved, complete } };
}

async function topDownAdventureRun(harness: Harness): Promise<SmokeOutcome> {
  type S = { x: number; y: number; objectiveCollected: boolean; enemiesRemaining: number; playerHealth: number; lastAction: string; outcome: string };
  await start(harness);
  const initial = await shell<S>(harness);
  const north = await holdUntil<S>(harness, 'ArrowUp', (state) => state.y <= 185, 60, 4);
  const objective = await holdUntil<S>(harness, 'ArrowRight', (state) => state.objectiveCollected, 110, 4);
  const south = await holdUntil<S>(harness, 'ArrowDown', (state) => state.y >= 395, 80, 4);
  const victory = await holdUntil<S>(harness, 'ArrowRight', (state) => state.outcome === 'victory', 80, 4);

  const passed =
    initial.objectiveCollected === false &&
    north.y < initial.y &&
    objective.objectiveCollected === true &&
    objective.enemiesRemaining === 0 &&
    south.y > objective.y &&
    victory.objectiveCollected === true &&
    victory.enemiesRemaining === 0 &&
    victory.playerHealth > 0 &&
    victory.outcome === 'victory';
  return { passed, details: { initial, north, objective, south, victory } };
}

const CANDIDATES: readonly Candidate[] = [
  { id: 'traditional-platformer', kit: traditionalPlatformer, run: traditionalRun },
  { id: 'metroidvania', kit: metroidvania, run: metroidvaniaRun },
  { id: 'bullet-hell', kit: bulletHell, run: bulletHellRun },
  { id: 'stealth-game', kit: stealthGame, run: stealthRun },
  { id: 'top-down-racer', kit: topDownRacer, run: racerRun },
  { id: 'turn-based-tactics', kit: turnBasedTactics, run: tacticsRun },
  { id: 'visual-novel', kit: visualNovel, run: visualNovelRun },
  { id: 'time-trial-racer', kit: timeTrialRacer, run: timeTrialRun },
  { id: 'reaction-timing', kit: reactionTiming, run: reactionTimingRun },
  { id: 'shopkeeper', kit: shopkeeper, run: shopkeeperRun },
  { id: 'tycoon-lite', kit: tycoonLite, run: tycoonRun },
  { id: 'auto-runner', kit: autoRunner, run: autoRunnerRun },
  { id: 'puzzle-platformer', kit: puzzlePlatformer, run: puzzlePlatformerRun },
  { id: 'top-down-adventure', kit: topDownAdventure, run: topDownAdventureRun },
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
    console.error('Expanded starter-kit QA is INCOMPLETE: no system Chrome found.');
    return 1;
  }

  const lockBefore = existsSync(LOCKFILE) ? readFileSync(LOCKFILE, 'utf8') : null;
  const only = new Set(process.argv.slice(2));
  const candidates = only.size > 0 ? CANDIDATES.filter((candidate) => only.has(candidate.id)) : CANDIDATES;
  if (candidates.length === 0) {
    console.error(`No starter-kit candidate matched. Known: ${CANDIDATES.map((candidate) => candidate.id).join(', ')}`);
    return 1;
  }

  const results: Result[] = [];
  for (const candidate of candidates) {
    process.stdout.write(`Running expanded starter candidate ${candidate.id}...\n`);
    const result = await runCandidate(candidate);
    results.push(result);
    console.log(`[${result.passed ? 'PASS' : 'FAIL'}] ${candidate.id}${result.passed ? '' : ` - ${result.detail}`}`);
  }

  const lockAfter = existsSync(LOCKFILE) ? readFileSync(LOCKFILE, 'utf8') : null;
  const lockfileClean = lockBefore === lockAfter;
  console.log(`[${lockfileClean ? 'PASS' : 'FAIL'}] package-lock.json unchanged by candidate generation/validation`);

  const failed = results.filter((result) => !result.passed);
  console.log(`\n${results.length - failed.length}/${results.length} expanded starter candidate(s) passed.`);
  return failed.length === 0 && lockfileClean ? 0 : 1;
}

process.exitCode = await main();