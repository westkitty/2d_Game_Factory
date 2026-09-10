import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { findSystemChrome, readShellState, runSmoke, type Harness, type SmokeOutcome } from '@sw2d/qa';

/**
 * Category-C Wave 29 play journey against a factory-generated game
 * (not a starter-kit overlay). Proves game-specific kart item-fire:
 * drive through the box, then J fires the held shell.
 */

const REPO_ROOT = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '../..');

interface KartSnap {
  readonly active: boolean;
  readonly held: boolean;
  readonly fired: number;
  readonly boxX: number;
  readonly boxY: number;
  readonly lastResult: string | null;
  readonly outcome: string;
}

interface VehicleShell {
  readonly x: number;
  readonly y: number;
  readonly kartItem?: KartSnap;
}

async function start(harness: Harness): Promise<void> {
  await harness.keyTap('Space');
  await harness.stepFrames(12);
}

async function snap(harness: Harness): Promise<VehicleShell> {
  return readShellState<VehicleShell>(harness, 'game.vehicle-shell');
}

async function holdUntil(
  harness: Harness,
  codes: readonly string[],
  predicate: (state: VehicleShell) => boolean,
  maxSteps = 140,
  framesPerStep = 4,
): Promise<VehicleShell> {
  for (const code of codes) await harness.keyDown(code);
  try {
    let state = await snap(harness);
    for (let step = 0; step < maxSteps && !predicate(state); step++) {
      await harness.stepFrames(framesPerStep);
      state = await snap(harness);
    }
    return state;
  } finally {
    for (const code of [...codes].reverse()) await harness.keyUp(code);
    await harness.stepFrames(2);
  }
}

async function kartRun(harness: Harness): Promise<SmokeOutcome> {
  await start(harness);
  const initial = await snap(harness);

  await harness.keyTap('KeyJ');
  await harness.stepFrames(4);
  const empty = await snap(harness);

  const picked = await holdUntil(harness, ['ArrowUp'], (s) => s.kartItem?.held === true);

  await harness.keyTap('KeyJ');
  await harness.stepFrames(4);
  const done = await snap(harness);

  const passed =
    initial.kartItem?.active === true &&
    initial.kartItem.held === false &&
    initial.kartItem.fired === 0 &&
    initial.kartItem.outcome === 'playing' &&
    initial.x > 140 &&
    initial.x < 220 &&
    empty.kartItem?.lastResult === 'empty' &&
    empty.kartItem.held === false &&
    picked.kartItem?.held === true &&
    picked.kartItem.lastResult === 'pickup' &&
    done.kartItem?.lastResult === 'fired' &&
    done.kartItem.fired === 1 &&
    done.kartItem.held === false &&
    done.kartItem.outcome === 'complete';
  return {
    passed,
    details: {
      initial: { x: initial.x, y: initial.y, kartItem: initial.kartItem },
      empty: empty.kartItem,
      picked: { x: picked.x, y: picked.y, kartItem: picked.kartItem },
      done: { x: done.x, y: done.y, kartItem: done.kartItem },
    },
  };
}

async function main(): Promise<number> {
  if (!findSystemChrome()) {
    console.error('Wave-29 play is INCOMPLETE: no system Chrome found.');
    return 1;
  }
  const games = [{ id: 'wave29-kart-racer', run: kartRun }] as const;
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
  console.log(`\n${games.length - failed}/${games.length} Wave-29 generated games played.`);
  return failed === 0 ? 0 : 1;
}

process.exit(await main());
