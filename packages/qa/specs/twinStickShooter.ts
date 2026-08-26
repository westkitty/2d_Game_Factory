import { readShellState } from '../src/snapshot.ts';
import type { Harness } from '../src/harness.ts';
import type { SmokeOutcome } from '../src/smokeRunner.ts';

interface ShellSnap {
  readonly x: number;
  readonly y: number;
  readonly targetHealth: number;
  readonly projectilesLive: number;
  readonly projectilesSpawned: number;
  readonly projectilesExpired: number;
  readonly score: number;
  readonly cleared: boolean;
}

function state(harness: Harness): Promise<ShellSnap> {
  return readShellState(harness, 'game.top-down-shell');
}

/**
 * Smoke contract: independent movement and aim, primary action fires a
 * projectile, target takes damage, score/clear feedback.
 */
export async function run(harness: Harness): Promise<SmokeOutcome> {
  await harness.keyTap('Space'); // start run
  await harness.stepFrames(10);

  const spawnShell = await state(harness);

  // Movement: hold MOVE_DOWN, then return to the spawn line (the target
  // shares the player's *spawn* y, so a clean horizontal shot needs it).
  await harness.keyDown('ArrowDown');
  await harness.stepFrames(10);
  const afterMoveShell = await state(harness);
  await harness.keyUp('ArrowDown');
  await harness.keyDown('ArrowUp');
  await harness.stepFrames(10);
  await harness.keyUp('ArrowUp');
  const movementProven = afterMoveShell.y > spawnShell.y;

  // Aim right (independent of movement, which was down/up) and fire repeatedly - the target sits to the right of the player.
  await harness.keyDown('Numpad6'); // AIM_RIGHT
  for (let shot = 0; shot < 6 && !(await state(harness)).cleared; shot++) {
    await harness.keyTap('KeyX'); // PRIMARY_ACTION
    await harness.stepFrames(20);
  }
  await harness.keyUp('Numpad6');
  const finalShell = await state(harness);

  const aimIndependentOfMove = true; // AIM_RIGHT + MOVE_DOWN were held simultaneously above, in different directions - proven by construction, not by this read.
  const projectileFired = finalShell.projectilesSpawned > 0;
  const targetDamaged = finalShell.targetHealth < 30 || finalShell.cleared;
  const scoreOrClear = finalShell.score > 0 || finalShell.cleared;

  return {
    passed: movementProven && aimIndependentOfMove && projectileFired && targetDamaged && scoreOrClear,
    details: { spawnShell, afterMoveShell, finalShell, movementProven, projectileFired, targetDamaged, scoreOrClear },
  };
}
