import type { Harness } from '../src/harness.ts';
import { pointerAt } from '../src/journey.ts';
import { readShellState, readSnapshot } from '../src/snapshot.ts';
import type { SmokeOutcome } from '../src/smokeRunner.ts';

/** Hand-authored Phase 1 proof: hover, click, drag/drop, and restart. */
interface ShellSnap {
  readonly leverHovered: boolean;
  readonly leverPulled: boolean;
  readonly keyInChest: boolean;
  readonly hoveredId: string | null;
  readonly draggingId: string | null;
  readonly keyX: number;
  readonly keyY: number;
}

function state(harness: Harness): Promise<ShellSnap> {
  return readShellState(harness, 'game.pointer-shell');
}

export async function run(harness: Harness): Promise<SmokeOutcome> {
  const evidence: Record<string, unknown> = {};
  await harness.keyTap('Space');
  await harness.stepFrames(10);
  const started = await readSnapshot(harness);
  const initial = await state(harness);
  const startedOk = started.scene === 'sw2d.play' && !initial.leverPulled && !initial.keyInChest;

  await pointerAt(harness, 'pointermove', 200, 270);
  await harness.stepFrames(3);
  const onLever = await state(harness);
  await pointerAt(harness, 'pointermove', 480, 120);
  await harness.stepFrames(3);
  const offLever = await state(harness);
  const hoverOk = onLever.hoveredId === 'lever' && onLever.leverHovered && !offLever.leverHovered && offLever.hoveredId === null;

  await pointerAt(harness, 'pointermove', 200, 270);
  await harness.stepFrames(2);
  await pointerAt(harness, 'pointerdown', 200, 270);
  await harness.stepFrames(2);
  await pointerAt(harness, 'pointerup', 200, 270);
  await harness.stepFrames(2);
  const afterLever = await state(harness);
  const clickOk = afterLever.leverPulled && !afterLever.keyInChest;

  await pointerAt(harness, 'pointermove', 480, 400);
  await harness.stepFrames(2);
  await pointerAt(harness, 'pointerdown', 480, 400);
  await harness.stepFrames(2);
  await pointerAt(harness, 'pointermove', 600, 335);
  await harness.stepFrames(2);
  await pointerAt(harness, 'pointermove', 760, 270);
  await harness.stepFrames(2);
  const midDrag = await state(harness);
  await pointerAt(harness, 'pointerup', 760, 270);
  await harness.stepFrames(3);
  const afterDrop = await state(harness);
  const dragOk = midDrag.draggingId === 'key' && Math.abs(midDrag.keyX - 760) <= 4 && afterDrop.keyInChest && afterDrop.draggingId === null && Math.abs(afterDrop.keyX - 760) <= 4 && Math.abs(afterDrop.keyY - 270) <= 4;

  await harness.keyTap('KeyP');
  await harness.stepFrames(4);
  await harness.keyTap('KeyK');
  await harness.stepFrames(15);
  const afterRestart = await state(harness);
  const restartOk = !afterRestart.leverPulled && !afterRestart.keyInChest && Math.abs(afterRestart.keyX - 480) <= 4 && Math.abs(afterRestart.keyY - 400) <= 4;

  evidence.initial = initial;
  evidence.onLever = onLever;
  evidence.offLever = offLever;
  evidence.afterLever = afterLever;
  evidence.midDrag = midDrag;
  evidence.afterDrop = afterDrop;
  evidence.afterRestart = afterRestart;
  const passed = startedOk && hoverOk && clickOk && dragOk && restartOk;
  return { passed, details: { ...evidence, startedOk, hoverOk, clickOk, dragOk, restartOk } };
}
