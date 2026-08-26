import { readShellState } from '../src/snapshot.ts';
import type { Harness } from '../src/harness.ts';
import type { SmokeOutcome } from '../src/smokeRunner.ts';

interface ShellSnap {
  readonly x: number;
  readonly y: number;
  readonly elapsedMs: number;
  readonly burstCount: number;
  readonly hits: number;
  readonly projectilesLive: number;
  readonly projectilesSpawned: number;
  readonly projectilesExpired: number;
  readonly cleared: boolean;
}

function state(harness: Harness): Promise<ShellSnap> {
  return readShellState(harness, 'game.top-down-shell');
}

/**
 * Smoke contract: movement, deterministic projectile pattern, survival/
 * clear condition, bounded projectile lifecycle, clean restart baseline
 * (the restart half is covered by the shared restart-lifecycle check every
 * demo goes through - see packages/qa/src/runAll.ts).
 */
export async function run(harness: Harness): Promise<SmokeOutcome> {
  await harness.keyTap('Space'); // start run
  await harness.stepFrames(10);

  const spawnShell = await state(harness);

  await harness.keyDown('ArrowRight');
  await harness.stepFrames(15);
  const afterMoveShell = await state(harness);
  await harness.keyUp('ArrowRight');
  const movementProven = afterMoveShell.x > spawnShell.x;

  // Advance well past two burst intervals (2000ms = 120 frames) to observe the pattern.
  await harness.stepFrames(130);
  const afterTwoBurstsShell = await state(harness);
  const deterministicPattern = afterTwoBurstsShell.burstCount >= 2 && afterTwoBurstsShell.projectilesSpawned === afterTwoBurstsShell.burstCount * 8;

  // Advance to well past the survival target (6000ms), sampling liveCount along the way for the bounded-lifecycle check.
  let maxLiveSeen = afterTwoBurstsShell.projectilesLive;
  for (let i = 0; i < 30; i++) {
    await harness.stepFrames(15);
    const sample = await state(harness);
    maxLiveSeen = Math.max(maxLiveSeen, sample.projectilesLive);
  }
  const finalShell = await state(harness);

  const survivalReachable = finalShell.cleared;
  // Bullets live at most ~2.5 bursts' worth at a time (2500ms lifetime / 1000ms cadence) - a generous bound that would fail if projectiles leaked instead of expiring.
  const lifecycleBounded = maxLiveSeen <= 32;

  return {
    passed: movementProven && deterministicPattern && survivalReachable && lifecycleBounded,
    details: {
      spawnShell,
      afterMoveShell,
      afterTwoBurstsShell,
      finalShell,
      maxLiveSeen,
      movementProven,
      deterministicPattern,
      survivalReachable,
      lifecycleBounded,
    },
  };
}
