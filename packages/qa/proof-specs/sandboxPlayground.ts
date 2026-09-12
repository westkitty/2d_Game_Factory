import type { Harness } from '../src/harness.ts';
import { clickAt, restartRun, shellReader, startPlay } from '../src/journey.ts';
import { readSnapshot } from '../src/snapshot.ts';
import type { SmokeOutcome } from '../src/smokeRunner.ts';

interface Toy {
  readonly active: boolean;
  readonly mode: string | null;
  readonly selected: string;
  readonly blocks: number;
  readonly balls: number;
  readonly stamps: number;
  readonly held: string | null;
  readonly moved: number;
  readonly duplicated: number;
  readonly edited: number;
  readonly undoDepth: number;
  readonly redoDepth: number;
  readonly persisted: boolean;
  readonly crates: number;
  readonly lastResult: string | null;
  readonly outcome: string;
}
interface Shell {
  readonly toy?: Toy;
}

export async function run(harness: Harness): Promise<SmokeOutcome> {
  const read = shellReader<Shell>(harness, 'game.pointer-shell');
  const t = async () => (await read()).toy!;
  const evidence: Record<string, unknown> = {};
  await startPlay(harness, 12);
  const booted = await readSnapshot(harness);
  const initial = await t();
  evidence.initial = initial;
  const startedOk = booted.installedPacks.includes('sw2d.world') && initial.mode === 'sandbox' && initial.blocks === 0 && initial.held === null && initial.selected === 'block';

  // Stamp a block; click it again to pick it up; click elsewhere to move it; SECONDARY removes it.
  await clickAt(harness, 400, 280);
  const block = await t();
  await clickAt(harness, 400, 280);
  const held = await t();
  await clickAt(harness, 500, 320);
  const moved = await t();
  evidence.author = { block: block.lastResult, held: held.held, moved: moved.lastResult, movedCount: moved.moved, blocks: moved.blocks };
  const authorOk = block.lastResult === 'stamp-block' && block.blocks === 1 && held.lastResult === 'hold-block' && held.held === 'block' && moved.lastResult === 'move-block' && moved.moved === 1 && moved.held === null && moved.blocks === 1;
  // SECONDARY removes the held stamp, else the most recent one; on an empty board it reports 'empty'.
  await harness.keyTap('KeyK');
  await harness.stepFrames(4);
  const removed = await t();
  await harness.keyTap('KeyK');
  await harness.stepFrames(4);
  const empty = await t();
  evidence.removed = { last: removed.lastResult, blocks: removed.blocks, thenEmpty: empty.lastResult };
  const removeOk = removed.lastResult === 'remove-block' && removed.blocks === 0 && empty.lastResult === 'empty' && empty.blocks === 0;

  // Re-stamp, move, duplicate, edit, undo/redo, then author all three object kinds.
  await clickAt(harness, 400, 280);
  await clickAt(harness, 400, 280);
  await clickAt(harness, 470, 320);
  await harness.keyTap('KeyE'); await harness.stepFrames(3);
  const duplicated = await t();
  await harness.keyTap('Enter'); await harness.stepFrames(3);
  const edited = await t();
  await harness.keyTap('Backspace'); await harness.stepFrames(3);
  const undone = await t();
  await harness.keyTap('ShiftLeft'); await harness.stepFrames(3);
  const redone = await t();
  await harness.keyTap('ArrowRight');
  await harness.stepFrames(2);
  const picked = await t();
  await clickAt(harness, 600, 280);
  await harness.keyTap('ArrowRight'); await harness.stepFrames(2);
  await clickAt(harness, 700, 300);
  const done = await t();
  evidence.done = { duplicated, edited, undone, redone, done };
  const historyOk = duplicated.duplicated === 1 && edited.edited === 1 && undone.lastResult === 'undo' && undone.redoDepth === 1 && redone.lastResult === 'redo';
  const doneOk = picked.selected === 'ball' && done.lastResult === 'stamp-crate' && done.blocks >= 1 && done.balls === 1 && done.crates === 1 && done.persisted && done.outcome === 'complete';

  const run = await restartRun(harness);
  const fresh = await t();
  evidence.restart = { ...run, blocks: fresh.blocks, balls: fresh.balls, outcome: fresh.outcome };
  const restartOk = run.after === run.before + 1 && fresh.blocks >= 1 && fresh.balls === 1 && fresh.crates === 1 && fresh.persisted;

  const passed = startedOk && authorOk && removeOk && historyOk && doneOk && restartOk;
  return { passed, details: { ...evidence, startedOk, authorOk, removeOk, historyOk, doneOk, restartOk } };
}
