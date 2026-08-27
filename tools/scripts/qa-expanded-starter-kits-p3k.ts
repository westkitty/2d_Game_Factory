import { existsSync, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createGame } from '@sw2d/cli/factory';
import { findSystemChrome, readShellState, runSmoke, type Harness, type SmokeOutcome } from '@sw2d/qa';
import { runCli } from '../../packages/cli/src/index.ts';
import type { StarterKit } from '../../workbench/server/starterKits/contracts.ts';
import { narrativeStarterKit } from '../../workbench/server/starterKits/expanded/builders/narrative.ts';

const REPO_ROOT = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '../..');
const GAMES_ROOT = path.join(REPO_ROOT, 'games');
const LOCKFILE = path.join(REPO_ROOT, 'package-lock.json');
const DEBUG_KEY = 'game.expanded-starter';

interface NarrativeState {
  readonly presetId: string;
  readonly family: string;
  readonly x: number;
  readonly y: number;
  readonly playerTextureKey: string;
  readonly backgroundTextureKey: string | null;
  readonly panelRoleSource: string;
  readonly panelTextureKey: string;
  readonly buttonRoleSource: string | null;
  readonly buttonTextureKey: string | null;
  readonly cursorRoleSource: string | null;
  readonly cursorTextureKey: string | null;
  readonly dialogueStep: number;
  readonly selectedChoice: number;
  readonly branch: string | null;
  readonly ending: string | null;
  readonly discovered: readonly boolean[];
  readonly clueCount: number;
  readonly deductionMade: boolean;
  readonly cursorIndex: number;
  readonly puzzleOne: boolean;
  readonly puzzleTwo: boolean;
  readonly inventory: number;
  readonly verbState: number;
  readonly outcome: string;
  readonly lastAction: string;
}

interface Candidate { readonly id: string; readonly kit: StarterKit; run(harness: Harness): Promise<SmokeOutcome> }

async function shell(harness: Harness): Promise<NarrativeState> {
  return readShellState<NarrativeState>(harness, DEBUG_KEY);
}

async function start(harness: Harness): Promise<void> {
  await harness.keyTap('Space');
  await harness.stepFrames(8);
}

function roles(state: NarrativeState, expected: 'cursor' | 'button'): boolean {
  return state.playerTextureKey.length > 0 && state.backgroundTextureKey !== null &&
    state.panelRoleSource === 'ui.panel' && state.panelTextureKey.length > 0 &&
    state[expected === 'cursor' ? 'cursorRoleSource' : 'buttonRoleSource'] === `ui.${expected}` &&
    state[expected === 'cursor' ? 'cursorTextureKey' : 'buttonTextureKey'] !== null;
}

async function escapeRoomRun(harness: Harness): Promise<SmokeOutcome> {
  await start(harness);
  const initial = await shell(harness);
  await harness.keyTap('Enter'); await harness.stepFrames(2);
  const first = await shell(harness);
  await harness.keyTap('ArrowRight'); await harness.keyTap('Enter'); await harness.stepFrames(2);
  const second = await shell(harness);
  await harness.keyTap('ArrowRight'); await harness.keyTap('Enter'); await harness.stepFrames(2);
  const finished = await shell(harness);
  const passed = roles(initial, 'cursor') && initial.puzzleOne === false && initial.puzzleTwo === false &&
    first.puzzleOne === true && first.puzzleTwo === false && second.puzzleTwo === true &&
    finished.cursorIndex === 2 && finished.outcome === 'complete' && finished.lastAction === 'escape';
  return { passed, details: { initial, first, second, finished } };
}

async function interactiveFictionRun(harness: Harness): Promise<SmokeOutcome> {
  await start(harness);
  const initial = await shell(harness);
  await harness.keyTap('ArrowRight'); await harness.stepFrames(2);
  await harness.keyTap('Enter'); await harness.stepFrames(2);
  const statefulChoice = await shell(harness);
  await harness.keyTap('ArrowLeft'); await harness.keyTap('Enter'); await harness.stepFrames(2);
  const finished = await shell(harness);
  const passed = roles(initial, 'button') && initial.verbState === 0 && statefulChoice.selectedChoice === 1 &&
    statefulChoice.verbState === 1 && statefulChoice.inventory === 2 && finished.branch === 'waited' &&
    finished.ending === 'waited-ending' && finished.outcome === 'complete' && finished.lastAction === 'outcome';
  return { passed, details: { initial, statefulChoice, finished } };
}

async function moveTo(harness: Harness, target: { readonly x: number; readonly y: number }): Promise<NarrativeState> {
  let state = await shell(harness);
  for (let step = 0; step < 100 && (Math.abs(state.x - target.x) > 18 || Math.abs(state.y - target.y) > 18); step++) {
    if (state.x < target.x - 18) { await harness.keyDown('ArrowRight'); await harness.keyUp('ArrowLeft'); }
    else if (state.x > target.x + 18) { await harness.keyDown('ArrowLeft'); await harness.keyUp('ArrowRight'); }
    else { await harness.keyUp('ArrowLeft'); await harness.keyUp('ArrowRight'); }
    if (state.y < target.y - 18) { await harness.keyDown('ArrowDown'); await harness.keyUp('ArrowUp'); }
    else if (state.y > target.y + 18) { await harness.keyDown('ArrowUp'); await harness.keyUp('ArrowDown'); }
    else { await harness.keyUp('ArrowUp'); await harness.keyUp('ArrowDown'); }
    await harness.stepFrames(2);
    state = await shell(harness);
  }
  await harness.keyUp('ArrowLeft'); await harness.keyUp('ArrowRight'); await harness.keyUp('ArrowUp'); await harness.keyUp('ArrowDown');
  return state;
}

