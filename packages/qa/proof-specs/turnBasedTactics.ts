import { readShellState, readSnapshot } from '../src/snapshot.ts';
import type { Harness } from '../src/harness.ts';
import type { SmokeOutcome } from '../src/smokeRunner.ts';

interface ShellSnap {
  readonly unitCol: number;
  readonly unitRow: number;
  readonly cursorCol: number;
  readonly cursorRow: number;
  readonly reachableCount: number;
  readonly cursorReachable: boolean;
  readonly moving: boolean;
  readonly lastPathLen: number;
  readonly lastPathCost: number;
  readonly arrivedAt: { col: number; row: number } | null;
  readonly confirmsRejected: number;
}
function state(h: Harness): Promise<ShellSnap> { return readShellState(h, 'game.grid-shell'); }

export async function run(harness: Harness): Promise<SmokeOutcome> {
  const evidence: Record<string, unknown> = {};
  await harness.keyTap('Space');
  await harness.stepFrames(8);
  const started = await readSnapshot(harness);
  const initial = await state(harness);
  const again = await state(harness);
  evidence.initial = initial;
  const startedOk =
    started.scene === 'sw2d.play' &&
    started.installedPacks.includes('sw2d.navigation') &&
    initial.unitCol === 2 && initial.unitRow === 4 &&
    initial.reachableCount === again.reachableCount && // deterministic
    initial.reachableCount > 6;

  // Move the cursor up 2 - a cell inside the reachable set - and confirm.
  await harness.keyTap('ArrowUp');
  await harness.keyTap('ArrowUp');
  await harness.stepFrames(2);
  const aimed = await state(harness);
  evidence.aimed = aimed;
  const aimOk = aimed.cursorCol === 2 && aimed.cursorRow === 2 && aimed.cursorReachable === true;

  await harness.keyTap('Enter'); // CONFIRM
  for (let i = 0; i < 30 && (await state(harness)).moving; i++) await harness.stepFrames(4);
  const moved = await state(harness);
  evidence.moved = moved;
  const moveOk =
    moved.unitCol === 2 && moved.unitRow === 2 &&
    moved.moving === false &&
    moved.lastPathCost === 2 &&
    moved.lastPathLen === 3 &&
    moved.arrivedAt?.col === 2 && moved.arrivedAt?.row === 2;

  // Try to confirm a cell beyond the budget (around the wall) - rejected.
  for (let i = 0; i < 5; i++) await harness.keyTap('ArrowRight'); // cursor to col ~5-7 past the wall
  await harness.stepFrames(2);
  const farCursor = await state(harness);
  await harness.keyTap('Enter');
  await harness.stepFrames(6);
  const afterReject = await state(harness);
  evidence.farCursor = farCursor;
  evidence.afterReject = afterReject;
  const rejectOk =
    farCursor.cursorReachable === false &&
    afterReject.unitCol === 2 && afterReject.unitRow === 2 && // did not move
    afterReject.confirmsRejected > 0;

  // Restart.
  await harness.keyTap('KeyP');
  await harness.stepFrames(4);
  await harness.keyTap('KeyK');
  await harness.stepFrames(12);
  const afterRestart = await state(harness);
  evidence.afterRestart = afterRestart;
  const restartOk = afterRestart.unitCol === 2 && afterRestart.unitRow === 4 && afterRestart.confirmsRejected === 0;

  const passed = startedOk && aimOk && moveOk && rejectOk && restartOk;
  return { passed, details: { ...evidence, startedOk, aimOk, moveOk, rejectOk, restartOk } };
}
