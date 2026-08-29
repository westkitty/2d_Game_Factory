import { readShellState, readSnapshot } from '../src/snapshot.ts';
import type { Harness } from '../src/harness.ts';
import type { SmokeOutcome } from '../src/smokeRunner.ts';

/**
 * Phase 1 proof - gallery-shooter (see proofs/gallery-shooter/PROOF_CONTRACT.md).
 *
 * A real generated game, driven with real mouse events, proving the reusable
 * spatial interaction capability: the world point under the cursor decides
 * which target is hit; an empty-space click hits nothing.
 */

interface ShellSnap {
  readonly hits: number;
  readonly misses: number;
  readonly lastHitId: string | null;
  readonly lastClickWorldX: number;
  readonly lastClickWorldY: number;
  readonly hoveredId: string | null;
  readonly pointerWorldX: number;
  readonly pointerWorldY: number;
  readonly pointerActive: boolean;
  readonly targets: Readonly<Record<string, { alive: boolean }>>;
}

function state(harness: Harness): Promise<ShellSnap> {
  return readShellState(harness, 'game.pointer-shell');
}

/** Dispatch one real PointerEvent at canvas-space (x,y), the same space the runtime maps back to. */
async function pointerAt(harness: Harness, type: 'pointermove' | 'pointerdown' | 'pointerup', x: number, y: number): Promise<void> {
  await harness.page.evaluate((p: { type: string; x: number; y: number }) => {
    const canvas = (window as unknown as { __SW2D__: { phaser: { canvas: HTMLCanvasElement } } }).__SW2D__.phaser.canvas;
    const r = canvas.getBoundingClientRect();
    const clientX = r.left + (p.x / canvas.width) * r.width;
    const clientY = r.top + (p.y / canvas.height) * r.height;
    canvas.dispatchEvent(new PointerEvent(p.type, { clientX, clientY, bubbles: true, button: 0, pointerType: 'mouse' }));
  }, { type, x, y });
}

async function movePointer(harness: Harness, x: number, y: number): Promise<void> {
  await pointerAt(harness, 'pointermove', x, y);
}

async function clickAt(harness: Harness, x: number, y: number): Promise<void> {
  await pointerAt(harness, 'pointermove', x, y);
  await harness.stepFrames(2);
  await pointerAt(harness, 'pointerdown', x, y);
  await harness.stepFrames(2);
  await pointerAt(harness, 'pointerup', x, y);
  await harness.stepFrames(2);
}

export async function run(harness: Harness): Promise<SmokeOutcome> {
  const evidence: Record<string, unknown> = {};

  await harness.keyTap('Space');
  await harness.stepFrames(10);
  const started = await readSnapshot(harness);
  const initial = await state(harness);
  evidence.initial = initial;
  const startedOk =
    started.scene === 'sw2d.play' &&
    initial.hits === 0 &&
    initial.misses === 0 &&
    Object.values(initial.targets).every((t) => t.alive);

  // Hover: the cursor over target-a's world position selects target-a, not another.
  await movePointer(harness, 240, 180);
  await harness.stepFrames(3);
  const hovering = await state(harness);
  evidence.hovering = hovering;
  const hoverOk = hovering.hoveredId === 'target-a' && hovering.pointerWorldX === 240 && hovering.pointerWorldY === 180;

  // Click target-a: the spatially selected target takes the hit.
  await clickAt(harness, 240, 180);
  const afterHitA = await state(harness);
  evidence.afterHitA = afterHitA;
  const hitAOk =
    afterHitA.hits === 1 &&
    afterHitA.lastHitId === 'target-a' &&
    afterHitA.targets['target-a']?.alive === false &&
    afterHitA.targets['target-b']?.alive === true &&
    Math.abs(afterHitA.lastClickWorldX - 240) <= 2;

  // Click empty space: nothing is "magically" selected.
  await clickAt(harness, 900, 500);
  const afterEmpty = await state(harness);
  evidence.afterEmpty = afterEmpty;
  const emptyOk =
    afterEmpty.misses === 1 &&
    afterEmpty.lastHitId === null &&
    afterEmpty.hits === 1 &&
    afterEmpty.targets['target-c']?.alive === true;

  // Click a different target: still resolved by world position.
  await clickAt(harness, 720, 180);
  const afterHitC = await state(harness);
  evidence.afterHitC = afterHitC;
  const hitCOk = afterHitC.hits === 2 && afterHitC.lastHitId === 'target-c' && afterHitC.targets['target-c']?.alive === false;

  // Restart genuinely reinstalls: targets are alive again and hit count is zero.
  await harness.keyTap('KeyP');
  await harness.stepFrames(4);
  await harness.keyTap('KeyK');
  await harness.stepFrames(15);
  const afterRestart = await state(harness);
  evidence.afterRestart = afterRestart;
  const restartOk =
    afterRestart.hits === 0 &&
    afterRestart.misses === 0 &&
    Object.values(afterRestart.targets).every((t) => t.alive);

  const passed = startedOk && hoverOk && hitAOk && emptyOk && hitCOk && restartOk;
  return {
    passed,
    details: { ...evidence, startedOk, hoverOk, hitAOk, emptyOk, hitCOk, restartOk },
  };
}
