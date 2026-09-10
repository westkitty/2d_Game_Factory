import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { findSystemChrome, readShellState, runSmoke, type Harness, type SmokeOutcome } from '@sw2d/qa';

/**
 * Category-C Wave 27 play journeys against factory-generated games.
 * Player-controlled gap vs vertical climb.
 */

const REPO_ROOT = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '../..');

interface ParkourSnap {
  readonly active: boolean;
  readonly mode: string | null;
  readonly x: number;
  readonly y: number;
  readonly onGround: boolean;
  readonly jumps: number;
  readonly lastResult: string | null;
  readonly outcome: string;
}

interface PlatformShell {
  readonly x: number;
  readonly y: number;
  readonly onGround: boolean;
  readonly parkour?: ParkourSnap;
}

async function start(harness: Harness): Promise<void> {
  await harness.keyTap('Space');
  await harness.stepFrames(12);
}

async function precisionRun(harness: Harness): Promise<SmokeOutcome> {
  await start(harness);
  const initial = await readShellState<PlatformShell>(harness, 'game.platform-shell');
  await harness.keyDown('ArrowRight');
  let state = initial;
  let jumped = false;
  for (let step = 0; step < 160 && state.parkour?.outcome === 'playing'; step++) {
    if (!jumped && state.x >= 210 && state.x <= 270 && state.onGround) {
      await harness.keyTap('Space');
      jumped = true;
    }
    await harness.stepFrames(4);
    state = await readShellState<PlatformShell>(harness, 'game.platform-shell');
  }
  await harness.keyUp('ArrowRight');
  await harness.stepFrames(8);
  state = await readShellState<PlatformShell>(harness, 'game.platform-shell');
  const passed =
    initial.parkour?.mode === 'precision' &&
    initial.parkour.outcome === 'playing' &&
    initial.x < 200 &&
    state.parkour?.outcome === 'complete' &&
    state.parkour.lastResult === 'finished' &&
    state.x >= 820;
  return { passed, details: { initial: { x: initial.x, parkour: initial.parkour }, done: { x: state.x, parkour: state.parkour } } };
}

async function climbRun(harness: Harness): Promise<SmokeOutcome> {
  await start(harness);
  const initial = await readShellState<PlatformShell>(harness, 'game.platform-shell');
  await harness.keyDown('ArrowRight');
  let state = initial;
  let jumpedAt = new Set<number>();
  for (let step = 0; step < 160 && state.parkour?.outcome === 'playing'; step++) {
    const band = state.x < 220 ? 1 : state.x < 360 ? 2 : 3;
    if (state.onGround && !jumpedAt.has(band) && band < 3) {
      await harness.keyTap('Space');
      jumpedAt.add(band);
    }
    await harness.stepFrames(4);
    state = await readShellState<PlatformShell>(harness, 'game.platform-shell');
  }
  await harness.keyUp('ArrowRight');
  await harness.stepFrames(8);
  state = await readShellState<PlatformShell>(harness, 'game.platform-shell');
  const passed =
    initial.parkour?.mode === 'climb' &&
    initial.parkour.outcome === 'playing' &&
    initial.y > 400 &&
    state.parkour?.outcome === 'complete' &&
    state.parkour.lastResult === 'summit' &&
    state.y <= 410 &&
    state.x >= 400;
  return {
    passed,
    details: { initial: { x: initial.x, y: initial.y, parkour: initial.parkour }, done: { x: state.x, y: state.y, parkour: state.parkour } },
  };
}

async function main(): Promise<number> {
  if (!findSystemChrome()) {
    console.error('Wave-27 play is INCOMPLETE: no system Chrome found.');
    return 1;
  }
  const games = [
    { id: 'wave27-precision-platformer', run: precisionRun },
    { id: 'wave27-climbing-game', run: climbRun },
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
  console.log(`\n${games.length - failed}/${games.length} Wave-27 generated games played.`);
  return failed === 0 ? 0 : 1;
}

process.exit(await main());
