import type { Harness } from '../src/harness.ts';
import { restartRun, shellReader, startPlay, waitUntil } from '../src/journey.ts';
import { readSnapshot } from '../src/snapshot.ts';
import type { SmokeOutcome } from '../src/smokeRunner.ts';

interface Puzzle {
  readonly kind: string | null;
  readonly solved: boolean;
  readonly inGoal: boolean;
  readonly lastResult: string | null;
  readonly ball: { readonly x: number; readonly y: number } | null;
}
interface Shell {
  readonly nudges?: number;
  readonly puzzle?: Puzzle;
}

export async function run(harness: Harness): Promise<SmokeOutcome> {
  const read = shellReader<Shell>(harness, 'game.pointer-shell');
  const evidence: Record<string, unknown> = {};
  await startPlay(harness, 12);
  const booted = await readSnapshot(harness);
  await harness.stepFrames(30);
  const initial = await read();
  evidence.initial = { puzzle: initial.puzzle, nudges: initial.nudges };
  const startedOk = booted.installedPacks.includes('sw2d.puzzle-rules') && initial.puzzle?.kind === 'physics-goal' && initial.puzzle.solved === false && (initial.puzzle.ball?.x ?? 999) < 400;

  // The ball is a real Matter body: left alone it settles and never reaches the goal.
  await harness.stepFrames(60);
  const idle = await read();
  evidence.idle = { puzzle: idle.puzzle, nudges: idle.nudges };
  const idleOk = idle.puzzle?.solved === false && idle.puzzle.inGoal === false && (idle.puzzle.ball?.x ?? 999) < 400 && (idle.nudges ?? 0) === 0;

  // One nudge sends it across; sw2d.puzzle-rules physics-goal marks it solved in the authored zone.
  await harness.keyTap('KeyJ');
  const nudged = await read();
  const nudgeOk = (nudged.nudges ?? 0) === 1;
  const landed = await waitUntil(harness, read, (s) => s.puzzle?.solved === true, 40, 4);
  evidence.landed = { puzzle: landed.puzzle, nudges: landed.nudges };
  const landedOk = landed.puzzle?.solved === true && landed.puzzle.inGoal === true && (landed.puzzle.ball?.x ?? 0) >= 740;

  const run = await restartRun(harness);
  await harness.stepFrames(30);
  const fresh = await read();
  evidence.restart = { ...run, puzzle: fresh.puzzle, nudges: fresh.nudges };
  const restartOk = run.after === run.before + 1 && fresh.puzzle?.solved === false && (fresh.puzzle.ball?.x ?? 999) < 400 && (fresh.nudges ?? 0) === 0;

  const passed = startedOk && idleOk && nudgeOk && landedOk && restartOk;
  return { passed, details: { ...evidence, startedOk, idleOk, nudgeOk, landedOk, restartOk } };
}
