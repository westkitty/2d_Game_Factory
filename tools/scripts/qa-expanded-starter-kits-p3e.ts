import { existsSync, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createGame } from '@sw2d/cli/factory';
import { findSystemChrome, readShellState, runSmoke, type Harness, type SmokeOutcome } from '@sw2d/qa';
import { runCli } from '../../packages/cli/src/index.ts';
import type { StarterKit } from '../../workbench/server/starterKits/contracts.ts';
import { starterKit as fallingBlockPuzzle } from '../../workbench/server/starterKits/expanded/falling-block-puzzle.ts';
import { starterKit as matchPuzzle } from '../../workbench/server/starterKits/expanded/match-puzzle.ts';
import { starterKit as pong } from '../../workbench/server/starterKits/expanded/pong.ts';

const REPO_ROOT = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '../..');
const GAMES_ROOT = path.join(REPO_ROOT, 'games');
const LOCKFILE = path.join(REPO_ROOT, 'package-lock.json');
const DEBUG_KEY = 'game.expanded-starter';
const VIEWPORT_MID_Y = 270;

interface PuzzleState {
  readonly outcome: string;
  readonly lastAction: string;
  readonly score: number;
  readonly cursor: { readonly col: number; readonly row: number };
  readonly selected: { readonly col: number; readonly row: number } | null;
  readonly boardRevision: number;
  readonly matchesCleared: number;
  readonly pieceRow: number;
  readonly pieceCol: number;
  readonly pieceRotated: boolean;
  readonly linesCleared: number;
  readonly paddleY: number;
  readonly ballX: number;
  readonly ballY: number;
  readonly playerScore: number;
  readonly opponentScore: number;
}

interface Candidate {
  readonly id: string;
  readonly kit: StarterKit;
  run(harness: Harness): Promise<SmokeOutcome>;
}

async function start(harness: Harness): Promise<void> {
  await harness.keyTap('Space');
  await harness.stepFrames(8);
}

async function shell(harness: Harness): Promise<PuzzleState> {
  return readShellState<PuzzleState>(harness, DEBUG_KEY);
}

async function waitUntil(
  harness: Harness,
  predicate: (state: PuzzleState) => boolean,
  maxSteps = 120,
  framesPerStep = 4,
): Promise<PuzzleState> {
  let state = await shell(harness);
  for (let step = 0; step < maxSteps && !predicate(state); step++) {
    await harness.stepFrames(framesPerStep);
    state = await shell(harness);
  }
  return state;
}

async function matchRun(harness: Harness): Promise<SmokeOutcome> {
  await start(harness);
  const initial = await shell(harness);
  await harness.keyTap('Space');
  await harness.stepFrames(2);
  const selected = await shell(harness);
  await harness.keyTap('ArrowDown');
  await harness.stepFrames(2);
  const moved = await shell(harness);
  await harness.keyTap('Space');
  const resolved = await waitUntil(harness, (state) => state.outcome === 'complete' || state.matchesCleared > 0, 20, 2);

  const passed =
    initial.cursor.col === 1 && initial.cursor.row === 0 && initial.matchesCleared === 0 && initial.outcome === 'playing' &&
    selected.selected?.col === 1 && selected.selected?.row === 0 && selected.lastAction === 'select' &&
    moved.cursor.col === 1 && moved.cursor.row === 1 &&
    resolved.selected === null && resolved.boardRevision >= 2 && resolved.matchesCleared === 3 &&
    resolved.score >= 30 && resolved.lastAction === 'match-clear' && resolved.outcome === 'complete';
  return { passed, details: { initial, selected, moved, resolved } };
}

async function fallingRun(harness: Harness): Promise<SmokeOutcome> {
  await start(harness);
  const initial = await shell(harness);
  await harness.keyTap('ArrowRight');
  await harness.stepFrames(2);
  const moved = await shell(harness);
  await harness.keyTap('KeyJ');
  await harness.stepFrames(2);
  const rotated = await shell(harness);
  await harness.keyTap('ArrowLeft');
  await harness.stepFrames(2);
  await harness.keyTap('KeyJ');
  await harness.stepFrames(2);
  const restored = await shell(harness);
  const cleared = await waitUntil(harness, (state) => state.linesCleared >= 1 || state.outcome !== 'playing', 80, 4);

  const passed =
    initial.pieceCol === 2 && initial.pieceRotated === false && initial.linesCleared === 0 &&
    moved.pieceCol === 3 &&
    rotated.pieceCol === 3 && rotated.pieceRotated === true &&
    restored.pieceCol === 2 && restored.pieceRotated === false &&
    cleared.linesCleared === 1 && cleared.score >= 100 && cleared.lastAction === 'line-clear' && cleared.outcome === 'complete';
  return { passed, details: { initial, moved, rotated, restored, cleared } };
}

