import type { Harness } from '../src/harness.ts';
import { clickAt, restartRun, shellReader, startPlay } from '../src/journey.ts';
import { readSnapshot } from '../src/snapshot.ts';
import type { SmokeOutcome } from '../src/smokeRunner.ts';

interface Puzzle {
  readonly kind: string | null;
  readonly solved: boolean;
  readonly note: boolean;
  readonly key: boolean;
  readonly lastResult: string | null;
}
interface Shell {
  readonly hoveredId?: string | null;
  readonly puzzle?: Puzzle;
}

export async function run(harness: Harness): Promise<SmokeOutcome> {
  const read = shellReader<Shell>(harness, 'game.pointer-shell');
  const evidence: Record<string, unknown> = {};
  await startPlay(harness, 12);
  const booted = await readSnapshot(harness);
  const initial = await read();
  evidence.initial = initial.puzzle;
  const startedOk = booted.installedPacks.includes('sw2d.puzzle') && initial.puzzle?.kind === 'escape-locks' && !initial.puzzle.note && !initial.puzzle.key && !initial.puzzle.solved;

  // The lock before the note is locked (order matters); the note hotspot unlocks the key.
  await clickAt(harness, 480, 280);
  const locked = await read();
  evidence.locked = locked.puzzle;
  const lockedOk = locked.puzzle?.lastResult === 'locked' && !locked.puzzle.solved && !locked.puzzle.key;
  await clickAt(harness, 240, 280);
  const note = await read();
  evidence.note = note.puzzle;
  const noteOk = note.puzzle?.note === true && !note.puzzle.key && !note.puzzle.solved;
  // Clicking the note twice does not change the state.
  await clickAt(harness, 240, 280);
  const noteAgain = await read();
  const idempotentOk = noteAgain.puzzle?.note === true && !noteAgain.puzzle.solved;
  await clickAt(harness, 480, 280);
  const unlocked = await read();
  evidence.unlocked = unlocked.puzzle;
  const unlockedOk = unlocked.puzzle?.key === true && unlocked.puzzle.solved === true;

  const run = await restartRun(harness);
  const fresh = await read();
  evidence.restart = { ...run, puzzle: fresh.puzzle };
  const restartOk = run.after === run.before + 1 && !fresh.puzzle?.note && !fresh.puzzle?.key && !fresh.puzzle?.solved;

  const passed = startedOk && lockedOk && noteOk && idempotentOk && unlockedOk && restartOk;
  return { passed, details: { ...evidence, startedOk, lockedOk, noteOk, idempotentOk, unlockedOk, restartOk } };
}
