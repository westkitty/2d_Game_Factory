import { readShellState, readSnapshot } from '../src/snapshot.ts';
import type { Harness } from '../src/harness.ts';
import type { SmokeOutcome } from '../src/smokeRunner.ts';

interface ShellSnap {
  readonly enemiesActive: number;
  readonly enemiesRepathed: number;
  readonly blockersPlaced: number;
  readonly blockRejected: number;
  readonly reachedBase: number;
  readonly cursorCol: number;
  readonly cursorRow: number;
  readonly enemyCols: number[];
}
function state(h: Harness): Promise<ShellSnap> { return readShellState(h, 'game.grid-shell'); }

export async function run(harness: Harness): Promise<SmokeOutcome> {
  const evidence: Record<string, unknown> = {};
  await harness.keyTap('Space');
  await harness.stepFrames(8);
  const started = await readSnapshot(harness);
  const initial = await state(harness);
  evidence.initial = initial;
  const startedOk =
    started.scene === 'sw2d.play' &&
    started.installedPacks.includes('sw2d.navigation') &&
    initial.enemiesActive === 3 &&
    initial.reachedBase === 0;

  // Enemies advance along their routes.
  await harness.stepFrames(20);
  const advancing = await state(harness);
  evidence.advancing = advancing;
  const advanceOk = advancing.enemyCols.some((c, i) => c > initial.enemyCols[i]!);

  // Cursor is at (4,1). Place a blocker on the middle lane -> the row-1 enemy re-routes.
  await harness.keyTap('Enter'); // CONFIRM
  await harness.stepFrames(3);
  const afterBlock = await state(harness);
  evidence.afterBlock = afterBlock;
  const repathOk = afterBlock.blockersPlaced === 1 && afterBlock.enemiesRepathed >= 1 && afterBlock.blockRejected === 0;

  // Wall the rest of column 4 -> the last placement that would strand an enemy is rejected.
  await harness.keyTap('ArrowUp'); // -> (4,0)
  await harness.stepFrames(2);
  await harness.keyTap('Enter');
  await harness.stepFrames(2);
  await harness.keyTap('ArrowDown'); // (4,1) is blocked; go to (4,2)
  await harness.keyTap('ArrowDown');
  await harness.stepFrames(2);
  await harness.keyTap('Enter'); // would fully wall column 4 -> rejected
  await harness.stepFrames(3);
  const afterWall = await state(harness);
  evidence.afterWall = afterWall;
  const rejectOk = afterWall.blockRejected >= 1 && afterWall.blockersPlaced === 2;

  // The lane is never permanently invalidated: every enemy still reaches the base.
  for (let i = 0; i < 200 && (await state(harness)).reachedBase < 3; i++) await harness.stepFrames(6);
  const done = await state(harness);
  evidence.done = done;
  const notStrandedOk = done.reachedBase === 3 && done.enemiesActive === 0;

  // Restart.
  await harness.keyTap('KeyP');
  await harness.stepFrames(4);
  await harness.keyTap('KeyK');
  await harness.stepFrames(12);
  const afterRestart = await state(harness);
  evidence.afterRestart = afterRestart;
  const restartOk =
    afterRestart.enemiesActive === 3 && afterRestart.reachedBase === 0 &&
    afterRestart.blockersPlaced === 0 && afterRestart.blockRejected === 0;

  const passed = startedOk && advanceOk && repathOk && rejectOk && notStrandedOk && restartOk;
  return { passed, details: { ...evidence, startedOk, advanceOk, repathOk, rejectOk, notStrandedOk, restartOk } };
}