async function followBallUntilPlayerReturn(harness: Harness): Promise<PuzzleState> {
  let state = await shell(harness);
  for (let step = 0; step < 360 && state.lastAction !== 'player-return'; step++) {
    if (state.ballX < 360) {
      if (state.ballY < state.paddleY - 8) {
        await harness.keyDown('ArrowUp');
        await harness.keyUp('ArrowDown');
      } else if (state.ballY > state.paddleY + 8) {
        await harness.keyDown('ArrowDown');
        await harness.keyUp('ArrowUp');
      } else {
        await harness.keyUp('ArrowUp');
        await harness.keyUp('ArrowDown');
      }
    }
    await harness.stepFrames(2);
    state = await shell(harness);
  }
  await harness.keyUp('ArrowUp');
  await harness.keyUp('ArrowDown');
  await harness.stepFrames(2);
  return shell(harness);
}

async function forceOpponentWin(harness: Harness, initialScore: number): Promise<PuzzleState> {
  let state = await shell(harness);
  let previousBallX = state.ballX;
  for (let step = 0; step < 1400 && state.opponentScore < 3 && state.outcome === 'playing'; step++) {
    const headingLeft = state.ballX < previousBallX;
    if (headingLeft && state.ballX < 360) {
      // Move the paddle to the opposite half from the incoming ball so the
      // score boundary is reached through the real miss path.
      if (state.ballY < VIEWPORT_MID_Y) {
        await harness.keyDown('ArrowDown');
        await harness.keyUp('ArrowUp');
      } else {
        await harness.keyDown('ArrowUp');
        await harness.keyUp('ArrowDown');
      }
    } else {
      await harness.keyUp('ArrowUp');
      await harness.keyUp('ArrowDown');
    }
    previousBallX = state.ballX;
    await harness.stepFrames(3);
    state = await shell(harness);
  }
  await harness.keyUp('ArrowUp');
  await harness.keyUp('ArrowDown');
  await harness.stepFrames(2);
  const final = await shell(harness);
  if (final.opponentScore < initialScore) throw new Error('pong opponent score regressed');
  return final;
}

async function pongRun(harness: Harness): Promise<SmokeOutcome> {
  await start(harness);
  const initial = await shell(harness);
  const returned = await followBallUntilPlayerReturn(harness);
  await harness.stepFrames(8);
  const afterReturn = await shell(harness);
  const lost = await forceOpponentWin(harness, initial.opponentScore);

  const passed =
    initial.playerScore === 0 && initial.opponentScore === 0 && initial.outcome === 'playing' &&
    returned.lastAction === 'player-return' && returned.paddleY !== initial.paddleY &&
    afterReturn.ballX > returned.ballX &&
    lost.opponentScore === 3 && lost.playerScore < 3 && lost.outcome === 'failed';
  return { passed, details: { initial, returned, afterReturn, lost } };
}

const CANDIDATES: readonly Candidate[] = [
  { id: 'match-puzzle', kit: matchPuzzle, run: matchRun },
  { id: 'falling-block-puzzle', kit: fallingBlockPuzzle, run: fallingRun },
  { id: 'pong', kit: pong, run: pongRun },
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
    console.error('Expanded starter-kit P3-E QA is INCOMPLETE: no system Chrome found.');
    return 1;
  }
  const lockBefore = existsSync(LOCKFILE) ? readFileSync(LOCKFILE, 'utf8') : null;
  const results: Result[] = [];
  for (const candidate of CANDIDATES) {
    process.stdout.write(`Running P3-E starter candidate ${candidate.id}...\n`);
    const result = await runCandidate(candidate);
    results.push(result);
    console.log(`[${result.passed ? 'PASS' : 'FAIL'}] ${candidate.id}${result.passed ? '' : ` - ${result.detail}`}`);
  }
  const lockAfter = existsSync(LOCKFILE) ? readFileSync(LOCKFILE, 'utf8') : null;
  const lockfileClean = lockBefore === lockAfter;
  console.log(`[${lockfileClean ? 'PASS' : 'FAIL'}] package-lock.json unchanged by P3-E candidate generation/validation`);
  const failed = results.filter((result) => !result.passed);
  console.log(`\n${results.length - failed.length}/${results.length} P3-E starter candidate(s) passed.`);
  return failed.length === 0 && lockfileClean ? 0 : 1;
}

process.exitCode = await main();
