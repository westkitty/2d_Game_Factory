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
  readonly pickupTextureKey: string | null;
  readonly particleTextureKey: string | null;
  readonly particleEffects: number;
  readonly platformTextureKey: string | null;
  readonly microgame: number;
  readonly microSignal: boolean;
  readonly microProgress: number;
  readonly microScores: readonly number[];
  readonly toySpawns: number;
  readonly toyResets: number;
  readonly toyBodies: readonly { readonly x: number; readonly y: number }[];
  readonly hunger: number;
  readonly happiness: number;
  readonly petActions: number;
  readonly sandboxKind: number;
  readonly sandboxSize: number;
  readonly sandboxResets: number;
  readonly sandboxVisibleObjects: number;
  readonly photoTarget: number;
  readonly photosTaken: number;
  readonly bestPhoto: number;
}

interface Candidate { readonly id: string; readonly kit: StarterKit; run(harness: Harness): Promise<SmokeOutcome> }

async function shell(harness: Harness): Promise<PartyState> { return readShellState<PartyState>(harness, DEBUG_KEY); }

async function start(harness: Harness): Promise<void> {
  await harness.keyTap('Space');
  await harness.stepFrames(8);
}

async function microRun(harness: Harness): Promise<SmokeOutcome> {
  await start(harness);
  const initial = await shell(harness);
  await harness.stepFrames(60);
  const signal = await shell(harness);
  await harness.keyTap('KeyJ'); await harness.stepFrames(2);
  const first = await shell(harness);
  for (const key of ['ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight']) { await harness.keyTap(key); await harness.stepFrames(2); }
  const second = await shell(harness);
  for (let i = 0; i < 4; i++) { await harness.keyTap('KeyJ'); await harness.stepFrames(2); }
  const finished = await shell(harness);
  const passed = initial.cursorRoleSource === 'ui.cursor' && initial.panelRoleSource === 'ui.panel' && initial.buttonRoleSource === 'ui.button' && initial.particleTextureKey !== null &&
    signal.microSignal === true && first.microgame === 1 && second.microgame === 2 && finished.microgame === 3 && finished.microScores.every((score) => score > 0) &&
    finished.score > 0 && finished.particleEffects >= 6 && finished.outcome === 'complete';
  return { passed, details: { initial, signal, first, second, finished } };
}

async function physicsRun(harness: Harness): Promise<SmokeOutcome> {
  await start(harness);
  const initial = await shell(harness);
  await harness.keyTap('KeyJ'); await harness.stepFrames(8);
  const moved = await shell(harness);
  await harness.keyTap('KeyK'); await harness.stepFrames(2);
  const reset = await shell(harness);
  const passed = initial.cursorRoleSource === 'ui.cursor' && initial.platformTextureKey !== null && initial.toySpawns === 0 &&
    moved.toySpawns === 1 && moved.toyBodies.length === 4 && moved.toyBodies.some((body, index) => body.x !== initial.toyBodies[index]?.x || body.y !== initial.toyBodies[index]?.y) &&
    moved.particleEffects >= 1 && reset.toyResets === 1 && reset.toyBodies.length === 4 && reset.outcome === 'playing';
  return { passed, details: { initial, moved, reset } };
}

async function sandboxRun(harness: Harness): Promise<SmokeOutcome> {
  await start(harness);
  const initial = await shell(harness);
  await harness.keyTap('Enter'); await harness.stepFrames(2);
  await harness.keyTap('KeyJ'); await harness.keyTap('ArrowRight'); await harness.keyTap('Enter'); await harness.stepFrames(2);
  const placed = await shell(harness);
  await harness.keyTap('KeyK'); await harness.stepFrames(2);
  const reset = await shell(harness);
  await harness.keyTap('Enter'); await harness.keyTap('KeyJ'); await harness.keyTap('ArrowRight'); await harness.keyTap('Enter');
  await harness.keyTap('ArrowDown'); await harness.keyTap('Enter'); await harness.stepFrames(2);
  const finished = await shell(harness);
  const passed = initial.cursorRoleSource === 'ui.cursor' && initial.platformTextureKey !== null && placed.sandboxSize === 2 && placed.sandboxKind === 1 && placed.particleEffects >= 2 &&
    reset.sandboxSize === 0 && reset.sandboxVisibleObjects === 0 && reset.sandboxResets === 1 && finished.sandboxSize === 3 && finished.outcome === 'complete';
  return { passed, details: { initial, placed, reset, finished } };
}

async function petRun(harness: Harness): Promise<SmokeOutcome> {
  await start(harness);
  const initial = await shell(harness);
  await harness.keyTap('KeyJ'); await harness.stepFrames(2);
  const fed = await shell(harness);
  await harness.keyTap('KeyK'); await harness.stepFrames(2);
  const finished = await shell(harness);
  const passed = initial.panelRoleSource === 'ui.panel' && initial.buttonRoleSource === 'ui.button' && initial.pickupTextureKey !== undefined &&
    fed.hunger > initial.hunger && finished.happiness > initial.happiness && finished.petActions === 2 && finished.outcome === 'complete';
  return { passed, details: { initial, fed, finished } };
}

async function photoRun(harness: Harness): Promise<SmokeOutcome> {
  await start(harness);
  const initial = await shell(harness);
  await harness.keyTap('KeyK'); await harness.stepFrames(2);
  const selected = await shell(harness);
  await harness.keyTap('KeyK'); await harness.stepFrames(2);
  await harness.keyTap('KeyK'); await harness.stepFrames(2);
  await harness.keyDown('ArrowRight'); await harness.stepFrames(90); await harness.keyUp('ArrowRight');
  await harness.keyDown('ArrowUp'); await harness.stepFrames(25); await harness.keyUp('ArrowUp');
  await harness.keyTap('KeyJ'); await harness.stepFrames(2);
  await harness.keyTap('KeyJ'); await harness.stepFrames(2);
  const finished = await shell(harness);
  const passed = initial.cursorRoleSource === 'ui.cursor' && initial.panelRoleSource === 'ui.panel' && initial.particleTextureKey !== null && initial.photoTarget === 0 &&
    selected.photoTarget === 1 && finished.photosTaken === 2 && finished.bestPhoto >= 70 && finished.particleEffects >= 2 && finished.outcome === 'complete';
  return { passed, details: { initial, selected, finished } };
}

const CANDIDATES: readonly Candidate[] = [
  { id: 'microgame-collection', kit: partyToyStarterKit('microgame-collection'), run: microRun },
  { id: 'physics-toy', kit: partyToyStarterKit('physics-toy'), run: physicsRun },
  { id: 'sandbox-playground', kit: partyToyStarterKit('sandbox-playground'), run: sandboxRun },
  { id: 'virtual-pet', kit: partyToyStarterKit('virtual-pet'), run: petRun },
  { id: 'photography-game', kit: partyToyStarterKit('photography-game'), run: photoRun },
];

async function main(): Promise<number> {
  if (!findSystemChrome()) { console.error('Expanded starter-kit P3-H QA is INCOMPLETE: no system Chrome found.'); return 1; }
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
  console.log(`[${lockfileClean ? 'PASS' : 'FAIL'}] package-lock.json unchanged by P3-H candidate generation/validation`);
  return results.every((result) => result.passed) && lockfileClean ? 0 : 1;
}

process.exitCode = await main();
