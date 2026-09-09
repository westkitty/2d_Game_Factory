import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { findSystemChrome, readShellState, runSmoke, type Harness, type SmokeOutcome } from '@sw2d/qa';

/**
 * Category-C Wave 6 play journeys against factory-generated games
 * (not starter-kit overlays). Proves skirmish 1x3 vs arena 3x2.
 */

const REPO_ROOT = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '../..');

interface MeleeSnap {
  readonly active: boolean;
  readonly mode: string | null;
  readonly playerX: number;
  readonly playerY: number;
  readonly playerHealth: number;
  readonly foesAlive: number;
  readonly lastResult: string | null;
  readonly outcome: string;
}

interface TopDownShell {
  readonly x: number;
  readonly y: number;
  readonly melee?: MeleeSnap;
}

async function snap(harness: Harness): Promise<TopDownShell> {
  return readShellState<TopDownShell>(harness, 'game.top-down-shell');
}

async function start(harness: Harness): Promise<void> {
  await harness.keyTap('Space');
  await harness.stepFrames(8);
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

async function attack(harness: Harness, times: number): Promise<void> {
  for (let hit = 0; hit < times; hit++) {
    await harness.keyTap('KeyX');
    await harness.stepFrames(3);
  }
}

async function skirmishRun(harness: Harness): Promise<SmokeOutcome> {
  await start(harness);
  const initial = await snap(harness);
  const approach = await holdUntil(harness, 'ArrowRight', (s) => s.x >= 350, 60, 4);
  await attack(harness, 3);
  const cleared = await snap(harness);

  const passed =
    initial.melee?.mode === 'skirmish' &&
    initial.melee.foesAlive === 1 &&
    initial.melee.playerHealth === 5 &&
    approach.x >= 350 &&
    cleared.melee?.foesAlive === 0 &&
    cleared.melee.lastResult === 'hit' &&
    (cleared.melee.playerHealth ?? 0) > 0 &&
    cleared.melee.outcome === 'complete';
  return { passed, details: { initial: initial.melee, approach, cleared: cleared.melee } };
}

async function arenaRun(harness: Harness): Promise<SmokeOutcome> {
  await start(harness);
  const initial = await snap(harness);

  await holdUntil(harness, 'ArrowUp', (s) => s.y <= 175, 50, 4);
  await holdUntil(harness, 'ArrowRight', (s) => s.x >= 330, 50, 4);
  await attack(harness, 2);
  const first = await snap(harness);

  await holdUntil(harness, 'ArrowDown', (s) => s.y >= 265, 45, 4);
  await holdUntil(harness, 'ArrowRight', (s) => s.x >= 455, 45, 4);
  await attack(harness, 2);
  const second = await snap(harness);

  await attack(harness, 2);
  const victory = await snap(harness);

  const passed =
    initial.melee?.mode === 'arena' &&
    initial.melee.foesAlive === 3 &&
    first.melee?.foesAlive === 2 &&
    second.melee?.foesAlive === 1 &&
    victory.melee?.foesAlive === 0 &&
    (victory.melee?.playerHealth ?? 0) > 0 &&
    victory.melee?.outcome === 'complete';
  return { passed, details: { initial: initial.melee, first: first.melee, second: second.melee, victory: victory.melee } };
}

async function main(): Promise<number> {
  if (!findSystemChrome()) {
    console.error('Wave-6 play is INCOMPLETE: no system Chrome found.');
    return 1;
  }
  const games = [
    { id: 'wave6-action-adventure', run: skirmishRun },
    { id: 'wave6-arena-combat', run: arenaRun },
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
  console.log(`\n${games.length - failed}/${games.length} Wave-6 generated games played.`);
  return failed === 0 ? 0 : 1;
}

process.exit(await main());
