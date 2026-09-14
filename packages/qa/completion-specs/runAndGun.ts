import type { Harness } from '../src/harness.ts';
import { holdUntil, restartRun, shellReader, startPlay, waitUntil } from '../src/journey.ts';
import { readSnapshot } from '../src/snapshot.ts';
import type { SmokeOutcome } from '../src/smokeRunner.ts';

/**
 * run-and-gun completion journey (matrix L16): the freshly generated platform
 * shell fights sw2d.encounters waves - `ground` walkers come in under
 * gravity along the strip, a shooter holds and fires; the sidearm kills
 * them; wave 1 clears into wave 2 and the loop restarts; restart resets.
 */

interface Battle {
  readonly weaponId: string | null;
  readonly enemiesAlive: number;
  readonly kills: number;
  readonly playerDeaths: number;
  readonly wavesCleared: number;
  readonly encounterPhase: string | null;
  readonly projectilesSpawned: number;
  readonly enemies: readonly { readonly id: string; readonly x: number; readonly y: number; readonly archetype: string }[];
}
interface Shell {
  readonly x: number;
  readonly y: number;
  readonly onGround: boolean;
  readonly battle?: Battle;
}

export async function run(harness: Harness): Promise<SmokeOutcome> {
  const read = shellReader<Shell>(harness, 'game.platform-shell');
  const evidence: Record<string, unknown> = {};
  await startPlay(harness, 6);
  const booted = await readSnapshot(harness);
  const spawned = await waitUntil(harness, read, (s) => (s.battle?.enemiesAlive ?? 0) >= 1, 80, 4);
  evidence.spawned = { ...spawned.battle, enemies: spawned.battle?.enemies };
  const walker = spawned.battle?.enemies[0];
  const startedOk = booted.installedPacks.includes('sw2d.encounters') && spawned.battle?.weaponId !== null && (spawned.battle?.enemiesAlive ?? 0) >= 1 && spawned.battle?.encounterPhase === 'wave-1' && walker?.archetype === 'walker';

  // Walkers fall to the strip and walk toward the player.
  const grounded = await waitUntil(harness, read, (s) => (s.battle?.enemies[0]?.y ?? 0) >= 440, 80, 4);
  evidence.grounded = grounded.battle?.enemies;
  const groundedOk = (grounded.battle?.enemies[0]?.y ?? 0) >= 440 && (grounded.battle?.enemies[0]?.x ?? 0) < 900;

  // Stand in range facing right and hold fire: wave 1 falls, wave 2's shooter is reached by walking right.
  await holdUntil(harness, ['ArrowRight'], read, (s) => s.x >= 320, 80, 4);
  await harness.keyDown('KeyJ');
  const wave2 = await waitUntil(harness, read, (s) => s.battle?.encounterPhase === 'wave-2', 400, 4);
  evidence.wave2 = { kills: wave2.battle?.kills, phase: wave2.battle?.encounterPhase };
  const wave2Ok = wave2.battle?.encounterPhase === 'wave-2' && (wave2.battle.kills ?? 0) >= 3;
  const shooterLive = await waitUntil(
    harness,
    read,
    (s) => (s.battle?.enemies.some((e) => e.archetype === 'shooter') ?? false) && (s.battle?.projectilesSpawned ?? 0) > 0,
    200,
    4,
  );
  evidence.shooter = {
    enemies: shooterLive.battle?.enemies,
    projectilesSpawned: shooterLive.battle?.projectilesSpawned,
  };
  const shooterOk = (shooterLive.battle?.enemies.some((e) => e.archetype === 'shooter') ?? false) && (shooterLive.battle?.projectilesSpawned ?? 0) > 0;
  const cleared = await waitUntil(harness, read, (s) => (s.battle?.wavesCleared ?? 0) >= 1, 500, 4);
  await harness.keyUp('KeyJ');
  evidence.cleared = { kills: cleared.battle?.kills, waves: cleared.battle?.wavesCleared, deaths: cleared.battle?.playerDeaths };
  const clearedOk = (cleared.battle?.wavesCleared ?? 0) >= 1 && (cleared.battle?.kills ?? 0) >= 6;

  const restart = await restartRun(harness);
  const fresh = await waitUntil(harness, read, (s) => (s.battle?.enemiesAlive ?? 0) >= 1, 80, 4);
  evidence.restart = { ...restart, kills: fresh.battle?.kills, phase: fresh.battle?.encounterPhase };
  const restartOk = restart.after === restart.before + 1 && fresh.battle?.kills === 0 && fresh.battle.encounterPhase === 'wave-1';

  const passed = startedOk && groundedOk && wave2Ok && shooterOk && clearedOk && restartOk;
  return { passed, details: { ...evidence, startedOk, groundedOk, wave2Ok, shooterOk, clearedOk, restartOk } };
}
