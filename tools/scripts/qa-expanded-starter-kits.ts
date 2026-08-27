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

async function traditionalRun(harness: Harness): Promise<SmokeOutcome> {
  type S = { x: number; y: number; collected: number; hazardHits: number; checkpoint: string | null; outcome: string };
  await start(harness);
  const initial = await shell<S>(harness);

  await hold(harness, 'ArrowRight', 70);
  const checkpoint = await shell<S>(harness);

  await hold(harness, 'ArrowRight', 40);
  const afterHazard = await shell<S>(harness);

  // Respawn returns to the activated checkpoint. Let Arcade settle the body on
  // the ground, then create vertical clearance before applying horizontal
  // motion; holding Right first can legitimately re-enter the spike overlap
  // before the jump edge is consumed.
  await harness.stepFrames(12);
  const settled = await shell<S>(harness);
  await harness.keyTap('Space');
  await harness.stepFrames(8);
  const airborne = await shell<S>(harness);
  await harness.keyDown('ArrowRight');
  await harness.stepFrames(46);
  await harness.keyUp('ArrowRight');
  await harness.stepFrames(4);
  const cleared = await shell<S>(harness);

  await hold(harness, 'ArrowRight', 130);
  const finished = await shell<S>(harness);

  const passed =
    checkpoint.x > initial.x &&
    checkpoint.collected >= 1 &&
    checkpoint.checkpoint === 'mid' &&
    afterHazard.hazardHits >= 1 &&
    settled.hazardHits === afterHazard.hazardHits &&
    airborne.y < settled.y &&
    cleared.x > 480 &&
    cleared.hazardHits === settled.hazardHits &&
    finished.collected >= 2 &&
    finished.outcome === 'complete';
  return { passed, details: { initial, checkpoint, afterHazard, settled, airborne, cleared, finished } };
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

const CANDIDATES: readonly Candidate[] = [
  { id: 'traditional-platformer', kit: traditionalPlatformer, run: traditionalRun },
  { id: 'metroidvania', kit: metroidvania, run: metroidvaniaRun },
  { id: 'bullet-hell', kit: bulletHell, run: bulletHellRun },
  { id: 'stealth-game', kit: stealthGame, run: stealthRun },
  { id: 'top-down-racer', kit: topDownRacer, run: racerRun },
  { id: 'turn-based-tactics', kit: turnBasedTactics, run: tacticsRun },
  { id: 'visual-novel', kit: visualNovel, run: visualNovelRun },
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