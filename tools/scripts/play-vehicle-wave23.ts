import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { findSystemChrome, readShellState, runSmoke, type Harness, type SmokeOutcome } from '@sw2d/qa';

/**
 * Category-C Wave 23 play journeys against factory-generated games
 * (not starter-kit overlays). Proves two different vehicle presentations:
 * arcade distance on the road vs J boat-to-flight altitude.
 */

const REPO_ROOT = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '../..');

interface DriveSnap {
  readonly active: boolean;
  readonly mode: string | null;
  readonly profile: string | null;
  readonly x: number;
  readonly y: number;
  readonly speed: number;
  readonly altitude: number;
  readonly score: number;
  readonly lastResult: string | null;
  readonly outcome: string;
}

interface VehicleShell {
  readonly x: number;
  readonly y: number;
  readonly drive?: DriveSnap;
  readonly vehicle?: { readonly altitude?: number; readonly profile?: string };
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
  maxSteps = 120,
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

async function roadRun(harness: Harness): Promise<SmokeOutcome> {
  await start(harness);
  const initial = await snap(harness);
  const done = await holdUntil(harness, ['ArrowUp'], (s) => s.drive?.outcome === 'complete');

  const passed =
    initial.drive?.mode === 'road' &&
    initial.drive.outcome === 'playing' &&
    initial.drive.score < 80 &&
    initial.x > 140 &&
    initial.x < 280 &&
    done.drive?.outcome === 'complete' &&
    done.drive.lastResult === 'distance' &&
    done.drive.score >= 80;
  return {
    passed,
    details: {
      initial: { x: initial.x, drive: initial.drive },
      done: done.drive,
    },
  };
}

async function craftRun(harness: Harness): Promise<SmokeOutcome> {
  await start(harness);
  const initial = await snap(harness);

  await harness.keyTap('KeyJ');
  await harness.stepFrames(6);
  const switched = await snap(harness);

  const done = await holdUntil(
    harness,
    ['ArrowUp', 'ShiftLeft'],
    (s) => s.drive?.outcome === 'complete' || (s.drive?.altitude ?? 0) >= 80,
  );

  const passed =
    initial.drive?.mode === 'craft' &&
    initial.drive.profile === 'boat' &&
    initial.drive.outcome === 'playing' &&
    initial.drive.altitude === 0 &&
    switched.drive?.profile === 'flight' &&
    switched.drive.lastResult === 'flight' &&
    done.drive?.profile === 'flight' &&
    done.drive.outcome === 'complete' &&
    done.drive.lastResult === 'airborne' &&
    done.drive.altitude >= 80;
  return {
    passed,
    details: {
      initial: { x: initial.x, drive: initial.drive },
      switched: switched.drive,
      done: done.drive,
    },
  };
}

async function main(): Promise<number> {
  if (!findSystemChrome()) {
    console.error('Wave-23 play is INCOMPLETE: no system Chrome found.');
    return 1;
  }
  const games = [
    { id: 'wave23-endless-driving', run: roadRun },
    { id: 'wave23-boat-flight-racer', run: craftRun },
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
  console.log(`\n${games.length - failed}/${games.length} Wave-23 generated games played.`);
  return failed === 0 ? 0 : 1;
}

process.exit(await main());
