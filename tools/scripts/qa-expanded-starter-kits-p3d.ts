import { existsSync, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createGame } from '@sw2d/cli/factory';
import { findSystemChrome, readShellState, runSmoke, type Harness, type SmokeOutcome } from '@sw2d/qa';
import { runCli } from '../../packages/cli/src/index.ts';
import type { StarterKit } from '../../workbench/server/starterKits/contracts.ts';
import { starterKit as boatFlightRacer } from '../../workbench/server/starterKits/expanded/boat-flight-racer.ts';
import { starterKit as endlessDriving } from '../../workbench/server/starterKits/expanded/endless-driving.ts';
import { starterKit as kartRacer } from '../../workbench/server/starterKits/expanded/kart-racer.ts';

const REPO_ROOT = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '../..');
const GAMES_ROOT = path.join(REPO_ROOT, 'games');
const LOCKFILE = path.join(REPO_ROOT, 'package-lock.json');
const DEBUG_KEY = 'game.expanded-starter';

interface VehicleState {
  readonly x: number;
  readonly y: number;
  readonly heading: number;
  readonly speed: number;
  readonly checkpointIndex: number;
  readonly lastCheckpointAttempt: number;
  readonly finishTimeMs: number | null;
  readonly targetBeaten: boolean | null;
  readonly pickupCollected: boolean;
  readonly boostRemainingMs: number;
  readonly altitude: number;
  readonly collisions: number;
  readonly distanceScore: number;
  readonly particleTextureKey: string | null;
  readonly particleVisible: boolean;
  readonly particleEffects: number;
  readonly outcome: string;
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

function normalizedAngle(value: number): number {
  let angle = value;
  while (angle > Math.PI) angle -= Math.PI * 2;
  while (angle < -Math.PI) angle += Math.PI * 2;
  return angle;
}

async function driveToward(
  harness: Harness,
  targetX: number,
  targetY: number,
  predicate: (state: VehicleState) => boolean,
  maxSteps = 140,
  framesPerStep = 2,
): Promise<VehicleState> {
  await harness.keyDown('ArrowUp');
  try {
    let state = await shell<VehicleState>(harness);
    for (let step = 0; step < maxSteps && !predicate(state); step++) {
      const desired = Math.atan2(targetY - state.y, targetX - state.x);
      const error = normalizedAngle(desired - state.heading);
      if (error < -0.06) {
        await harness.keyDown('ArrowLeft');
        await harness.keyUp('ArrowRight');
      } else if (error > 0.06) {
        await harness.keyDown('ArrowRight');
        await harness.keyUp('ArrowLeft');
      } else {
        await harness.keyUp('ArrowLeft');
        await harness.keyUp('ArrowRight');
      }
      await harness.stepFrames(framesPerStep);
      state = await shell<VehicleState>(harness);
    }
  } finally {
    await harness.keyUp('ArrowUp');
    await harness.keyUp('ArrowLeft');
    await harness.keyUp('ArrowRight');
  }
  await harness.stepFrames(2);
  return shell<VehicleState>(harness);
}

async function finishOrderedCourse(harness: Harness, startCheckpoint: number): Promise<VehicleState> {
  const gates = [
    { x: 300, y: 270 },
    { x: 520, y: 270 },
    { x: 735, y: 270 },
  ] as const;
  let state = await shell<VehicleState>(harness);
  for (let index = startCheckpoint; index < gates.length; index++) {
    const gate = gates[index]!;
    state = await driveToward(harness, gate.x, gate.y, (current) => current.checkpointIndex > index, 170, 2);
    if (state.checkpointIndex <= index) return state;
  }
  return driveToward(harness, 895, 270, (current) => current.outcome === 'finished', 170, 2);
}

async function kartRun(harness: Harness): Promise<SmokeOutcome> {
  await start(harness);
  const initial = await shell<VehicleState>(harness);
  const firstGate = await driveToward(harness, 300, 270, (state) => state.checkpointIndex >= 1, 150, 2);
  const pickup = await driveToward(harness, 420, 210, (state) => state.pickupCollected, 150, 2);
  const finished = await finishOrderedCourse(harness, pickup.checkpointIndex);

  const passed =
    initial.checkpointIndex === 0 && initial.pickupCollected === false && initial.outcome === 'racing' &&
    initial.particleTextureKey !== null && initial.particleVisible === false && initial.particleEffects === 0 &&
    firstGate.checkpointIndex >= 1 &&
    pickup.pickupCollected === true && pickup.boostRemainingMs > 0 &&
    pickup.particleTextureKey !== null && pickup.particleVisible === true && pickup.particleEffects >= 1 &&
    finished.checkpointIndex === 3 && finished.lastCheckpointAttempt === 2 &&
    finished.finishTimeMs !== null && finished.particleEffects >= 1 && finished.outcome === 'finished';
  return { passed, details: { initial, firstGate, pickup, finished } };
}

async function endlessRun(harness: Harness): Promise<SmokeOutcome> {
  await start(harness);
  const initial = await shell<VehicleState>(harness);
  const pressure = await waitUntil<VehicleState>(harness, (state) => state.distanceScore >= 120, 80, 4);
  const lane = await driveToward(
    harness,
    initial.x + 300,
    360,
    (state) => state.y >= 345 || state.collisions > 0,
    80,
    2,
  );
  const firstHit = lane.collisions > 0
    ? lane
    : await waitUntil<VehicleState>(harness, (state) => state.collisions > 0 || state.outcome !== 'racing', 160, 3);
  const continued = await waitUntil<VehicleState>(
    harness,
    (state) => state.distanceScore >= firstHit.distanceScore + 180 || state.outcome !== 'racing',
    120,
    3,
  );

  const passed =
    initial.outcome === 'racing' && initial.collisions === 0 && initial.particleTextureKey === null &&
    pressure.distanceScore > initial.distanceScore && pressure.speed >= 140 &&
    firstHit.collisions >= 1 && firstHit.distanceScore > pressure.distanceScore &&
    continued.distanceScore > firstHit.distanceScore && continued.outcome === 'racing';
  return { passed, details: { initial, pressure, lane, firstHit, continued } };
}

async function boatRun(harness: Harness): Promise<SmokeOutcome> {
  await start(harness);
  const initial = await shell<VehicleState>(harness);
  const firstGate = await driveToward(harness, 300, 270, (state) => state.checkpointIndex >= 1, 150, 2);
  const secondGate = await driveToward(harness, 520, 270, (state) => state.checkpointIndex >= 2, 150, 2);

  const lowPass = await driveToward(
    harness,
    650,
    360,
    (state) => state.collisions >= 1 || state.x >= 700,
    170,
    2,
  );

  await harness.keyTap('KeyK');
  await harness.stepFrames(3);
  const raised = await shell<VehicleState>(harness);
  const collisionsBeforeHighPass = raised.collisions;

  const highPass = await driveToward(
    harness,
    700,
    360,
    (state) => state.x >= 690 || state.collisions > collisionsBeforeHighPass,
    120,
    2,
  );
  const finished = await finishOrderedCourse(harness, highPass.checkpointIndex);

  const passed =
    initial.altitude === 0.5 && initial.collisions === 0 && initial.checkpointIndex === 0 &&
    initial.particleTextureKey !== null && initial.particleVisible === true && initial.particleEffects === 0 &&
    firstGate.checkpointIndex >= 1 && secondGate.checkpointIndex >= 2 &&
    lowPass.collisions >= 1 && lowPass.particleEffects >= 1 &&
    raised.altitude > 0.65 && raised.collisions === lowPass.collisions &&
    raised.particleVisible === true && raised.particleEffects > lowPass.particleEffects &&
    highPass.x >= 690 && highPass.collisions === collisionsBeforeHighPass &&
    highPass.particleTextureKey !== null && highPass.particleVisible === true &&
    finished.checkpointIndex === 3 && finished.lastCheckpointAttempt === 2 &&
    finished.finishTimeMs !== null && finished.outcome === 'finished';
  return { passed, details: { initial, firstGate, secondGate, lowPass, raised, highPass, finished } };
}

const CANDIDATES: readonly Candidate[] = [
  { id: 'kart-racer', kit: kartRacer, run: kartRun },
  { id: 'endless-driving', kit: endlessDriving, run: endlessRun },
  { id: 'boat-flight-racer', kit: boatFlightRacer, run: boatRun },
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
    console.error('Expanded starter-kit P3-D QA is INCOMPLETE: no system Chrome found.');
    return 1;
  }
  const lockBefore = existsSync(LOCKFILE) ? readFileSync(LOCKFILE, 'utf8') : null;
  const results: Result[] = [];
  for (const candidate of CANDIDATES) {
    process.stdout.write(`Running P3-D starter candidate ${candidate.id}...\n`);
    const result = await runCandidate(candidate);
    results.push(result);
    console.log(`[${result.passed ? 'PASS' : 'FAIL'}] ${candidate.id}${result.passed ? '' : ` - ${result.detail}`}`);
  }
  const lockAfter = existsSync(LOCKFILE) ? readFileSync(LOCKFILE, 'utf8') : null;
  const lockfileClean = lockBefore === lockAfter;
  console.log(`[${lockfileClean ? 'PASS' : 'FAIL'}] package-lock.json unchanged by P3-D candidate generation/validation`);
  const failed = results.filter((result) => !result.passed);
  console.log(`\n${results.length - failed.length}/${results.length} P3-D starter candidate(s) passed.`);
  return failed.length === 0 && lockfileClean ? 0 : 1;
}

process.exitCode = await main();
