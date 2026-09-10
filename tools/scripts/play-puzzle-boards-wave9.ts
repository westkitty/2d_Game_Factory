import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { findSystemChrome, readShellState, runSmoke, type Harness, type SmokeOutcome } from '@sw2d/qa';

/**
 * Category-C Wave 9 play journeys against factory-generated games
 * (not starter-kit overlays). Proves match swap/cascade vs falling-block
 * gravity/lock/line-clear through the existing sw2d.puzzle-rules engines.
 */

const REPO_ROOT = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '../..');

interface PuzzleBoardSnap {
  readonly active: boolean;
  readonly kind: string | null;
  readonly solved: boolean;
  readonly moves: number;
  readonly cursorCol: number;
  readonly cursorRow: number;
  readonly selectedCol: number | null;
  readonly selectedRow: number | null;
  readonly clears: number;
  readonly lines: number;
  readonly toppedOut: boolean;
  readonly objective: number;
  readonly progress: number;
}

interface GridShell {
  readonly col: number;
  readonly row: number;
  readonly solved?: boolean;
  readonly puzzle?: { readonly kind?: string; readonly solved?: boolean; readonly clears?: number; readonly lines?: number };
  readonly puzzleBoard?: PuzzleBoardSnap;
}

async function start(harness: Harness): Promise<void> {
  await harness.keyTap('Space');
  await harness.stepFrames(24);
}

async function waitBoard(
  harness: Harness,
  predicate: (state: GridShell) => boolean,
  maxSteps = 40,
  framesPerStep = 4,
): Promise<GridShell> {
  let state = await readShellState<GridShell>(harness, 'game.grid-shell');
  for (let step = 0; step < maxSteps && !predicate(state); step++) {
    await harness.stepFrames(framesPerStep);
    state = await readShellState<GridShell>(harness, 'game.grid-shell');
  }
  return state;
}

async function matchRun(harness: Harness): Promise<SmokeOutcome> {
  await start(harness);
  const initial = await readShellState<GridShell>(harness, 'game.grid-shell');

  await harness.keyTap('ArrowDown');
  await harness.stepFrames(4);
  const down = await readShellState<GridShell>(harness, 'game.grid-shell');

  await harness.keyTap('Enter');
  await harness.stepFrames(4);
  const selected = await readShellState<GridShell>(harness, 'game.grid-shell');

  await harness.keyTap('ArrowRight');
  await harness.stepFrames(4);
  const right = await readShellState<GridShell>(harness, 'game.grid-shell');

  await harness.keyTap('Enter');
  const done = await waitBoard(harness, (state) => state.puzzleBoard?.solved === true || state.solved === true, 20, 4);

  const passed =
    initial.puzzleBoard?.kind === 'match' &&
    initial.puzzleBoard.active === true &&
    initial.puzzleBoard.solved === false &&
    (initial.puzzleBoard.clears ?? 0) === 0 &&
    down.puzzleBoard?.cursorRow === 1 &&
    down.puzzleBoard?.cursorCol === 0 &&
    selected.puzzleBoard?.selectedCol === 0 &&
    selected.puzzleBoard?.selectedRow === 1 &&
    right.puzzleBoard?.cursorCol === 1 &&
    right.puzzleBoard?.cursorRow === 1 &&
    (done.puzzleBoard?.solved === true || done.solved === true) &&
    (done.puzzleBoard?.clears ?? done.puzzle?.clears ?? 0) >= 3;
  return {
    passed,
    details: {
      initial: initial.puzzleBoard,
      down: down.puzzleBoard,
      selected: selected.puzzleBoard,
      right: right.puzzleBoard,
      done: done.puzzleBoard ?? { solved: done.solved, puzzle: done.puzzle },
    },
  };
}

async function fallingRun(harness: Harness): Promise<SmokeOutcome> {
  await start(harness);
  const initial = await readShellState<GridShell>(harness, 'game.grid-shell');

  await harness.keyTap('ArrowRight');
  await harness.stepFrames(3);
  await harness.keyTap('ArrowRight');
  await harness.stepFrames(3);
  await harness.keyTap('ArrowRight');
  await harness.stepFrames(4);
  const moved = await readShellState<GridShell>(harness, 'game.grid-shell');

  await harness.keyTap('KeyK');
  await harness.stepFrames(6);
  const parked = await readShellState<GridShell>(harness, 'game.grid-shell');

  await harness.keyTap('KeyK');
  const done = await waitBoard(harness, (state) => state.puzzleBoard?.solved === true || state.solved === true, 30, 4);

  const passed =
    initial.puzzleBoard?.kind === 'falling-block' &&
    initial.puzzleBoard.active === true &&
    initial.puzzleBoard.solved === false &&
    (initial.puzzleBoard.lines ?? 0) === 0 &&
    moved.puzzleBoard?.kind === 'falling-block' &&
    (parked.puzzleBoard?.solved ?? false) === false &&
    (done.puzzleBoard?.solved === true || done.solved === true) &&
    (done.puzzleBoard?.lines ?? done.puzzle?.lines ?? 0) >= 1;
  return {
    passed,
    details: {
      initial: initial.puzzleBoard,
      moved: moved.puzzleBoard,
      parked: parked.puzzleBoard,
      done: done.puzzleBoard ?? { solved: done.solved, puzzle: done.puzzle },
    },
  };
}

async function main(): Promise<number> {
  if (!findSystemChrome()) {
    console.error('Wave-9 play is INCOMPLETE: no system Chrome found.');
    return 1;
  }
  const games = [
    { id: 'wave9-match-puzzle', run: matchRun },
    { id: 'wave9-falling-block-puzzle', run: fallingRun },
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
  console.log(`\n${games.length - failed}/${games.length} Wave-9 generated games played.`);
  return failed === 0 ? 0 : 1;
}

process.exit(await main());
