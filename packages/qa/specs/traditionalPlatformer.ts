import { readShellState } from '../src/snapshot.ts';
import type { Harness } from '../src/harness.ts';
import type { SmokeOutcome } from '../src/smokeRunner.ts';

interface ShellSnap {
  readonly x: number;
  readonly y: number;
  readonly vx: number;
  readonly vy: number;
  readonly onGround: boolean;
  readonly objectivesCollected: number;
  readonly resets: number;
  readonly cleared: boolean;
}

function state(harness: Harness): Promise<ShellSnap> {
  return readShellState(harness, 'game.platform-shell');
}

/**
 * Smoke contract (MASTER_PROJECT.md section 12): platform movement, jump,
 * hazard/reset, collectible/objective, reachable exit.
 *
 * content/levels/main.json (the generator's universal proof level) places
 * a Hazard directly in the walking path at x~450, between the Collectible
 * (x~300) and the Exit (x~900) - a straight walk hits it. This spec proves
 * the reset by walking straight through it once, then proves the reachable
 * exit by walking a second time and jumping over the same hazard, the same
 * two-phase pattern a human playtester would use.
 */
export async function run(harness: Harness): Promise<SmokeOutcome> {
  await harness.keyTap('Space'); // CONFIRM -> start run
  await harness.stepFrames(30); // settle on ground

  const spawnShell = await state(harness);

  // Phase 1: walk straight into the hazard - proves movement, and the reset.
  await harness.keyDown('ArrowRight');
  await harness.stepFrames(10);
  const afterMoveShell = await state(harness);
  await harness.keyTap('Space'); // JUMP, while still moving - proves jump independent of movement
  const afterJumpShell = await state(harness);
  await harness.stepFrames(140); // long enough to walk into the hazard and settle after respawn
  const afterHazardShell = await state(harness);

  // Phase 2: walk again, jumping over the hazard's x-range this time, to
  // reach the exit. The hazard's overlap starts around x~436 (object x:450
  // minus half the player's width); polling in small steps with a generous
  // safety margin (stop well before 436, at 380) is what keeps a single
  // poll step from landing inside the hazard zone before the jump fires.
  for (let i = 0; i < 60 && (await state(harness)).x < 380; i++) {
    await harness.stepFrames(3);
  }
  await harness.keyTap('Space'); // hop over the hazard
  for (let i = 0; i < 80 && !(await state(harness)).cleared; i++) {
    await harness.stepFrames(5);
  }
  await harness.keyUp('ArrowRight');
  const finalShell = await state(harness);

  const movementProven = afterMoveShell.x > spawnShell.x && afterMoveShell.vx > 0;
  const jumpProven = afterJumpShell.vy < 0 || !afterJumpShell.onGround;
  const objectiveProven = finalShell.objectivesCollected >= 1;
  const hazardResetProven = afterHazardShell.resets >= 1;
  const exitProven = finalShell.cleared;

  return {
    passed: movementProven && jumpProven && objectiveProven && hazardResetProven && exitProven,
    details: {
      spawnShell,
      afterMoveShell,
      afterJumpShell,
      afterHazardShell,
      finalShell,
      movementProven,
      jumpProven,
      objectiveProven,
      hazardResetProven,
      exitProven,
    },
  };
}
