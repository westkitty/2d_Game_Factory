import { existsSync, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createGame } from '@sw2d/cli/factory';
import { findSystemChrome, readShellState, runSmoke, type Harness, type SmokeOutcome } from '@sw2d/qa';
import { runCli } from '../../packages/cli/src/index.ts';
import type { StarterKit } from '../../workbench/server/starterKits/contracts.ts';
import { starterKit as autoBattler } from '../../workbench/server/starterKits/expanded/auto-battler.ts';
import { starterKit as simpleRts } from '../../workbench/server/starterKits/expanded/simple-rts.ts';
import { starterKit as territoryControl } from '../../workbench/server/starterKits/expanded/territory-control.ts';

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

async function tapMany(harness: Harness, code: string, times: number, frames = 2): Promise<void> {
  for (let i = 0; i < times; i++) {
    await harness.keyTap(code);
    await harness.stepFrames(frames);
  }
}

async function autoBattlerRun(harness: Harness): Promise<SmokeOutcome> {
  type S = {
    cursor: { col: number; row: number };
    autoBattleStarted: boolean;
    setupPower: number;
    enemiesRemaining: number;
    playerHp: number;
    cursorTextureKey: string;
    panelTextureKey: string | null;
    buttonTextureKey: string | null;
    setupMarkerTextureKey: string | null;
    lastAction: string;
    outcome: string;
  };

  await start(harness);
  const initial = await shell<S>(harness);
  await harness.keyTap('ArrowRight');
  await harness.stepFrames(2);
  const configured = await shell<S>(harness);
  await harness.keyTap('Space');
  await harness.stepFrames(2);
  const started = await shell<S>(harness);
  const victory = await waitUntil<S>(harness, (state) => state.outcome !== 'playing', 70, 5);

  const passed =
    initial.autoBattleStarted === false && initial.enemiesRemaining === 2 && initial.setupPower === 1 &&
    configured.cursor.col === initial.cursor.col + 1 && configured.autoBattleStarted === false && configured.setupPower === 2 &&
    configured.cursorTextureKey.length > 0 && configured.panelTextureKey !== null &&
    configured.buttonTextureKey !== null && configured.setupMarkerTextureKey !== null &&
    started.autoBattleStarted === true && started.lastAction === 'start-battle' &&
    victory.enemiesRemaining === 0 && victory.playerHp > 0 && victory.outcome === 'victory';
  return { passed, details: { initial, configured, started, victory } };
}

async function simpleRtsRun(harness: Harness): Promise<SmokeOutcome> {
  type EnemyState = { cell: { col: number; row: number }; hp: number; alive: boolean };
  type S = {
    cursor: { col: number; row: number };
    playerCell: { col: number; row: number };
    selected: boolean;
    rtsTarget: { col: number; row: number } | null;
    enemiesRemaining: number;
    enemyStates: EnemyState[];
    cursorTextureKey: string;
    objectiveTextureKey: string | null;
    lastAction: string;
    outcome: string;
  };

  await start(harness);
  const initial = await shell<S>(harness);
  await harness.keyTap('Space');
  await harness.stepFrames(2);
  const selected = await shell<S>(harness);

  await tapMany(harness, 'ArrowRight', 5, 1);
  await harness.keyTap('ArrowUp');
  await harness.stepFrames(1);
  await harness.keyTap('Space');
  await harness.stepFrames(2);
  const commandedFirst = await shell<S>(harness);
  const arrivedFirst = await waitUntil<S>(
    harness,
    (state) => state.playerCell.col === 7 && state.playerCell.row === 2,
    90,
    3,
  );
  await harness.keyTap('KeyX');
  const firstKill = await waitUntil<S>(harness, (state) => state.enemiesRemaining === 1, 20, 2);

  await harness.keyTap('ArrowRight');
  await tapMany(harness, 'ArrowDown', 2, 1);
  await harness.keyTap('Space');
  await harness.stepFrames(2);
  const commandedSecond = await shell<S>(harness);
  const arrivedSecond = await waitUntil<S>(
    harness,
    (state) => state.playerCell.col === 8 && state.playerCell.row === 4,
    90,
    3,
  );
  await harness.keyTap('KeyX');
  const victory = await waitUntil<S>(harness, (state) => state.outcome !== 'playing', 20, 2);

  const passed =
    initial.selected === false && initial.enemiesRemaining === 2 &&
    initial.cursorTextureKey.length > 0 && initial.objectiveTextureKey !== null &&
    selected.selected === true && selected.lastAction === 'select' &&
    commandedFirst.rtsTarget?.col === 7 && commandedFirst.rtsTarget?.row === 2 && commandedFirst.lastAction === 'command' &&
    arrivedFirst.playerCell.col === 7 && arrivedFirst.playerCell.row === 2 &&
    firstKill.enemiesRemaining === 1 && firstKill.enemyStates.filter((enemy) => enemy.alive).length === 1 &&
    commandedSecond.rtsTarget?.col === 8 && commandedSecond.rtsTarget?.row === 4 && commandedSecond.lastAction === 'command' &&
    arrivedSecond.playerCell.col === 8 && arrivedSecond.playerCell.row === 4 &&
    victory.enemiesRemaining === 0 && victory.outcome === 'victory';
  return { passed, details: { initial, selected, commandedFirst, arrivedFirst, firstKill, commandedSecond, arrivedSecond, victory } };
}

