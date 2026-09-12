import type { Harness } from '../src/harness.ts';
import { restartRun, shellReader, startPlay, waitUntil } from '../src/journey.ts';
import { readSnapshot } from '../src/snapshot.ts';
import type { SmokeOutcome } from '../src/smokeRunner.ts';

interface Board {
  readonly active: boolean;
  readonly kind: string | null;
  readonly solved: boolean;
  readonly moves: number;
  readonly cursorCol: number;
  readonly cursorRow: number;
  readonly selectedCol: number | null;
  readonly selectedRow: number | null;
  readonly clears: number;
  readonly objective: number;
  readonly progress: number;
}
interface Shell {
  readonly puzzleBoard?: Board;
}

export async function run(harness: Harness): Promise<SmokeOutcome> {
  const read = shellReader<Shell>(harness, 'game.grid-shell');
  const b = async () => (await read()).puzzleBoard!;
  const evidence: Record<string, unknown> = {};
  await startPlay(harness, 24);
  const booted = await readSnapshot(harness);
  const initial = await b();
  evidence.initial = initial;
  const startedOk = booted.installedPacks.includes('sw2d.puzzle-rules') && initial.kind === 'match' && initial.active && !initial.solved && initial.clears === 0 && initial.moves === 0;

  // Cursor moves on the grid; CONFIRM picks a cell; the second CONFIRM on a neighbour swaps.
  await harness.keyTap('ArrowDown');
  const down = await b();
  await harness.keyTap('Enter');
  const selected = await b();
  await harness.keyTap('ArrowRight');
  const right = await b();
  evidence.cursor = { down: [down.cursorCol, down.cursorRow], selected: [selected.selectedCol, selected.selectedRow], right: [right.cursorCol, right.cursorRow] };
  const cursorOk = down.cursorRow === 1 && down.cursorCol === 0 && selected.selectedCol === 0 && selected.selectedRow === 1 && right.cursorCol === 1 && right.cursorRow === 1;
  // The adjacent swap that lines up three: the rules engine counts the move and clears.
  await harness.keyTap('Enter');
  const swapped = (await waitUntil(harness, read, (s) => (s.puzzleBoard?.clears ?? 0) >= 1 || s.puzzleBoard?.solved === true, 20, 4)).puzzleBoard!;
  evidence.swapped = swapped;
  const swapOk = swapped.moves >= 1 && swapped.clears >= 1;
  const done = (await waitUntil(harness, read, (s) => s.puzzleBoard?.solved === true, 20, 4)).puzzleBoard!;
  evidence.done = done;
  const doneOk = done.solved && done.clears >= done.objective && done.progress >= 1;

  const run = await restartRun(harness, 24);
  const fresh = await b();
  evidence.restart = { ...run, solved: fresh.solved, clears: fresh.clears, moves: fresh.moves };
  const restartOk = run.after === run.before + 1 && !fresh.solved && fresh.clears === 0 && fresh.moves === 0;

  // On the fresh board, selecting a cell and confirming a non-adjacent cell is not a swap: no move, no clear.
  await harness.keyTap('Enter');
  await harness.keyTap('ArrowRight');
  await harness.keyTap('ArrowRight');
  await harness.keyTap('Enter');
  const rejected = await b();
  evidence.rejected = rejected;
  const rejectOk = rejected.moves === 0 && rejected.clears === 0 && !rejected.solved;

  const passed = startedOk && cursorOk && swapOk && doneOk && restartOk && rejectOk;
  return { passed, details: { ...evidence, startedOk, cursorOk, swapOk, doneOk, restartOk, rejectOk } };
}