async function investigationRun(harness: Harness): Promise<SmokeOutcome> {
  await start(harness);
  const initial = await shell(harness);
  await moveTo(harness, { x: 330, y: 150 }); await harness.keyTap('KeyJ'); await harness.stepFrames(2);
  const firstClue = await shell(harness);
  await moveTo(harness, { x: 560, y: 340 }); await harness.keyTap('KeyJ'); await harness.stepFrames(2);
  const secondClue = await shell(harness);
  await moveTo(harness, { x: 760, y: 180 }); await harness.keyTap('KeyJ'); await harness.stepFrames(2);
  const clues = await shell(harness);
  await harness.keyTap('KeyK'); await harness.stepFrames(2);
  const deduced = await shell(harness);
  await moveTo(harness, { x: 875, y: 420 });
  const finished = await shell(harness);
  const passed = roles(initial, 'cursor') && initial.clueCount === 0 && firstClue.clueCount === 1 &&
    secondClue.clueCount === 2 && clues.clueCount === 3 && clues.deductionMade === false &&
    deduced.deductionMade === true && deduced.lastAction === 'deduction' && finished.outcome === 'complete';
  return { passed, details: { initial, firstClue, secondClue, clues, deduced, finished } };
}

async function pointAndClickRun(harness: Harness): Promise<SmokeOutcome> {
  await start(harness);
  const initial = await shell(harness);
  await harness.keyTap('Enter'); await harness.stepFrames(2);
  const first = await shell(harness);
  await harness.keyTap('ArrowRight'); await harness.keyTap('Enter'); await harness.stepFrames(2);
  const second = await shell(harness);
  await harness.keyTap('ArrowRight'); await harness.keyTap('Enter'); await harness.stepFrames(2);
  const finished = await shell(harness);
  const passed = roles(initial, 'cursor') && initial.inventory === 0 && first.inventory === 1 &&
    second.inventory === 2 && finished.cursorIndex === 2 && finished.outcome === 'complete' && finished.lastAction === 'exit';
  return { passed, details: { initial, first, second, finished } };
}

const CANDIDATES: readonly Candidate[] = [
  { id: 'escape-room', kit: narrativeStarterKit('escape-room'), run: escapeRoomRun },
  { id: 'interactive-fiction-hybrid', kit: narrativeStarterKit('interactive-fiction-hybrid'), run: interactiveFictionRun },
  { id: 'investigation-game', kit: narrativeStarterKit('investigation-game'), run: investigationRun },
  { id: 'point-and-click', kit: narrativeStarterKit('point-and-click'), run: pointAndClickRun },
];

async function main(): Promise<number> {
  if (!findSystemChrome()) { console.error('Expanded starter-kit P3-K QA is INCOMPLETE: no system Chrome found.'); return 1; }
  const lockBefore = existsSync(LOCKFILE) ? readFileSync(LOCKFILE, 'utf8') : null;
  const results: { id: string; passed: boolean; detail: string }[] = [];
  for (const candidate of CANDIDATES) {
    const gameId = `qa-kit-${candidate.id}`;
    const gamePath = path.join(GAMES_ROOT, gameId);
    rmSync(gamePath, { recursive: true, force: true });
    try {
      createGame({ gameId, presetId: candidate.id, overlay: candidate.kit.overlay(gameId, `QA ${candidate.id}`) });
      if (await runCli(['validate', gameId]) !== 0) { results.push({ id: candidate.id, passed: false, detail: 'canonical validate failed' }); continue; }
      const result = await runSmoke({ id: candidate.id, buildDir: path.join(gamePath, 'dist'), run: candidate.run });
      results.push({ id: candidate.id, passed: result.passed, detail: result.passed ? JSON.stringify(result.details) : `mechanic proof failed: ${JSON.stringify(result.details)} console=${JSON.stringify(result.consoleErrors)} external=${JSON.stringify(result.externalRequests)}` });
    } catch (error) {
      results.push({ id: candidate.id, passed: false, detail: error instanceof Error ? `${error.name}: ${error.message}` : String(error) });
    } finally { rmSync(gamePath, { recursive: true, force: true }); }
  }
  const lockfileClean = (existsSync(LOCKFILE) ? readFileSync(LOCKFILE, 'utf8') : null) === lockBefore;
  for (const result of results) console.log(`[${result.passed ? 'PASS' : 'FAIL'}] ${result.id}${result.passed ? '' : ` - ${result.detail}`}`);
  console.log(`[${lockfileClean ? 'PASS' : 'FAIL'}] package-lock.json unchanged by P3-K candidate generation/validation`);
  return results.every((result) => result.passed) && lockfileClean ? 0 : 1;
}

process.exitCode = await main();
