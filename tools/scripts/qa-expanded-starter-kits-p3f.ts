import { existsSync, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createGame } from '@sw2d/cli/factory';
import { findSystemChrome, readShellState, runSmoke, type Harness, type SmokeOutcome } from '@sw2d/qa';
import { runCli } from '../../packages/cli/src/index.ts';
import type { StarterKit } from '../../workbench/server/starterKits/contracts.ts';
import { starterKit as physicsPuzzle } from '../../workbench/server/starterKits/expanded/physics-puzzle.ts';
import { starterKit as rhythmAction } from '../../workbench/server/starterKits/expanded/rhythm-action.ts';
import { starterKit as pinballLite } from '../../workbench/server/starterKits/expanded/pinball-lite.ts';

const REPO_ROOT = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '../..');
const GAMES_ROOT = path.join(REPO_ROOT, 'games');
const LOCKFILE = path.join(REPO_ROOT, 'package-lock.json');
const DEBUG_KEY = 'game.expanded-starter';

interface PuzzleState {
  readonly outcome: string;
  readonly lastAction: string;
  readonly score: number;
  readonly triggerActivated: boolean;
  readonly goalReached: boolean;
  readonly collisionBounces: number;
  readonly cursorTextureKey: string;
  readonly cursorRoleSource: string;
  readonly panelTextureKey: string | null;
  readonly panelRoleSource: string | null;
  readonly buttonTextureKey: string | null;
  readonly buttonRoleSource: string | null;
  readonly particleTextureKey: string | null;
  readonly particleEffects: number;
  readonly bumperHits: number;
  readonly drains: number;
  readonly lives: number;
  readonly launched: boolean;
  readonly beatHits: number;
  readonly beatMisses: number;
  readonly beatIndex: number;
  readonly beatWindowOpen: boolean;
}

interface Candidate { readonly id: string; readonly kit: StarterKit; run(harness: Harness): Promise<SmokeOutcome> }

async function shell(harness: Harness): Promise<PuzzleState> { return readShellState<PuzzleState>(harness, DEBUG_KEY); }

async function start(harness: Harness): Promise<void> {
  await harness.keyTap('Space');
  await harness.stepFrames(8);
}

async function physicsRun(harness: Harness): Promise<SmokeOutcome> {
  await start(harness);
  const initial = await shell(harness);
  await harness.keyTap('KeyJ');
  const launchedState = await shell(harness);
  let state = launchedState;
  for (let i = 0; i < 100 && state.outcome === 'playing'; i++) {
    await harness.stepFrames(4);
    state = await shell(harness);
  }
  const passed = initial.triggerActivated === false && initial.cursorRoleSource === 'ui.cursor' && initial.cursorTextureKey.length > 0 &&
    state.triggerActivated === true && state.collisionBounces >= 1 && state.goalReached === true && state.score >= 100 && state.outcome === 'complete';
  return { passed, details: { initial, final: state } };
}

async function rhythmRun(harness: Harness): Promise<SmokeOutcome> {
  await start(harness);
  const initial = await shell(harness);
  let state = initial;
  for (let i = 0; i < 12 && !state.beatWindowOpen; i++) {
    await harness.stepFrames(2);
    state = await shell(harness);
  }
  await harness.keyTap('KeyJ');
  await harness.stepFrames(2);
  const hit = await shell(harness);
  for (let i = 0; i < 80 && state.outcome === 'playing'; i++) {
    await harness.stepFrames(4);
    state = await shell(harness);
  }
  const passed = initial.panelRoleSource === 'ui.panel' && initial.panelTextureKey !== null &&
    initial.buttonRoleSource === 'ui.button' && initial.buttonTextureKey !== null && initial.particleTextureKey !== null &&
    hit.beatHits >= 1 && hit.score >= 100 && hit.particleEffects >= 1 && state.beatIndex >= 8 && state.outcome === 'complete';
  return { passed, details: { initial, hit, final: state } };
}

async function pinballRun(harness: Harness): Promise<SmokeOutcome> {
  await start(harness);
  const initial = await shell(harness);
  await harness.keyTap('KeyJ');
  const launchedState = await shell(harness);
  let state = launchedState;
  for (let i = 0; i < 420 && state.bumperHits < 1; i++) {
    await harness.stepFrames(3);
    state = await shell(harness);
  }
  await harness.keyDown('ArrowLeft');
  for (let i = 0; i < 420 && state.drains < 1; i++) { await harness.stepFrames(3); state = await shell(harness); }
  await harness.keyUp('ArrowLeft');
  const passed = initial.launched === false && launchedState.launched === true && initial.panelRoleSource === 'ui.panel' && initial.panelTextureKey !== null &&
    initial.particleTextureKey !== null && state.bumperHits >= 1 && state.score >= 25 && state.particleEffects >= 1 && state.drains >= 1 && state.lives === 2;
  return { passed, details: { initial, launched: launchedState, final: state } };
}

const CANDIDATES: readonly Candidate[] = [
  { id: 'physics-puzzle', kit: physicsPuzzle, run: physicsRun },
  { id: 'rhythm-action', kit: rhythmAction, run: rhythmRun },
  { id: 'pinball-lite', kit: pinballLite, run: pinballRun },
];

async function main(): Promise<number> {
  if (!findSystemChrome()) { console.error('Expanded starter-kit P3-F QA is INCOMPLETE: no system Chrome found.'); return 1; }
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
  console.log(`[${lockfileClean ? 'PASS' : 'FAIL'}] package-lock.json unchanged by P3-F candidate generation/validation`);
  return results.every((result) => result.passed) && lockfileClean ? 0 : 1;
}

process.exitCode = await main();
