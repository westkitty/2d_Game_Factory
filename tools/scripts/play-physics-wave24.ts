import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { findSystemChrome, readShellState, runSmoke, type Harness, type SmokeOutcome } from '@sw2d/qa';

/**
 * Category-C Wave 24 play journeys against factory-generated games.
 * Toy launch/goal vs table flippers/bumpers.
 */

const REPO_ROOT = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '../..');

interface PhysicsSnap {
  readonly active: boolean;
  readonly mode: string | null;
  readonly ballX: number;
  readonly ballY: number;
  readonly score: number;
  readonly nudges: number;
  readonly flips: number;
  readonly lastResult: string | null;
  readonly outcome: string;
}

interface PointerShell {
  readonly physicsPlay?: PhysicsSnap;
}

interface UiShell {
  readonly physicsPlay?: PhysicsSnap;
}

async function start(harness: Harness): Promise<void> {
  await harness.keyTap('Space');
  await harness.stepFrames(12);
}

async function waitUntil(
  harness: Harness,
  read: () => Promise<{ physicsPlay?: PhysicsSnap }>,
  predicate: (snap: PhysicsSnap | undefined) => boolean,
  maxSteps = 160,
  framesPerStep = 4,
): Promise<PhysicsSnap | undefined> {
  let snap = (await read()).physicsPlay;
  for (let step = 0; step < maxSteps && !predicate(snap); step++) {
    await harness.stepFrames(framesPerStep);
    snap = (await read()).physicsPlay;
  }
  return snap;
}

async function toyRun(harness: Harness): Promise<SmokeOutcome> {
  await start(harness);
  const initial = await readShellState<PointerShell>(harness, 'game.pointer-shell');
  await harness.keyTap('KeyJ');
  const done = await waitUntil(
    harness,
    () => readShellState<PointerShell>(harness, 'game.pointer-shell'),
    (s) => s?.outcome === 'complete',
  );
  const passed =
    initial.physicsPlay?.mode === 'toy' &&
    initial.physicsPlay.outcome === 'playing' &&
    initial.physicsPlay.ballX < 400 &&
    done?.outcome === 'complete' &&
    done.lastResult === 'goal' &&
    done.ballX >= 740;
  return { passed, details: { initial: initial.physicsPlay, done } };
}

async function tableRun(harness: Harness): Promise<SmokeOutcome> {
  await start(harness);
  const initial = await readShellState<UiShell>(harness, 'game.ui-simulation-shell');
  let live = initial;
  for (let i = 0; i < 80 && live.physicsPlay?.outcome !== 'complete'; i++) {
    if ((live.physicsPlay?.score ?? 0) < 2 && (live.physicsPlay?.ballY ?? 0) > 400) {
      await harness.keyTap(live.physicsPlay && live.physicsPlay.ballX < 480 ? 'KeyJ' : 'KeyK');
    }
    await harness.stepFrames(6);
    live = await readShellState<UiShell>(harness, 'game.ui-simulation-shell');
  }
  const done = live.physicsPlay;
  const passed =
    initial.physicsPlay?.mode === 'table' &&
    initial.physicsPlay.outcome === 'playing' &&
    initial.physicsPlay.score === 0 &&
    done?.mode === 'table' &&
    done.outcome === 'complete' &&
    done.score >= 2 &&
    done.lastResult === 'scored';
  return { passed, details: { initial: initial.physicsPlay, done } };
}

async function main(): Promise<number> {
  if (!findSystemChrome()) {
    console.error('Wave-24 play is INCOMPLETE: no system Chrome found.');
    return 1;
  }
  const games = [
    { id: 'wave24-physics-toy', run: toyRun },
    { id: 'wave24-pinball-lite', run: tableRun },
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
  console.log(`\n${games.length - failed}/${games.length} Wave-24 generated games played.`);
  return failed === 0 ? 0 : 1;
}

process.exit(await main());
