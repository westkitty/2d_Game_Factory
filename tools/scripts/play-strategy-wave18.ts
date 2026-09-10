import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { findSystemChrome, readShellState, runSmoke, type Harness, type SmokeOutcome } from '@sw2d/qa';

/**
 * Category-C Wave 18 play journeys against factory-generated games
 * (not starter-kit overlays). Proves two different sw2d.strategy
 * presentations: select-then-step tactics vs pick-and-strike battler.
 */

const REPO_ROOT = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '../..');

interface StrategySnap {
  readonly active: boolean;
  readonly mode: string | null;
  readonly team: string | null;
  readonly turnNumber: number;
  readonly selected: string | null;
  readonly cursorCol: number;
  readonly cursorRow: number;
  readonly unitCol: number;
  readonly unitRow: number;
  readonly fighter: string | null;
  readonly cpuHealth: number;
  readonly nearId: string | null;
  readonly lastResult: string | null;
  readonly outcome: string;
}

interface GridShell {
  readonly col: number;
  readonly row: number;
  readonly strategy?: StrategySnap;
}

interface UiShell {
  readonly strategy?: StrategySnap;
}

async function start(harness: Harness): Promise<void> {
  await harness.keyTap('Space');
  await harness.stepFrames(12);
}

async function snapGrid(harness: Harness): Promise<GridShell> {
  return readShellState<GridShell>(harness, 'game.grid-shell');
}

async function snapUi(harness: Harness): Promise<UiShell> {
  return readShellState<UiShell>(harness, 'game.ui-simulation-shell');
}

async function waitUi(
  harness: Harness,
  predicate: (state: UiShell) => boolean,
  maxSteps = 80,
  framesPerStep = 4,
): Promise<UiShell> {
  let state = await snapUi(harness);
  for (let step = 0; step < maxSteps && !predicate(state); step++) {
    await harness.stepFrames(framesPerStep);
    state = await snapUi(harness);
  }
  return state;
}

async function tacticsRun(harness: Harness): Promise<SmokeOutcome> {
  await start(harness);
  const initial = await snapGrid(harness);

  await harness.keyTap('ArrowRight');
  await harness.stepFrames(4);
  const aimed = await snapGrid(harness);

  await harness.keyTap('KeyJ');
  await harness.stepFrames(4);
  const empty = await snapGrid(harness);

  await harness.keyTap('ArrowLeft');
  await harness.stepFrames(4);
  await harness.keyTap('KeyJ');
  await harness.stepFrames(4);
  const selected = await snapGrid(harness);

  for (let i = 0; i < 4; i++) {
    await harness.keyTap('ArrowRight');
    await harness.stepFrames(4);
  }
  const done = await snapGrid(harness);

  const passed =
    initial.strategy?.mode === 'tactics' &&
    initial.strategy.team === 'player' &&
    initial.strategy.turnNumber === 1 &&
    initial.strategy.selected === null &&
    initial.strategy.cursorCol === 8 &&
    initial.strategy.unitCol === 8 &&
    initial.strategy.outcome === 'playing' &&
    aimed.strategy?.lastResult === 'aim' &&
    aimed.strategy.cursorCol === 9 &&
    aimed.strategy.unitCol === 8 &&
    empty.strategy?.lastResult === 'empty' &&
    selected.strategy?.lastResult === 'selected' &&
    selected.strategy.selected === 'scout' &&
    selected.strategy.unitCol === 8 &&
    done.strategy?.lastResult === 'seized' &&
    done.strategy.unitCol === 12 &&
    done.strategy.unitRow === 8 &&
    done.strategy.outcome === 'complete';
  return {
    passed,
    details: {
      initial: initial.strategy,
      aimed: aimed.strategy,
      empty: empty.strategy,
      selected: selected.strategy,
      done: done.strategy,
    },
  };
}

async function battlerRun(harness: Harness): Promise<SmokeOutcome> {
  await start(harness);
  const initial = await snapUi(harness);

  await harness.keyTap('ArrowRight');
  await harness.stepFrames(4);
  const picked = await snapUi(harness);

  await harness.keyTap('Enter');
  await harness.stepFrames(4);
  const hit = await snapUi(harness);

  await harness.keyTap('Enter');
  await harness.stepFrames(4);
  const waited = await snapUi(harness);

  const back = await waitUi(harness, (s) => s.strategy?.team === 'player' && s.strategy.lastResult === 'cpu-pass');

  await harness.keyTap('Enter');
  await harness.stepFrames(4);
  const done = await snapUi(harness);

  const passed =
    initial.strategy?.mode === 'battler' &&
    initial.strategy.team === 'player' &&
    initial.strategy.turnNumber === 1 &&
    initial.strategy.fighter === 'FOX' &&
    initial.strategy.cpuHealth === 2 &&
    initial.strategy.outcome === 'playing' &&
    picked.strategy?.fighter === 'BEAR' &&
    hit.strategy?.lastResult === 'hit' &&
    hit.strategy.cpuHealth === 1 &&
    hit.strategy.selected === 'bear' &&
    hit.strategy.team === 'cpu' &&
    waited.strategy?.lastResult === 'wait' &&
    back.strategy?.lastResult === 'cpu-pass' &&
    back.strategy.team === 'player' &&
    done.strategy?.lastResult === 'won' &&
    done.strategy.cpuHealth === 0 &&
    done.strategy.outcome === 'complete';
  return {
    passed,
    details: {
      initial: initial.strategy,
      picked: picked.strategy,
      hit: hit.strategy,
      waited: waited.strategy,
      back: back.strategy,
      done: done.strategy,
    },
  };
}

async function main(): Promise<number> {
  if (!findSystemChrome()) {
    console.error('Wave-18 play is INCOMPLETE: no system Chrome found.');
    return 1;
  }
  const games = [
    { id: 'wave18-turn-based-tactics', run: tacticsRun },
    { id: 'wave18-auto-battler', run: battlerRun },
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
  console.log(`\n${games.length - failed}/${games.length} Wave-18 generated games played.`);
  return failed === 0 ? 0 : 1;
}

process.exit(await main());
