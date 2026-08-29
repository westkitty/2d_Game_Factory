import { readShellState, readSnapshot } from '../src/snapshot.ts';
import type { Harness } from '../src/harness.ts';
import type { SmokeOutcome } from '../src/smokeRunner.ts';

/**
 * Phase 1 proof - point-and-click (see proofs/point-and-click/PROOF_CONTRACT.md).
 *
 * Real generated game, real mouse events: hover enter/leave tracks the cursor,
 * a click pulls a lever, and a key is dragged onto a chest drop-zone - all
 * through the reusable interaction service.
 */

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

async function pointerAt(harness: Harness, type: 'pointermove' | 'pointerdown' | 'pointerup', x: number, y: number): Promise<void> {
  await harness.page.evaluate((p: { type: string; x: number; y: number }) => {
    const canvas = (window as unknown as { __SW2D__: { phaser: { canvas: HTMLCanvasElement } } }).__SW2D__.phaser.canvas;
    const r = canvas.getBoundingClientRect();
    const clientX = r.left + (p.x / canvas.width) * r.width;
    const clientY = r.top + (p.y / canvas.height) * r.height;
    canvas.dispatchEvent(new PointerEvent(p.type, { clientX, clientY, bubbles: true, button: 0, pointerType: 'mouse' }));
  }, { type, x, y });
}

export async function run(harness: Harness): Promise<SmokeOutcome> {
  const evidence: Record<string, unknown> = {};

  await harness.keyTap('Space');
  await harness.stepFrames(10);
  const started = await readSnapshot(harness);
  const initial = await state(harness);
  evidence.initial = initial;
  const startedOk = started.scene === 'sw2d.play' && !initial.leverPulled && !initial.keyInChest;

  // Hover enter / leave.
  await pointerAt(harness, 'pointermove', 200, 270);
  await harness.stepFrames(3);
  const onLever = await state(harness);
  await pointerAt(harness, 'pointermove', 480, 120);
  await harness.stepFrames(3);
  const offLever = await state(harness);
  evidence.onLever = onLever;
  evidence.offLever = offLever;
  const hoverOk = onLever.hoveredId === 'lever' && onLever.leverHovered && !offLever.leverHovered && offLever.hoveredId === null;

  // Click the lever.
  await pointerAt(harness, 'pointermove', 200, 270);
  await harness.stepFrames(2);
  await pointerAt(harness, 'pointerdown', 200, 270);
  await harness.stepFrames(2);
  await pointerAt(harness, 'pointerup', 200, 270);
  await harness.stepFrames(2);
  const afterLever = await state(harness);
  evidence.afterLever = afterLever;
  const clickOk = afterLever.leverPulled === true && afterLever.keyInChest === false;

  // Drag the key onto the chest.
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
  evidence.midDrag = midDrag;
  evidence.afterDrop = afterDrop;
  const dragOk =
    midDrag.draggingId === 'key' &&
    Math.abs(midDrag.keyX - 760) <= 4 &&
    afterDrop.keyInChest === true &&
    afterDrop.draggingId === null &&
    Math.abs(afterDrop.keyX - 760) <= 4 &&
    Math.abs(afterDrop.keyY - 270) <= 4;

  // Restart genuinely reinstalls.
  await harness.keyTap('KeyP');
  await harness.stepFrames(4);
  await harness.keyTap('KeyK');
  await harness.stepFrames(15);
  const afterRestart = await state(harness);
  evidence.afterRestart = afterRestart;
  const restartOk =
    !afterRestart.leverPulled &&
    !afterRestart.keyInChest &&
    Math.abs(afterRestart.keyX - 480) <= 4 &&
    Math.abs(afterRestart.keyY - 400) <= 4;

  const passed = startedOk && hoverOk && clickOk && dragOk && restartOk;
  return { passed, details: { ...evidence, startedOk, hoverOk, clickOk, dragOk, restartOk } };
}
