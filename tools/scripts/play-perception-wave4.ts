import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { findSystemChrome, readShellState, runSmoke, type Harness, type SmokeOutcome } from '@sw2d/qa';

/**
 * Category-C Wave 4 play journeys against factory-generated games
 * (not starter-kit overlays). Proves infiltrate fail-on-sight vs heist
 * loot-alarm escape.
 */

const REPO_ROOT = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '../..');

interface PerceptionSnap {
  readonly active: boolean;
  readonly mode: string | null;
  readonly hidden: boolean;
  readonly seen: boolean;
  readonly alarm: boolean;
  readonly suspicion: number;
  readonly objectiveCollected: boolean;
  readonly outcome: string;
  readonly lastResult: string | null;
}

interface TopDownShell {
  readonly x: number;
  readonly y: number;
  readonly perception?: PerceptionSnap;
}

async function snap(harness: Harness): Promise<TopDownShell> {
  return readShellState<TopDownShell>(harness, 'game.top-down-shell');
}

async function start(harness: Harness): Promise<void> {
  await harness.keyTap('Space');
  await harness.stepFrames(8);
}

async function restartPlay(harness: Harness): Promise<void> {
  await harness.keyTap('KeyP');
  await harness.stepFrames(3);
  await harness.keyTap('KeyK');
  await harness.stepFrames(12);
}

async function holdUntil(
  harness: Harness,
  code: string,
  predicate: (state: TopDownShell) => boolean,
  maxSteps = 100,
  framesPerStep = 4,
): Promise<TopDownShell> {
  await harness.keyDown(code);
  try {
    let state = await snap(harness);
    for (let step = 0; step < maxSteps && !predicate(state); step++) {
      await harness.stepFrames(framesPerStep);
      state = await snap(harness);
    }
  } finally {
    await harness.keyUp(code);
  }
  await harness.stepFrames(2);
  return snap(harness);
}

async function stealthRun(harness: Harness): Promise<SmokeOutcome> {
  await start(harness);
  const spotted = await holdUntil(harness, 'ArrowRight', (s) => s.perception?.outcome === 'failed', 80, 4);

  await restartPlay(harness);
  await holdUntil(harness, 'ArrowUp', (s) => s.y <= 120, 60, 4);
  const loot = await holdUntil(harness, 'ArrowRight', (s) => s.perception?.objectiveCollected === true, 140, 4);
  await holdUntil(harness, 'ArrowUp', (s) => s.y <= 100, 40, 4);
  const escaped = await holdUntil(harness, 'ArrowLeft', (s) => s.perception?.outcome === 'complete', 160, 4);

  const passed =
    spotted.perception?.mode === 'infiltrate' &&
    spotted.perception.seen === true &&
    spotted.perception.outcome === 'failed' &&
    loot.perception?.objectiveCollected === true &&
    loot.perception.alarm === false &&
    escaped.perception?.outcome === 'complete' &&
    escaped.perception.alarm === false;
  return { passed, details: { spotted: spotted.perception, loot: loot.perception, escaped: escaped.perception } };
}

async function heistRun(harness: Harness): Promise<SmokeOutcome> {
  await start(harness);
  const nearExit = await holdUntil(harness, 'ArrowUp', (s) => s.y <= 100, 55, 4);
  await harness.stepFrames(3);
  const blocked = await snap(harness);
  await holdUntil(harness, 'ArrowRight', (s) => s.x >= 760, 120, 4);
  const stolen = await holdUntil(harness, 'ArrowDown', (s) => s.perception?.objectiveCollected === true, 40, 3);
  await holdUntil(harness, 'ArrowUp', (s) => s.y <= 100, 40, 3);
  const escaped = await holdUntil(harness, 'ArrowLeft', (s) => s.perception?.outcome === 'complete', 160, 4);

  const passed =
    nearExit.perception?.mode === 'heist' &&
    blocked.perception?.objectiveCollected === false &&
    blocked.perception?.outcome === 'playing' &&
    stolen.perception?.objectiveCollected === true &&
    stolen.perception.alarm === true &&
    escaped.perception?.outcome === 'complete' &&
    escaped.perception.alarm === true;
  return { passed, details: { nearExit: nearExit.perception, blocked: blocked.perception, stolen: stolen.perception, escaped: escaped.perception } };
}

async function main(): Promise<number> {
  if (!findSystemChrome()) {
    console.error('Wave-4 play is INCOMPLETE: no system Chrome found.');
    return 1;
  }
  const games = [
    { id: 'wave4-stealth-game', run: stealthRun },
    { id: 'wave4-heist-game', run: heistRun },
  ] as const;
  let failed = 0;
  for (const game of games) {
    process.stdout.write(`Playing ${game.id}...\n`);
    const result = await runSmoke({
      id: game.id,
      buildDir: path.join(REPO_ROOT, 'games', game.id, 'dist'),
      run: game.run,
    });
    const ok = result.passed;
    if (!ok) failed += 1;
    console.log(
      `[${ok ? 'PASS' : 'FAIL'}] ${game.id} console=${JSON.stringify(result.consoleErrors)} external=${JSON.stringify(result.externalRequests)} details=${JSON.stringify(result.details)}`,
    );
  }
  console.log(`\n${games.length - failed}/${games.length} Wave-4 generated games played.`);
  return failed === 0 ? 0 : 1;
}

process.exit(await main());
