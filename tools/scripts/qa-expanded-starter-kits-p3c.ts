import { existsSync, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createGame } from '@sw2d/cli/factory';
import { findSystemChrome, readShellState, runSmoke, type Harness, type SmokeOutcome } from '@sw2d/qa';
import { runCli } from '../../packages/cli/src/index.ts';
import type { StarterKit } from '../../workbench/server/starterKits/contracts.ts';
import { starterKit as actionRoguelite } from '../../workbench/server/starterKits/expanded/action-roguelite.ts';
import { starterKit as bossRush } from '../../workbench/server/starterKits/expanded/boss-rush.ts';
import { starterKit as heistGame } from '../../workbench/server/starterKits/expanded/heist-game.ts';
import { starterKit as survivorLike } from '../../workbench/server/starterKits/expanded/survivor-like.ts';

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

async function attack(harness: Harness, times: number, frames = 3): Promise<void> {
  for (let i = 0; i < times; i++) {
    await harness.keyTap('KeyX');
    await harness.stepFrames(frames);
  }
}

async function actionRogueliteRun(harness: Harness): Promise<SmokeOutcome> {
  type S = {
    x: number; y: number; enemiesRemaining: number; upgradeCollected: boolean;
    attackDamage: number; runResets: number; lastAction: string; outcome: string;
    particleTextureKey: string; particleEffects: number;
  };
  await start(harness);
  const initial = await shell<S>(harness);

  await holdUntil<S>(harness, 'ArrowUp', (state) => state.y <= 205, 45, 4);
  await holdUntil<S>(harness, 'ArrowRight', (state) => state.x >= 330, 55, 4);
  await attack(harness, 2);
  const first = await shell<S>(harness);

  await holdUntil<S>(harness, 'ArrowDown', (state) => state.y >= 335, 55, 4);
  await holdUntil<S>(harness, 'ArrowRight', (state) => state.x >= 455, 45, 4);
  await attack(harness, 2);
  const cleared = await waitUntil<S>(harness, (state) => state.enemiesRemaining === 0, 20, 2);

  await holdUntil<S>(harness, 'ArrowUp', (state) => state.y <= 285, 30, 4);
  const upgraded = await holdUntil<S>(harness, 'ArrowLeft', (state) => state.upgradeCollected || state.x <= 490, 35, 4);
  const victory = await waitUntil<S>(harness, (state) => state.outcome === 'victory', 20, 2);

  await harness.keyTap('KeyC');
  await harness.stepFrames(4);
  const reset = await shell<S>(harness);

  const passed =
    initial.enemiesRemaining === 2 && initial.attackDamage === 1 && initial.runResets === 0 &&
    initial.particleTextureKey.length > 0 && initial.particleEffects === 0 &&
    first.enemiesRemaining === 1 && first.particleEffects >= 2 &&
    cleared.enemiesRemaining === 0 && cleared.particleEffects >= 4 &&
    upgraded.upgradeCollected === true && upgraded.attackDamage === 2 &&
    victory.outcome === 'victory' &&
    reset.runResets === 1 && reset.outcome === 'playing' && reset.enemiesRemaining === 2 &&
    reset.upgradeCollected === false && reset.attackDamage === 1 && reset.particleEffects === 0;
  return { passed, details: { initial, first, cleared, upgraded, victory, reset } };
}

async function bossRushRun(harness: Harness): Promise<SmokeOutcome> {
  type S = {
    x: number; y: number; bossPhase: number; bossHealth: number; bossSpeed: number;
    enemiesRemaining: number; playerHealth: number; outcome: string; particleEffects: number;
    hazardTextureKey: string | null; bossMarkerTextureKey: string | null;
  };
  await start(harness);
  const initial = await shell<S>(harness);
  await holdUntil<S>(harness, 'ArrowRight', (state) => state.x >= 455, 70, 4);
  await attack(harness, 6);
  const phaseTwo = await waitUntil<S>(harness, (state) => state.bossPhase >= 2, 25, 2);
  await attack(harness, 8);
  const victory = await waitUntil<S>(harness, (state) => state.outcome !== 'playing', 30, 2);

  const passed =
    initial.bossPhase === 1 && initial.bossHealth === 6 && initial.enemiesRemaining === 1 &&
    initial.bossSpeed === 22 && initial.hazardTextureKey !== null && initial.bossMarkerTextureKey !== null &&
    phaseTwo.bossPhase === 2 && phaseTwo.bossHealth === 8 && phaseTwo.bossSpeed === 44 &&
    phaseTwo.bossSpeed > initial.bossSpeed && phaseTwo.particleEffects >= 6 &&
    victory.bossPhase === 3 && victory.enemiesRemaining === 0 && victory.particleEffects >= 14 &&
    victory.playerHealth > 0 && victory.outcome === 'victory';
  return { passed, details: { initial, phaseTwo, victory } };
}