async function territoryControlRun(harness: Harness): Promise<SmokeOutcome> {
  type S = {
    cursor: { col: number; row: number };
    zones: number[];
    captureProgress: number[];
    contestedZones: boolean[];
    panelTextureKey: string | null;
    cursorTextureKey: string;
    holdScore: number;
    lastAction: string;
    outcome: string;
  };

  await start(harness);
  const initial = await shell<S>(harness);

  await tapMany(harness, 'Space', 3, 2);
  const zoneZero = await shell<S>(harness);

  await tapMany(harness, 'ArrowRight', 4, 1);
  const zoneOneCursor = await shell<S>(harness);
  await tapMany(harness, 'Space', 3, 2);
  const zoneOneContested = await shell<S>(harness);
  await tapMany(harness, 'Space', 2, 2);
  const zoneOne = await shell<S>(harness);

  await tapMany(harness, 'ArrowRight', 4, 1);
  const zoneTwoCursor = await shell<S>(harness);
  await tapMany(harness, 'Space', 3, 2);
  const zoneTwoContested = await shell<S>(harness);
  await tapMany(harness, 'Space', 2, 2);
  const zoneTwo = await shell<S>(harness);
  const victory = await waitUntil<S>(harness, (state) => state.outcome !== 'playing', 80, 4);

  const passed =
    initial.zones.every((zone) => zone === 0) &&
    initial.contestedZones[0] === false && initial.contestedZones[1] === true && initial.contestedZones[2] === true &&
    initial.panelTextureKey !== null && initial.cursorTextureKey.length > 0 &&
    zoneZero.zones[0] === 1 && zoneZero.lastAction === 'capture' &&
    zoneOneCursor.cursor.col >= 4 && zoneOneCursor.cursor.col < 8 && zoneOneCursor.contestedZones[1] === true &&
    zoneOneContested.zones[1] === 0 && zoneOneContested.captureProgress[1]! < 100 && zoneOneContested.lastAction === 'capture-contested' &&
    zoneOne.zones[1] === 1 && zoneOne.lastAction === 'capture-contested' &&
    zoneTwoCursor.cursor.col >= 8 && zoneTwoCursor.contestedZones[2] === true &&
    zoneTwoContested.zones[2] === 0 && zoneTwoContested.captureProgress[2]! < 100 && zoneTwoContested.lastAction === 'capture-contested' &&
    zoneTwo.zones[2] === 1 && zoneTwo.lastAction === 'capture-contested' &&
    victory.zones.every((zone) => zone === 1) && victory.holdScore >= 8 &&
    victory.outcome === 'victory';
  return { passed, details: { initial, zoneZero, zoneOneCursor, zoneOneContested, zoneOne, zoneTwoCursor, zoneTwoContested, zoneTwo, victory } };
}

const CANDIDATES: readonly Candidate[] = [
  { id: 'auto-battler', kit: autoBattler, run: autoBattlerRun },
  { id: 'simple-rts', kit: simpleRts, run: simpleRtsRun },
  { id: 'territory-control', kit: territoryControl, run: territoryControlRun },
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
    console.error('Expanded starter-kit P3-B QA is INCOMPLETE: no system Chrome found.');
    return 1;
  }
  const lockBefore = existsSync(LOCKFILE) ? readFileSync(LOCKFILE, 'utf8') : null;
  const results: Result[] = [];
  for (const candidate of CANDIDATES) {
    process.stdout.write(`Running P3-B starter candidate ${candidate.id}...\n`);
    const result = await runCandidate(candidate);
    results.push(result);
    console.log(`[${result.passed ? 'PASS' : 'FAIL'}] ${candidate.id}${result.passed ? '' : ` - ${result.detail}`}`);
  }
  const lockAfter = existsSync(LOCKFILE) ? readFileSync(LOCKFILE, 'utf8') : null;
  const lockfileClean = lockBefore === lockAfter;
  console.log(`[${lockfileClean ? 'PASS' : 'FAIL'}] package-lock.json unchanged by P3-B candidate generation/validation`);
  const failed = results.filter((result) => !result.passed);
  console.log(`\n${results.length - failed.length}/${results.length} P3-B starter candidate(s) passed.`);
  return failed.length === 0 && lockfileClean ? 0 : 1;
}

process.exitCode = await main();
