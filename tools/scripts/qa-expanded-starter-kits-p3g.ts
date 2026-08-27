import { existsSync, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createGame } from '@sw2d/cli/factory';
import { findSystemChrome, readShellState, runSmoke, type Harness, type SmokeOutcome } from '@sw2d/qa';
import { runCli } from '../../packages/cli/src/index.ts';
import type { StarterKit } from '../../workbench/server/starterKits/contracts.ts';
import { partyToyStarterKit } from '../../workbench/server/starterKits/expanded/builders/partyToyWeird.ts';

const REPO_ROOT = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '../..');
const GAMES_ROOT = path.join(REPO_ROOT, 'games');
const LOCKFILE = path.join(REPO_ROOT, 'package-lock.json');
const DEBUG_KEY = 'game.expanded-starter';

interface PartyState {
  readonly outcome: string;
  readonly lastAction: string;
  readonly score: number;
  readonly cursorRoleSource: string;
  readonly cursorTextureKey: string;
  readonly panelRoleSource: string | null;
  readonly panelTextureKey: string | null;
  readonly buttonRoleSource: string | null;
  readonly buttonTextureKey: string | null;
  readonly pickupRoleSource: string | null;
  readonly pickupTextureKey: string | null;
  readonly particleTextureKey: string | null;
  readonly particleEffects: number;
  readonly drawingSize: number;
  readonly drawingVisibleMarks: number;
  readonly drawingResets: number;
  readonly wardrobe: readonly number[];
  readonly wardrobeChanges: number;
  readonly dressResets: number;
  readonly wardrobeCategory: number;
  readonly fishingState: string;
  readonly fishCaught: number;
  readonly fishMissed: number;
  readonly currentPlayer: number;
  readonly partyScores: readonly number[];
  readonly partyTurns: number;
  readonly winner: number | null;
  readonly recipeStep: number;
  readonly cookingSelection: number;
  readonly cookingMistakes: number;
  readonly dishScore: number;
}

interface Candidate { readonly id: string; readonly kit: StarterKit; run(harness: Harness): Promise<SmokeOutcome> }

async function shell(harness: Harness): Promise<PartyState> { return readShellState<PartyState>(harness, DEBUG_KEY); }

async function start(harness: Harness): Promise<void> {
  await harness.keyTap('Space');
  await harness.stepFrames(8);
}

async function cookingRun(harness: Harness): Promise<SmokeOutcome> {
  await start(harness);
  const initial = await shell(harness);
  await harness.keyTap('ArrowRight');
  await harness.keyTap('KeyJ');
  await harness.stepFrames(2);
  const wrong = await shell(harness);
  await harness.keyTap('ArrowLeft'); await harness.keyTap('KeyJ');
  await harness.keyTap('ArrowRight'); await harness.keyTap('KeyJ');
  await harness.keyTap('ArrowRight'); await harness.keyTap('KeyJ');
  await harness.stepFrames(2);
  const finished = await shell(harness);
  const passed = initial.panelRoleSource === 'ui.panel' && initial.panelTextureKey !== null && initial.buttonRoleSource === 'ui.button' && initial.buttonTextureKey !== null &&
    initial.pickupRoleSource === 'pickup' && initial.pickupTextureKey !== null && initial.particleTextureKey !== null && initial.recipeStep === 0 &&
    wrong.lastAction === 'wrong-step' && wrong.cookingMistakes === 1 && wrong.dishScore < initial.dishScore && finished.recipeStep === 3 && finished.lastAction === 'dish-complete' &&
    finished.outcome === 'complete' && finished.score > 0 && finished.particleEffects >= 4;
  return { passed, details: { initial, wrong, finished } };
}

async function drawAt(harness: Harness, key: string): Promise<void> {
  await harness.keyTap(key); await harness.stepFrames(2);
}

async function drawingRun(harness: Harness): Promise<SmokeOutcome> {
  await start(harness);
  const initial = await shell(harness);
  await drawAt(harness, 'Enter');
  await drawAt(harness, 'ArrowRight'); await drawAt(harness, 'Enter');
  await drawAt(harness, 'ArrowDown'); await drawAt(harness, 'Enter');
  await drawAt(harness, 'ArrowLeft'); await drawAt(harness, 'Enter');
  const marked = await shell(harness);
  await harness.keyTap('KeyK'); await harness.stepFrames(2);
  const cleared = await shell(harness);
  await drawAt(harness, 'Enter');
  await drawAt(harness, 'ArrowRight'); await drawAt(harness, 'Enter');
  await drawAt(harness, 'ArrowRight'); await drawAt(harness, 'Enter');
  await drawAt(harness, 'ArrowDown'); await drawAt(harness, 'Enter');
  await drawAt(harness, 'ArrowDown'); await drawAt(harness, 'Enter');
  const finished = await shell(harness);
  const passed = initial.cursorRoleSource === 'ui.cursor' && initial.cursorTextureKey.length > 0 && initial.panelRoleSource === 'ui.panel' && initial.buttonRoleSource === 'ui.button' &&
    marked.drawingSize === 4 && marked.drawingVisibleMarks === 4 && cleared.drawingSize === 0 && cleared.drawingVisibleMarks === 0 && cleared.drawingResets === 1 &&
    finished.drawingSize === 5 && finished.drawingVisibleMarks === 5 && finished.outcome === 'complete';
  return { passed, details: { initial, marked, cleared, finished } };
}

