import type { Harness } from '../src/harness.ts';
import { pointerAt, restartRun, shellReader, startPlay, waitUntil } from '../src/journey.ts';
import { readSnapshot } from '../src/snapshot.ts';
import type { SmokeOutcome } from '../src/smokeRunner.ts';

interface Command {
  readonly active: boolean;
  readonly mode: string | null;
  readonly selected: boolean;
  readonly selectedCount: number;
  readonly unitX: number;
  readonly unitY: number;
  readonly unit2X: number;
  readonly unit2Y: number;
  readonly owned: number;
  readonly lastResult: string | null;
  readonly outcome: string;
}
interface Shell {
  readonly command?: Command;
}

async function dragBox(harness: Harness, x0: number, y0: number, x1: number, y1: number): Promise<void> {
  await pointerAt(harness, 'pointermove', x0, y0);
  await harness.stepFrames(2);
  await pointerAt(harness, 'pointerdown', x0, y0);
  await harness.stepFrames(4);
  await pointerAt(harness, 'pointermove', x1, y1);
  await harness.stepFrames(6);
  await pointerAt(harness, 'pointerup', x1, y1);
  await harness.stepFrames(6);
}

export async function run(harness: Harness): Promise<SmokeOutcome> {
  const read = shellReader<Shell>(harness, 'game.top-down-shell');
  const c = async () => (await read()).command!;
  const evidence: Record<string, unknown> = {};
  await startPlay(harness, 12);
  const booted = await readSnapshot(harness);
  const initial = await c();
  evidence.initial = initial;
  const startedOk = booted.installedPacks.includes('sw2d.strategy') && booted.installedPacks.includes('sw2d.territory') && initial.mode === 'rts' && !initial.selected && initial.selectedCount === 0 && initial.outcome === 'playing';

  // Nothing selected: movement orders go nowhere.
  await harness.keyDown('ArrowRight');
  await harness.stepFrames(12);
  await harness.keyUp('ArrowRight');
  const idle = await c();
  const idleOk = idle.unitX === initial.unitX && idle.unit2X === initial.unit2X;

  // PRIMARY selects one unit; ordering it right moves only that unit.
  await harness.keyTap('KeyJ');
  await harness.stepFrames(4);
  const one = await c();
  await harness.keyDown('ArrowRight');
  await harness.stepFrames(12);
  await harness.keyUp('ArrowRight');
  const oneMoved = await c();
  evidence.one = { selected: one.selected, count: one.selectedCount, last: one.lastResult, unitX: oneMoved.unitX, unit2X: oneMoved.unit2X };
  const oneOk = one.selected && one.selectedCount === 1 && one.lastResult === 'selected' && oneMoved.unitX > initial.unitX && oneMoved.unit2X === initial.unit2X;

  // Restart, then box-select both units with a pointer drag and march them to the objective.
  const run = await restartRun(harness);
  const fresh = await c();
  const restartOk = run.after === run.before + 1 && !fresh.selected && fresh.unitX === initial.unitX && fresh.outcome === 'playing';
  await dragBox(harness, 160, 230, 250, 430);
  const boxed = await c();
  evidence.boxed = boxed;
  const boxOk = boxed.lastResult === 'boxed' && boxed.selectedCount === 2 && boxed.selected;
  await harness.keyDown('ArrowRight');
  const done = await waitUntil(harness, read, (s) => s.command?.outcome === 'complete', 160, 4);
  await harness.keyUp('ArrowRight');
  await harness.stepFrames(4);
  const final = await c();
  evidence.done = final;
  const doneOk = done.command?.outcome === 'complete' && final.lastResult === 'seized' && final.unitX >= 780 && final.unit2X >= 780;

  const passed = startedOk && idleOk && oneOk && restartOk && boxOk && doneOk;
  return { passed, details: { ...evidence, startedOk, idleOk, oneOk, restartOk, boxOk, doneOk } };
}
