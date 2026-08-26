import { readShellState } from '../src/snapshot.ts';
import type { Harness } from '../src/harness.ts';
import type { SmokeOutcome } from '../src/smokeRunner.ts';

interface ShellSnap {
  readonly x: number;
  readonly y: number;
  readonly onGround: boolean;
  readonly highJumpUnlocked: boolean;
  readonly cleared: boolean;
}

function state(harness: Harness): Promise<ShellSnap> {
  return readShellState(harness, 'game.platform-shell');
}

/**
 * Smoke contract: movement, one ability/unlock flag, a previously-blocked
 * path becomes traversable, objective (the exit) after unlock.
 */
export async function run(harness: Harness): Promise<SmokeOutcome> {
  await harness.keyTap('Space'); // start run
  await harness.stepFrames(30);

  const spawnShell = await state(harness);

  // Walk up to the wall (x~470) and jump against it without the ability - proves the path is blocked.
  await harness.keyDown('ArrowRight');
  for (let i = 0; i < 60 && (await state(harness)).x < 440; i++) {
    await harness.stepFrames(3);
  }
  await harness.keyTap('Space'); // jump, unboosted
  await harness.stepFrames(40); // full arc up and back down
  const blockedShell = await state(harness);
  const pathWasBlocked = blockedShell.y > 300 && !blockedShell.highJumpUnlocked;

  // Retreat all the way back to the powerup near the left edge (x~10), then
  // approach the wall again.
  await harness.keyUp('ArrowRight');
  await harness.keyDown('ArrowLeft');
  for (let i = 0; i < 80 && !(await state(harness)).highJumpUnlocked; i++) {
    await harness.stepFrames(5);
  }
  const unlockedShell = await state(harness);
  const abilityUnlocked = unlockedShell.highJumpUnlocked;
  await harness.keyUp('ArrowLeft');
  await harness.keyDown('ArrowRight');

  // Approach the wall again and jump - this time it should clear it.
  for (let i = 0; i < 60 && (await state(harness)).x < 440; i++) {
    await harness.stepFrames(3);
  }
  await harness.keyTap('Space');
  await harness.stepFrames(20);
  const overWallShell = await state(harness);
  // Blocked peak (unboosted) was ~394; the wall top is 260. 320 is a
  // generous margin below the blocked peak while not depending on this
  // exact frame being the precise apex of the boosted arc.
  const pathNowTraversable = overWallShell.y < 320;

  // Continue to the exit.
  for (let i = 0; i < 80 && !(await state(harness)).cleared; i++) {
    await harness.stepFrames(5);
  }
  await harness.keyUp('ArrowRight');
  const finalShell = await state(harness);

  return {
    passed: pathWasBlocked && abilityUnlocked && pathNowTraversable && finalShell.cleared,
    details: { spawnShell, blockedShell, unlockedShell, overWallShell, finalShell, pathWasBlocked, abilityUnlocked, pathNowTraversable },
  };
}
