import { existsSync, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createGame } from '@sw2d/cli/factory';
import { findSystemChrome, readShellState, runSmoke, type Harness, type SmokeOutcome } from '@sw2d/qa';
import { runCli } from '../../packages/cli/src/index.ts';
import type { StarterKit } from '../../workbench/server/starterKits/contracts.ts';
import { simulationStarterKit } from '../../workbench/server/starterKits/expanded/builders/simulationManagement.ts';

const REPO_ROOT = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '../..');
const GAMES_ROOT = path.join(REPO_ROOT, 'games');
const LOCKFILE = path.join(REPO_ROOT, 'package-lock.json');
const DEBUG_KEY = 'game.expanded-starter';

interface SimulationState {
  readonly outcome: string;
  readonly lastAction: string;
  readonly playerTextureKey: string;
  readonly backgroundTextureKey: string | null;
  readonly pickupTextureKey: string;
  readonly panelRoleSource: string;
  readonly panelTextureKey: string;
  readonly buttonRoleSource: string;
  readonly buttonTextureKey: string;
  readonly plots: readonly { readonly state: string; readonly growthMs: number }[];
  readonly selectedPlot: number;
  readonly harvested: number;
  readonly hunger: number;
  readonly mood: number;
  readonly careActions: number;
  readonly wellbeingHoldMs: number;
  readonly wood: number;
  readonly stone: number;
  readonly woodWorkers: number;
  readonly stoneWorkers: number;
  readonly constructionComplete: boolean;
  readonly orders: readonly { readonly ready: boolean; readonly remainingMs: number }[];
  readonly revenue: number;
  readonly served: number;
  readonly water: number;
  readonly food: number;
  readonly habitatHealthyMs: number;
}

interface Candidate { readonly id: string; readonly kit: StarterKit; run(harness: Harness): Promise<SmokeOutcome> }

async function shell(harness: Harness): Promise<SimulationState> { return readShellState<SimulationState>(harness, DEBUG_KEY); }

async function start(harness: Harness): Promise<void> {
  await harness.keyTap('Space');
  await harness.stepFrames(8);
}

function roles(state: SimulationState): boolean {
  return state.playerTextureKey.length > 0 && state.backgroundTextureKey !== null && state.pickupTextureKey.length > 0 &&
    state.panelRoleSource === 'ui.panel' && state.panelTextureKey.length > 0 && state.buttonRoleSource === 'ui.button' && state.buttonTextureKey.length > 0;
}

async function farmingRun(harness: Harness): Promise<SmokeOutcome> {
  await start(harness);
  const initial = await shell(harness);
  await harness.keyTap('Enter'); await harness.stepFrames(2);
  const planted = await shell(harness);
  await harness.stepFrames(140);
  const mature = await shell(harness);
  await harness.keyTap('KeyJ'); await harness.stepFrames(2);
  for (let i = 0; i < 2; i++) {
    await harness.keyTap('ArrowRight'); await harness.stepFrames(2);
    await harness.keyTap('Enter'); await harness.stepFrames(2);
    await harness.stepFrames(140);
    await harness.keyTap('KeyJ'); await harness.stepFrames(2);
  }
  const finished = await shell(harness);
  const passed = roles(initial) && initial.plots.every((plot) => plot.state === 'empty') && planted.plots[0]?.state === 'growing' &&
    mature.plots[0]?.state === 'mature' && finished.harvested === 3 && finished.outcome === 'complete' && finished.lastAction === 'harvest';
  return { passed, details: { initial, planted, mature, finished } };
}

async function petRun(harness: Harness): Promise<SmokeOutcome> {
  await start(harness);
  const initial = await shell(harness);
  await harness.keyTap('KeyJ'); await harness.stepFrames(2);
  const fed = await shell(harness);
  await harness.keyTap('KeyK'); await harness.stepFrames(2);
  await harness.stepFrames(110);
  const finished = await shell(harness);
  const passed = roles(initial) && fed.hunger > initial.hunger && finished.mood > initial.mood && finished.careActions === 2 &&
    finished.wellbeingHoldMs >= 1600 && finished.outcome === 'complete';
  return { passed, details: { initial, fed, finished } };
}

async function colonyRun(harness: Harness): Promise<SmokeOutcome> {
  await start(harness);
  const initial = await shell(harness);
  await harness.keyTap('Enter'); await harness.stepFrames(2);
  const assignedWood = await shell(harness);
  await harness.keyTap('ArrowRight'); await harness.stepFrames(2);
  await harness.keyTap('Enter'); await harness.stepFrames(2);
  await harness.stepFrames(450);
  await harness.keyTap('KeyJ'); await harness.stepFrames(2);
  const finished = await shell(harness);
  const passed = roles(initial) && assignedWood.woodWorkers === 2 && assignedWood.stoneWorkers === 0 &&
    finished.wood >= 0 && finished.stone >= 0 && finished.constructionComplete && finished.lastAction === 'build' && finished.outcome === 'complete';
  return { passed, details: { initial, assignedWood, final: finished } };
}

async function restaurantRun(harness: Harness): Promise<SmokeOutcome> {
  await start(harness);
  const initial = await shell(harness);
  for (let i = 0; i < 3; i++) { await harness.keyTap('KeyJ'); await harness.stepFrames(2); }
  const queued = await shell(harness);
  await harness.stepFrames(120);
  const ready = await shell(harness);
  for (let i = 0; i < 3; i++) { await harness.keyTap('Enter'); await harness.stepFrames(2); }
  const finished = await shell(harness);
  const passed = roles(initial) && queued.orders.length === 3 && ready.orders.every((order) => order.ready) &&
    finished.served === 3 && finished.revenue === 30 && finished.orders.length === 0 && finished.outcome === 'complete' && finished.lastAction === 'serve';
  return { passed, details: { initial, queued, ready, finished } };
}

async function aquariumRun(harness: Harness): Promise<SmokeOutcome> {
  await start(harness);
  const initial = await shell(harness);
  await harness.keyTap('KeyJ'); await harness.stepFrames(2);
  await harness.keyTap('KeyK'); await harness.stepFrames(2);
  const cared = await shell(harness);
  await harness.stepFrames(450);
  const finished = await shell(harness);
  const passed = roles(initial) && cared.food > initial.food && cared.water > initial.water && finished.careActions === 2 &&
    finished.habitatHealthyMs >= 7000 && finished.outcome === 'complete';
  return { passed, details: { initial, cared, finished } };
}

const CANDIDATES: readonly Candidate[] = [
  { id: 'farming-lite', kit: simulationStarterKit('farming-lite'), run: farmingRun },
  { id: 'pet-creature', kit: simulationStarterKit('pet-creature'), run: petRun },
  { id: 'colony-lite', kit: simulationStarterKit('colony-lite'), run: colonyRun },
  { id: 'restaurant', kit: simulationStarterKit('restaurant'), run: restaurantRun },
  { id: 'aquarium-terrarium', kit: simulationStarterKit('aquarium-terrarium'), run: aquariumRun },
];

async function main(): Promise<number> {
  if (!findSystemChrome()) { console.error('Expanded starter-kit P3-J QA is INCOMPLETE: no system Chrome found.'); return 1; }
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
  console.log(`[${lockfileClean ? 'PASS' : 'FAIL'}] package-lock.json unchanged by P3-J candidate generation/validation`);
  return results.every((result) => result.passed) && lockfileClean ? 0 : 1;
}

process.exitCode = await main();