async function dressRun(harness: Harness): Promise<SmokeOutcome> {
  await start(harness);
  const initial = await shell(harness);
  await harness.keyTap('Enter'); await harness.stepFrames(2);
  await harness.keyTap('ArrowRight'); await harness.keyTap('Enter'); await harness.stepFrames(2);
  const changed = await shell(harness);
  await harness.keyTap('KeyK'); await harness.stepFrames(2);
  const reset = await shell(harness);
  await harness.keyTap('Enter');
  await harness.keyTap('ArrowRight'); await harness.keyTap('Enter'); await harness.stepFrames(2);
  await harness.keyTap('ArrowRight'); await harness.keyTap('Enter'); await harness.stepFrames(2);
  await harness.keyTap('ArrowLeft'); await harness.keyTap('Enter'); await harness.stepFrames(2);
  const finished = await shell(harness);
  const changedSlots = finished.wardrobe.filter((value) => value > 0).length;
  const passed = initial.cursorRoleSource === 'ui.cursor' && initial.panelRoleSource === 'ui.panel' && initial.buttonRoleSource === 'ui.button' &&
    initial.pickupRoleSource === 'pickup' && initial.pickupTextureKey !== null && changed.wardrobeChanges === 2 && changed.wardrobeCategory === 1 &&
    reset.wardrobe.every((value) => value === 0) && reset.dressResets === 1 && finished.wardrobeChanges === 4 && changedSlots >= 2 && finished.outcome === 'complete';
  return { passed, details: { initial, changed, reset, finished } };
}

async function fishingRun(harness: Harness): Promise<SmokeOutcome> {
  await start(harness);
  const initial = await shell(harness);
  await harness.keyTap('KeyJ'); await harness.stepFrames(4);
  const cast = await shell(harness);
  let state = cast;
  for (let i = 0; i < 100 && state.fishingState !== 'bite'; i++) { await harness.stepFrames(4); state = await shell(harness); }
  const bite = state;
  await harness.stepFrames(50);
  const missed = await shell(harness);
  await harness.keyTap('KeyJ');
  state = await shell(harness);
  for (let i = 0; i < 100 && state.fishingState !== 'bite'; i++) { await harness.stepFrames(4); state = await shell(harness); }
  await harness.keyTap('KeyJ'); await harness.stepFrames(2);
  const landed = await shell(harness);
  await harness.stepFrames(35);
  await harness.keyTap('KeyJ');
  state = await shell(harness);
  for (let i = 0; i < 100 && state.fishingState !== 'bite'; i++) { await harness.stepFrames(4); state = await shell(harness); }
  await harness.keyTap('KeyJ'); await harness.stepFrames(2);
  const finished = await shell(harness);
  const passed = initial.panelRoleSource === 'ui.panel' && initial.buttonRoleSource === 'ui.button' && initial.pickupRoleSource === 'pickup' && initial.particleTextureKey !== null &&
    initial.fishingState === 'idle' && cast.fishingState === 'cast' && bite.fishingState === 'bite' && missed.fishMissed >= 1 && missed.fishingState === 'idle' &&
    landed.fishingState === 'landed' && landed.fishCaught >= 1 && landed.score >= 50 && landed.particleEffects >= 2 && finished.fishCaught >= 2 && finished.outcome === 'complete';
  return { passed, details: { initial, cast, bite, missed, landed, finished } };
}

async function localPartyRun(harness: Harness): Promise<SmokeOutcome> {
  await start(harness);
  const initial = await shell(harness);
  await harness.keyTap('KeyJ'); await harness.stepFrames(2);
  const first = await shell(harness);
  for (let i = 0; i < 5; i++) { await harness.keyTap('KeyJ'); await harness.stepFrames(2); }
  const finished = await shell(harness);
  const passed = initial.panelRoleSource === 'ui.panel' && initial.buttonRoleSource === 'ui.button' && initial.currentPlayer === 0 &&
    first.currentPlayer === 1 && first.partyScores[0]! > 0 && finished.partyTurns === 6 && finished.partyScores.every((score) => score > 0) &&
    finished.winner !== null && finished.outcome === 'complete' && finished.lastAction === 'party-turn';
  return { passed, details: { initial, first, finished } };
}

const CANDIDATES: readonly Candidate[] = [
  { id: 'cooking-game', kit: partyToyStarterKit('cooking-game'), run: cookingRun },
  { id: 'drawing-game', kit: partyToyStarterKit('drawing-game'), run: drawingRun },
  { id: 'dress-up-character-toy', kit: partyToyStarterKit('dress-up-character-toy'), run: dressRun },
  { id: 'fishing-game', kit: partyToyStarterKit('fishing-game'), run: fishingRun },
  { id: 'local-party-game', kit: partyToyStarterKit('local-party-game'), run: localPartyRun },
];

async function main(): Promise<number> {
  if (!findSystemChrome()) { console.error('Expanded starter-kit P3-G QA is INCOMPLETE: no system Chrome found.'); return 1; }
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
  console.log(`[${lockfileClean ? 'PASS' : 'FAIL'}] package-lock.json unchanged by P3-G candidate generation/validation`);
  return results.every((result) => result.passed) && lockfileClean ? 0 : 1;
}

process.exitCode = await main();
