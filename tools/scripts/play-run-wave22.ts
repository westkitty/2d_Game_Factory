import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { findSystemChrome, readShellState, runSmoke, type Harness, type SmokeOutcome } from '@sw2d/qa';

/**
 * Category-C Wave 22 play journeys against factory-generated games
 * (not starter-kit overlays). Proves two different auto-run presentations:
 * reach-the-flag course vs survive-and-score endless.
 */

const REPO_ROOT = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '../..');

interface RunSnap {
  readonly active: boolean;
  readonly mode: string | null;
  readonly x: number;
  readonly y: number;
  readonly onGround: boolean;
  readonly score: number;
  readonly jumps: number;
  readonly lastResult: string | null;
  readonly outcome: string;
}

interface PlatformShell {
  readonly x: number;
  readonly y: number;
  readonly onGround: boolean;
  readonly run?: RunSnap;
}

async function start(harness: Harness): Promise<void> {
  await harness.keyTap('Space');
  await harness.stepFrames(12);
}

async function snap(harness: Harness): Promise<PlatformShell> {
  return readShellState<PlatformShell>(harness, 'game.platform-shell');
}

async function waitUntil(
  harness: Harness,
  predicate: (state: PlatformShell) => boolean,
  maxSteps = 120,
  framesPerStep = 4,
): Promise<PlatformShell> {
  let state = await snap(harness);
  for (let step = 0; step < maxSteps && !predicate(state); step++) {
    await harness.stepFrames(framesPerStep);
    state = await snap(harness);
  }
  return state;
}

async function jumpGap(harness: Harness): Promise<{ before: PlatformShell; after: PlatformShell }> {
  const before = await waitUntil(harness, (s) => (s.run?.x ?? s.x) >= 200);
  await harness.keyTap('Space');
  await harness.stepFrames(8);
  const after = await snap(harness);
  return { before, after };
}

async function courseRun(harness: Harness): Promise<SmokeOutcome> {
  await start(harness);
  const initial = await snap(harness);
  const jumped = await jumpGap(harness);
  const done = await waitUntil(harness, (s) => s.run?.outcome === 'complete' || s.run?.outcome === 'failed');

  const passed =
    initial.run?.mode === 'course' &&
    initial.run.outcome === 'playing' &&
    initial.run.jumps === 0 &&
    initial.x > 90 &&
    initial.x < 220 &&
    jumped.before.run?.x !== undefined &&
    jumped.before.run.x >= 200 &&
    jumped.after.run?.jumps === 1 &&
    jumped.after.run.lastResult === 'jump' &&
    done.run?.outcome === 'complete' &&
    done.run.lastResult === 'finished' &&
    done.run.x >= 820;
  return {
    passed,
    details: {
      initial: { x: initial.x, run: initial.run },
      jumped: { before: jumped.before.run, after: jumped.after.run },
      done: done.run,
    },
  };
}

async function endlessRun(harness: Harness): Promise<SmokeOutcome> {
  await start(harness);
  const initial = await snap(harness);
  const jumped = await jumpGap(harness);
  const done = await waitUntil(harness, (s) => s.run?.outcome === 'complete' || s.run?.outcome === 'failed');

  const passed =
    initial.run?.mode === 'endless' &&
    initial.run.outcome === 'playing' &&
    initial.run.jumps === 0 &&
    initial.run.score < 80 &&
    initial.x > 90 &&
    initial.x < 220 &&
    jumped.after.run?.jumps === 1 &&
    done.run?.outcome === 'complete' &&
    done.run.lastResult === 'survived' &&
    done.run.score >= 80;
  return {
    passed,
    details: {
      initial: { x: initial.x, run: initial.run },
      jumped: { before: jumped.before.run, after: jumped.after.run },
      done: done.run,
    },
  };
}

async function main(): Promise<number> {
  if (!findSystemChrome()) {
    console.error('Wave-22 play is INCOMPLETE: no system Chrome found.');
    return 1;
  }
  const games = [
    { id: 'wave22-auto-runner', run: courseRun },
    { id: 'wave22-endless-runner', run: endlessRun },
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
  console.log(`\n${games.length - failed}/${games.length} Wave-22 generated games played.`);
  return failed === 0 ? 0 : 1;
}

process.exit(await main());
