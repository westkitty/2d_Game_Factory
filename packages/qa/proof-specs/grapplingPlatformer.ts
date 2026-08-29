import { readShellState, readSnapshot } from '../src/snapshot.ts';
import type { Harness } from '../src/harness.ts';
import type { SmokeOutcome } from '../src/smokeRunner.ts';

interface ShellSnap {
  readonly physicsEnabled: boolean;
  readonly bodyCount: number;
  readonly constraintCount: number;
  readonly anchorEligible: number;
  readonly playerX: number;
  readonly playerY: number;
  readonly grappleAttached: boolean;
  readonly grappleAnchor: string | null;
  readonly ropeLength: number;
  readonly anchorDistance: number;
  readonly attachEvents: number;
}

const state = (h: Harness): Promise<ShellSnap> => readShellState(h, 'game.platform-shell');

/**
 * Proof - grappling-platformer (see proofs/grappling-platformer/PROOF_CONTRACT.md).
 *
 * The player is a Matter body; the grapple is a real distance constraint to an
 * anchor created through the reusable AdvancedPhysicsService. The swing is
 * Matter solving the constraint - the rope distance stays near its length
 * while the player's position changes.
 */
export async function run(harness: Harness): Promise<SmokeOutcome> {
  await harness.keyTap('Space');
  await harness.stepFrames(25);

  const initial = await state(harness);
  const startedOk =
    initial.physicsEnabled === true && initial.bodyCount >= 3 && initial.constraintCount === 0 && initial.anchorEligible === 2;

  // Move under the left anchor (x ~220).
  let cur = initial;
  for (let i = 0; i < 60 && !(cur.playerX > 170 && cur.playerX < 300); i++) {
    await harness.keyDown('ArrowRight');
    await harness.stepFrames(4);
    cur = await state(harness);
  }
  await harness.keyUp('ArrowRight');
  await harness.stepFrames(4);
  const underAnchor = await state(harness);
  const positionedOk = underAnchor.playerX > 150 && underAnchor.playerX < 360;

  // Attach.
  await harness.keyTap('KeyK'); // SECONDARY_ACTION
  await harness.stepFrames(3);
  const attached = await state(harness);
  const attachOk = attached.grappleAttached === true && attached.grappleAnchor !== null && attached.constraintCount === 1;
  const ropeAtAttach = attached.ropeLength;

  // Swing: the player's position changes while the rope distance stays near its length.
  const yBefore = attached.playerY;
  let maxRopeError = 0;
  let moved = false;
  for (let i = 0; i < 10; i++) {
    await harness.stepFrames(8);
    const s = await state(harness);
    if (Math.abs(s.playerY - yBefore) > 6 || Math.abs(s.playerX - attached.playerX) > 6) moved = true;
    maxRopeError = Math.max(maxRopeError, Math.abs(s.anchorDistance - s.ropeLength));
  }
  const swingOk = moved && maxRopeError <= 80; // constrained, not free fall

  // Detach.
  await harness.keyTap('KeyK');
  await harness.stepFrames(3);
  const detached = await state(harness);
  const detachOk = detached.grappleAttached === false && detached.constraintCount === 0;

  // Re-attach.
  await harness.keyTap('KeyK');
  await harness.stepFrames(3);
  const reattached = await state(harness);
  const reattachOk = reattached.constraintCount === 1 && reattached.attachEvents === 2;

  // Reel in shortens the rope.
  await harness.keyDown('KeyE'); // INTERACT
  await harness.stepFrames(24);
  await harness.keyUp('KeyE');
  await harness.stepFrames(2);
  const reeled = await state(harness);
  const reelOk = reeled.ropeLength < ropeAtAttach;

  // Restart: no constraint survives, bodies back to a fresh service's count.
  await harness.keyTap('KeyP');
  await harness.stepFrames(4);
  await harness.keyTap('KeyK');
  await harness.stepFrames(20);
  const restarted = await readSnapshot(harness);
  const afterRestart = await state(harness);
  const restartOk =
    restarted.scene === 'sw2d.play' &&
    afterRestart.constraintCount === 0 &&
    afterRestart.grappleAttached === false &&
    afterRestart.bodyCount === initial.bodyCount;

  const passed = startedOk && positionedOk && attachOk && swingOk && detachOk && reattachOk && reelOk && restartOk;
  return {
    passed,
    details: { initial, underAnchor, attached, detached, reattached, reeled, afterRestart, maxRopeError, startedOk, positionedOk, attachOk, swingOk, detachOk, reattachOk, reelOk, restartOk },
  };
}
