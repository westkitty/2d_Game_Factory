import { readShellState, readSnapshot } from '../src/snapshot.ts';
import type { Harness } from '../src/harness.ts';
import type { SmokeOutcome } from '../src/smokeRunner.ts';

interface ShellSnap {
  readonly physicsEnabled: boolean;
  readonly bodyCount: number;
  readonly constraintCount: number;
  readonly shakes: number;
  readonly ballY: readonly number[];
  readonly minBallY: number;
  readonly springLinkDistance: number;
  readonly pointerHoveredId: string | null;
}

const state = (h: Harness): Promise<ShellSnap> => readShellState(h, 'game.pointer-shell');

async function pointerAt(harness: Harness, type: 'pointermove' | 'pointerdown' | 'pointerup', x: number, y: number): Promise<void> {
  await harness.page.evaluate((p: { type: string; x: number; y: number }) => {
    const canvas = (window as unknown as { __SW2D__: { phaser: { canvas: HTMLCanvasElement } } }).__SW2D__.phaser.canvas;
    const r = canvas.getBoundingClientRect();
    const clientX = r.left + (p.x / canvas.width) * r.width;
    const clientY = r.top + (p.y / canvas.height) * r.height;
    canvas.dispatchEvent(new PointerEvent(p.type, { clientX, clientY, bubbles: true, button: 0, pointerType: 'mouse' }));
  }, { type, x, y });
}

/**
 * Proof - physics-toy (see proofs/physics-toy/PROOF_CONTRACT.md).
 *
 * Several real Matter rigid bodies falling and colliding on a static floor,
 * one spring constraint linking two of them, and a Phase-1 spatial-pointer
 * click that shakes the field. Restart brings the body/constraint counts back
 * to a fresh service's - no leak.
 */
export async function run(harness: Harness): Promise<SmokeOutcome> {
  await harness.keyTap('Space');
  await harness.stepFrames(6);

  const initial = await state(harness);
  const startedOk = initial.physicsEnabled === true && initial.bodyCount >= 7 && initial.constraintCount === 1;
  const startBodyCount = initial.bodyCount;

  // Let the bodies fall and settle. Collision holds them above the floor
  // (viewport height 540, floor top ~512).
  await harness.stepFrames(90);
  const settled = await state(harness);
  const collisionOk = settled.ballY.every((y) => y < 516); // never fell through the floor
  const restingOk = settled.ballY.every((y) => y > 200); // fell from ~80 and are now low

  // Spring keeps the first two balls within a bounded distance of each other.
  const springOk = settled.springLinkDistance > 0 && settled.springLinkDistance < 320;

  // Spatial-pointer click shakes the field.
  await pointerAt(harness, 'pointermove', 480, 270);
  await harness.stepFrames(2);
  const hovering = await state(harness);
  await pointerAt(harness, 'pointerdown', 480, 270);
  await harness.stepFrames(2);
  await pointerAt(harness, 'pointerup', 480, 270);
  await harness.stepFrames(3);
  const afterClick = await state(harness);
  const shakeOk = hovering.pointerHoveredId === 'shaker' && afterClick.shakes === 1 && afterClick.minBallY < settled.minBallY;

  // Bodies remain bounded after the shake - nothing escapes the ceiling/floor,
  // and the spring constraint is still there.
  await harness.stepFrames(80);
  const resettled = await state(harness);
  const stableOk = resettled.ballY.every((y) => y > 16 && y < 524) && resettled.constraintCount === 1;

  // Restart: fresh service, same counts, shakes cleared.
  await harness.keyTap('KeyP');
  await harness.stepFrames(4);
  await harness.keyTap('KeyK');
  await harness.stepFrames(10);
  const restarted = await readSnapshot(harness);
  const afterRestart = await state(harness);
  const restartOk =
    restarted.scene === 'sw2d.play' &&
    afterRestart.bodyCount === startBodyCount &&
    afterRestart.constraintCount === 1 &&
    afterRestart.shakes === 0;

  const passed = startedOk && collisionOk && restingOk && springOk && shakeOk && stableOk && restartOk;
  return {
    passed,
    details: { initial, settled, hovering, afterClick, resettled, afterRestart, startedOk, collisionOk, restingOk, springOk, shakeOk, stableOk, restartOk },
  };
}
