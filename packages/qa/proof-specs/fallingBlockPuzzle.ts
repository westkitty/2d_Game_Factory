import type { Harness } from '../src/harness.ts';
import { restartRun, shellReader, startPlay, waitUntil } from '../src/journey.ts';
import { readSnapshot } from '../src/snapshot.ts';
import type { SmokeOutcome } from '../src/smokeRunner.ts';

interface Board {
  readonly active: boolean;
  readonly kind: string | null;
  readonly solved: boolean;
  readonly moves: number;
  readonly lines: number;
  readonly toppedOut: boolean;
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
  const startedOk = booted.installedPacks.includes('sw2d.puzzle-rules') && initial.kind === 'falling-block' && initial.active && !initial.solved && initial.lines === 0 && !initial.toppedOut;

  // Shift the falling piece three columns right, hard-drop it: it parks without a line.
  for (let i = 0; i < 3; i++) await harness.keyTap('ArrowRight');
  const moved = await b();
  await harness.keyTap('KeyK');
  await harness.stepFrames(6);
  const parked = await b();
  evidence.parked = parked;
  const parkOk = moved.moves >= 3 && !parked.solved && parked.lines === 0 && parked.moves > moved.moves;
  // The next hard-drop completes the authored line: line-clear, objective met.
  await harness.keyTap('KeyK');
  const done = (await waitUntil(harness, read, (s) => s.puzzleBoard?.solved === true, 30, 4)).puzzleBoard!;
  evidence.done = done;
  const doneOk = done.solved && done.lines >= 1 && done.lines >= done.objective && !done.toppedOut;

  const run = await restartRun(harness, 24);
  const fresh = await b();
  evidence.restart = { ...run, solved: fresh.solved, lines: fresh.lines, moves: fresh.moves };
  // `moves` also counts gravity ticks (a `tick` op), so a settled fresh board may show one.
  const restartOk = run.after === run.before + 1 && !fresh.solved && fresh.lines === 0 && fresh.moves <= 1;

  const passed = startedOk && parkOk && doneOk && restartOk;
  return { passed, details: { ...evidence, startedOk, parkOk, doneOk, restartOk } };
}