async function heistRun(harness: Harness): Promise<SmokeOutcome> {
  type S = {
    x: number; y: number; objectiveCollected: boolean; alarm: boolean; guardSeesPlayer: boolean;
    guardZoneVisible: boolean; hazardTextureKey: string | null; outcome: string; lastAction: string;
  };
  await start(harness);
  const initial = await shell<S>(harness);

  const nearExit = await holdUntil<S>(harness, 'ArrowUp', (state) => state.y <= 100, 55, 4);
  await harness.stepFrames(3);
  const blockedExit = await shell<S>(harness);

  await holdUntil<S>(harness, 'ArrowRight', (state) => state.x >= 760, 120, 4);
  const stolen = await holdUntil<S>(harness, 'ArrowDown', (state) => state.objectiveCollected, 30, 3);

  await holdUntil<S>(harness, 'ArrowUp', (state) => state.y <= 100, 30, 3);
  const victory = await holdUntil<S>(harness, 'ArrowLeft', (state) => state.outcome === 'victory', 150, 4);

  const passed =
    initial.objectiveCollected === false && initial.alarm === false &&
    initial.guardZoneVisible === true && initial.hazardTextureKey !== null &&
    nearExit.y <= 100 && blockedExit.outcome === 'playing' && blockedExit.objectiveCollected === false &&
    stolen.objectiveCollected === true && stolen.alarm === true && stolen.lastAction === 'objective' &&
    victory.objectiveCollected === true && victory.alarm === true && victory.outcome === 'victory' &&
    victory.guardZoneVisible === true && victory.hazardTextureKey !== null;
  return { passed, details: { initial, nearExit, blockedExit, stolen, victory } };
}

async function survivorRun(harness: Harness): Promise<SmokeOutcome> {
  type S = {
    x: number; y: number; spawnedTotal: number; enemiesRemaining: number; upgradeCollected: boolean;
    upgradeAvailable: boolean; attackDamage: number; playerHealth: number; elapsedMs: number;
    outcome: string; particleEffects: number;
  };
  await start(harness);
  const initial = await shell<S>(harness);

  await holdUntil<S>(harness, 'ArrowUp', (state) => state.y <= 105, 55, 4);
  const pressure = await waitUntil<S>(harness, (state) => state.spawnedTotal >= 3, 120, 4);
  const upgradeReady = await waitUntil<S>(harness, (state) => state.elapsedMs >= 7200, 100, 4);
  const preUpgradeGate = await waitUntil<S>(harness, (state) => state.elapsedMs >= 15100 || state.outcome !== 'playing', 180, 4);

  await holdUntil<S>(harness, 'ArrowRight', (state) => state.x >= 455, 100, 4);
  await holdUntil<S>(harness, 'ArrowDown', (state) => state.y >= 250, 60, 4);
  await harness.keyTap('KeyE');
  await harness.stepFrames(3);
  const upgraded = await shell<S>(harness);
  const victory = await waitUntil<S>(harness, (state) => state.outcome !== 'playing', 30, 2);

  const passed =
    initial.spawnedTotal === 0 && initial.attackDamage === 1 && initial.particleEffects === 0 &&
    pressure.spawnedTotal >= 3 && pressure.outcome === 'playing' &&
    upgradeReady.elapsedMs >= 7000 && upgradeReady.upgradeAvailable === true && upgradeReady.upgradeCollected === false && upgradeReady.particleEffects > 0 &&
    preUpgradeGate.elapsedMs >= 15000 && preUpgradeGate.upgradeCollected === false &&
    preUpgradeGate.playerHealth > 0 && preUpgradeGate.outcome === 'playing' &&
    upgraded.upgradeCollected === true && upgraded.upgradeAvailable === false && upgraded.attackDamage === 2 &&
    victory.upgradeCollected === true && victory.spawnedTotal >= 6 && victory.particleEffects > 0 &&
    victory.playerHealth > 0 && victory.outcome === 'victory';
  return { passed, details: { initial, pressure, upgradeReady, preUpgradeGate, upgraded, victory } };
}

const CANDIDATES: readonly Candidate[] = [
  { id: 'action-roguelite', kit: actionRoguelite, run: actionRogueliteRun },
  { id: 'boss-rush', kit: bossRush, run: bossRushRun },
  { id: 'heist-game', kit: heistGame, run: heistRun },
  { id: 'survivor-like', kit: survivorLike, run: survivorRun },
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
    console.error('Expanded starter-kit P3-C QA is INCOMPLETE: no system Chrome found.');
    return 1;
  }
  const lockBefore = existsSync(LOCKFILE) ? readFileSync(LOCKFILE, 'utf8') : null;
  const results: Result[] = [];
  for (const candidate of CANDIDATES) {
    process.stdout.write(`Running P3-C starter candidate ${candidate.id}...\n`);
    const result = await runCandidate(candidate);
    results.push(result);
    console.log(`[${result.passed ? 'PASS' : 'FAIL'}] ${candidate.id}${result.passed ? '' : ` - ${result.detail}`}`);
  }
  const lockAfter = existsSync(LOCKFILE) ? readFileSync(LOCKFILE, 'utf8') : null;
  const lockfileClean = lockBefore === lockAfter;
  console.log(`[${lockfileClean ? 'PASS' : 'FAIL'}] package-lock.json unchanged by P3-C candidate generation/validation`);
  const failed = results.filter((result) => !result.passed);
  console.log(`\n${results.length - failed.length}/${results.length} P3-C starter candidate(s) passed.`);
  return failed.length === 0 && lockfileClean ? 0 : 1;
}

process.exitCode = await main();
