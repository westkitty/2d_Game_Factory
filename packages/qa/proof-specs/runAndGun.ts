import { readShellState, readSnapshot } from '../src/snapshot.ts';
import type { Harness } from '../src/harness.ts';
import type { SmokeOutcome } from '../src/smokeRunner.ts';

/**
 * Phase 3 proof - run-and-gun (see proofs/run-and-gun/PROOF_CONTRACT.md).
 *
 * The cross-controller consumer of the reusable weapon/projectile layer: a
 * platform preset, the shared `createProjectileRuntime` bridge, hits resolved
 * through `combat.health`, enemy death as a `combat:entityDied` reaction.
 */

interface ShellSnap {
  readonly x: number;
  readonly weaponId: string | null;
  readonly enemiesAlive: number;
  readonly enemyHealth: Readonly<Record<string, number>>;
  readonly projectilesLive: number;
  readonly projectilesSpawned: number;
  readonly projectilesExpired: number;
  readonly hitsResolved: number;
}

function state(harness: Harness): Promise<ShellSnap> {
  return readShellState(harness, 'game.platform-shell');
}

async function stepUntil(harness: Harness, predicate: (s: ShellSnap) => boolean, maxFrames: number): Promise<ShellSnap> {
  for (let i = 0; i < maxFrames; i++) {
    const snap = await state(harness);
    if (predicate(snap)) return snap;
    await harness.stepFrames(2);
  }
  return state(harness);
}

export async function run(harness: Harness): Promise<SmokeOutcome> {
  const evidence: Record<string, unknown> = {};

  await harness.keyTap('Space');
  await harness.stepFrames(20);
  const started = await readSnapshot(harness);
  const initial = await state(harness);
  evidence.initial = initial;
  const startedOk =
    started.scene === 'sw2d.play' &&
    started.installedPacks.includes('sw2d.weapons') &&
    initial.weaponId === 'sidearm' &&
    initial.enemiesAlive === 2 &&
    initial.projectilesSpawned === 0;

  // Close some distance, then face right (moving right sets facing).
  await harness.keyDown('ArrowRight');
  await harness.stepFrames(60);
  await harness.keyUp('ArrowRight');
  await harness.keyDown('ArrowRight');
  await harness.stepFrames(3);
  await harness.keyUp('ArrowRight');

  // Fire until both turrets are down (health 20, damage 10 -> 2 hits each).
  for (let shot = 0; shot < 10; shot++) {
    if ((await state(harness)).enemiesAlive === 0) break;
    await harness.keyTap('KeyX'); // PRIMARY_ACTION
    await harness.stepFrames(28);
  }
  const cleared = await stepUntil(harness, (s) => s.enemiesAlive === 0, 60);
  evidence.cleared = cleared;
  const combatOk =
    cleared.enemiesAlive === 0 &&
    cleared.hitsResolved >= 4 &&
    cleared.projectilesExpired + cleared.projectilesLive === cleared.projectilesSpawned;

  // Pause freezes the projectile field; resume does not immediately re-pause.
  await harness.stepFrames(2);
  await harness.keyTap('KeyX');
  await harness.keyTap('KeyP');
  const pausedFirst = await state(harness);
  await harness.stepFrames(60);
  const pausedSecond = await state(harness);
  const pauseOk = pausedSecond.projectilesLive === pausedFirst.projectilesLive && pausedSecond.x === pausedFirst.x;
  await harness.keyTap('Space'); // CONFIRM resume
  await harness.stepFrames(5);
  const resumed = await readSnapshot(harness);
  const resumeOk = resumed.scene === 'sw2d.play' && resumed.paused === false;

  // Restart genuinely reinstalls: enemies back, projectile counters zeroed.
  await harness.keyTap('KeyP');
  await harness.stepFrames(4);
  await harness.keyTap('KeyK'); // SECONDARY_ACTION -> restart
  await harness.stepFrames(20);
  const afterRestart = await state(harness);
  evidence.afterRestart = afterRestart;
  const restartOk =
    afterRestart.enemiesAlive === 2 &&
    afterRestart.projectilesSpawned === 0 &&
    afterRestart.projectilesLive === 0 &&
    afterRestart.hitsResolved === 0;

  const passed = startedOk && combatOk && pauseOk && resumeOk && restartOk;
  return { passed, details: { ...evidence, startedOk, combatOk, pauseOk, resumeOk, restartOk } };
}
