import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { findSystemChrome, readShellState, runSmoke, type Harness, type SmokeOutcome } from '@sw2d/qa';

/**
 * Category-C Wave 25 play journeys against factory-generated games.
 * One-unit command vs stand-in-zone occupy.
 */

const REPO_ROOT = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '../..');

interface CommandSnap {
  readonly active: boolean;
  readonly mode: string | null;
  readonly selected: boolean;
  readonly unitX: number;
  readonly unitY: number;
  readonly owned: number;
  readonly lastResult: string | null;
  readonly outcome: string;
}

interface TopDownShell {
  readonly x: number;
  readonly y: number;
  readonly command?: CommandSnap;
}

async function start(harness: Harness): Promise<void> {
  await harness.keyTap('Space');
  await harness.stepFrames(12);
}

async function holdUntil(
  harness: Harness,
  codes: readonly string[],
  predicate: (state: TopDownShell) => boolean,
  maxSteps = 140,
  framesPerStep = 4,
): Promise<TopDownShell> {
  for (const code of codes) await harness.keyDown(code);
  try {
    let state = await readShellState<TopDownShell>(harness, 'game.top-down-shell');
    for (let step = 0; step < maxSteps && !predicate(state); step++) {
      await harness.stepFrames(framesPerStep);
      state = await readShellState<TopDownShell>(harness, 'game.top-down-shell');
    }
    return state;
  } finally {
    for (const code of [...codes].reverse()) await harness.keyUp(code);
    await harness.stepFrames(2);
  }
}

async function rtsRun(harness: Harness): Promise<SmokeOutcome> {
  await start(harness);
  const initial = await readShellState<TopDownShell>(harness, 'game.top-down-shell');
  await harness.keyTap('KeyJ');
  await harness.stepFrames(4);
  const selected = await readShellState<TopDownShell>(harness, 'game.top-down-shell');
  const done = await holdUntil(harness, ['ArrowRight'], (s) => s.command?.outcome === 'complete');
  const passed =
    initial.command?.mode === 'rts' &&
    initial.command.selected === false &&
    initial.command.outcome === 'playing' &&
    selected.command?.selected === true &&
    selected.command.lastResult === 'selected' &&
    done.command?.outcome === 'complete' &&
    done.command.lastResult === 'seized' &&
    done.command.unitX >= 780;
  return {
    passed,
    details: { initial: initial.command, selected: selected.command, done: done.command },
  };
}

async function zoneRun(harness: Harness): Promise<SmokeOutcome> {
  await start(harness);
  const initial = await readShellState<TopDownShell>(harness, 'game.top-down-shell');
  await holdUntil(harness, ['ArrowRight'], (s) => s.x >= 270);
  await harness.stepFrames(30);
  const ownedA = await readShellState<TopDownShell>(harness, 'game.top-down-shell');
  await holdUntil(harness, ['ArrowRight'], (s) => s.x >= 690);
  await harness.stepFrames(30);
  const done = await readShellState<TopDownShell>(harness, 'game.top-down-shell');
  const passed =
    initial.command?.mode === 'zone' &&
    initial.command.owned === 0 &&
    initial.command.outcome === 'playing' &&
    (ownedA.command?.owned ?? 0) >= 1 &&
    done.command?.outcome === 'complete' &&
    done.command.owned === 2 &&
    done.command.lastResult === 'owned';
  return {
    passed,
    details: { initial: initial.command, ownedA: ownedA.command, done: done.command },
  };
}

async function main(): Promise<number> {
  if (!findSystemChrome()) {
    console.error('Wave-25 play is INCOMPLETE: no system Chrome found.');
    return 1;
  }
  const games = [
    { id: 'wave25-simple-rts', run: rtsRun },
    { id: 'wave25-territory-control', run: zoneRun },
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
  console.log(`\n${games.length - failed}/${games.length} Wave-25 generated games played.`);
  return failed === 0 ? 0 : 1;
}

process.exit(await main());
