import { existsSync, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createGame } from '@sw2d/cli/factory';
import { findSystemChrome, readShellState, runSmoke, type Harness, type SmokeOutcome } from '@sw2d/qa';
import { runCli } from '../../packages/cli/src/index.ts';
import type { StarterKit } from '../../workbench/server/starterKits/contracts.ts';
import { additionalPlatformStarterKit } from '../../workbench/server/starterKits/expanded/builders/platformingMore.ts';

const REPO_ROOT = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '../..');
const GAMES_ROOT = path.join(REPO_ROOT, 'games');
const LOCKFILE = path.join(REPO_ROOT, 'package-lock.json');
const DEBUG_KEY = 'game.expanded-starter';

interface PlatformState {
  readonly outcome: string;
  readonly lastAction: string;
  readonly x: number;
  readonly y: number;
  readonly maxHeightReached: number;
  readonly hazardHits: number;
  readonly respawns: number;
  readonly grappleUsed: boolean;
  readonly grappleTargetValid: boolean;
  readonly particleTextureKey: string | null;
  readonly particleEffects: number;
  readonly finishBlockedCount: number;
}

interface Candidate { readonly id: string; readonly kit: StarterKit; run(harness: Harness): Promise<SmokeOutcome> }

async function shell(harness: Harness): Promise<PlatformState> { return readShellState<PlatformState>(harness, DEBUG_KEY); }

async function start(harness: Harness): Promise<void> {
  await harness.keyTap('Space');
  await harness.stepFrames(12);
}

async function jumpRoute(harness: Harness): Promise<void> {
  await harness.keyDown('ArrowRight');
  await harness.stepFrames(15);
  for (let i = 0; i < 260; i++) {
    if (i % 60 === 0) await harness.keyTap('Space');
    await harness.stepFrames(1);
  }
  await harness.keyUp('ArrowRight');
}

async function climbingRun(harness: Harness): Promise<SmokeOutcome> {
  await start(harness);
  const initial = await shell(harness);
  await harness.keyDown('ArrowRight'); await harness.stepFrames(160); await harness.keyUp('ArrowRight');
  await harness.stepFrames(60);
  const fallen = await shell(harness);
  await jumpRoute(harness);
  let state = await shell(harness);
  for (let i = 0; i < 80 && state.outcome === 'playing'; i++) { await harness.stepFrames(4); state = await shell(harness); }
  const passed = fallen.respawns > initial.respawns && state.maxHeightReached < initial.y && state.outcome === 'complete' && state.lastAction === 'finish';
  return { passed, details: { initial, fallen, final: state } };
}

async function grappleRun(harness: Harness): Promise<SmokeOutcome> {
  await start(harness);
  const initial = await shell(harness);
  await harness.keyDown('ArrowRight'); await harness.stepFrames(50); await harness.keyUp('ArrowRight');
  await harness.keyTap('KeyK'); await harness.stepFrames(3);
  const grappled = await shell(harness);
  await harness.keyDown('ArrowRight');
  for (let i = 0; i < 20 && grappled.outcome === 'playing'; i++) { await harness.stepFrames(4); }
  await harness.keyUp('ArrowRight');
  await harness.keyDown('ArrowRight');
  let state = await shell(harness);
  for (let i = 0; i < 40 && state.outcome === 'playing'; i++) { await harness.keyTap('Space'); await harness.stepFrames(4); state = await shell(harness); }
  await harness.keyUp('ArrowRight');
  const passed = initial.grappleUsed === false && grappled.grappleTargetValid === true && grappled.grappleUsed === true && grappled.particleTextureKey !== null &&
    grappled.particleEffects >= 1 && state.grappleUsed === true && state.outcome === 'complete' && state.lastAction === 'finish';
  return { passed, details: { initial, grappled, final: state } };
}

const CANDIDATES: readonly Candidate[] = [
  { id: 'climbing-game', kit: additionalPlatformStarterKit('climbing-game'), run: climbingRun },
  { id: 'grappling-platformer', kit: additionalPlatformStarterKit('grappling-platformer'), run: grappleRun },
];

async function main(): Promise<number> {
  if (!findSystemChrome()) { console.error('Expanded starter-kit P3-I QA is INCOMPLETE: no system Chrome found.'); return 1; }
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
  console.log(`[${lockfileClean ? 'PASS' : 'FAIL'}] package-lock.json unchanged by P3-I candidate generation/validation`);
  return results.every((result) => result.passed) && lockfileClean ? 0 : 1;
}

process.exitCode = await main();
