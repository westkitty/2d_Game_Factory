import type { Harness } from '../src/harness.ts';
import { holdUntil, restartRun, shellReader, startPlay, waitUntil } from '../src/journey.ts';
import { aimAt } from '../src/shooterJourney.ts';
import { readSnapshot } from '../src/snapshot.ts';
import type { SmokeOutcome } from '../src/smokeRunner.ts';

/**
 * bullet-hell completion journey (matrix L12): the freshly generated top-down
 * shell runs the content boss whose ring / spiral / fan emitters keep
 * hundreds of bullets live through the pooled projectile runtime; shooting
 * the boss below half health enters the frenzy phase; pool reuse is real;
 * restart resets. The real-time budget is measured by qa:bullet-budget.
 */

interface Battle {
  readonly enemiesAlive: number;
  readonly kills: number;
  readonly playerDeaths: number;
  readonly projectilesLive: number;
  readonly projectilesSpawned: number;
  readonly poolAllocated: number;
  readonly poolReused: number;
  readonly encounterPhase: string | null;
  readonly bossHealth: { readonly current: number; readonly max: number } | null;
  readonly outcome: string;
  readonly enemies: readonly { readonly id: string; readonly x: number; readonly y: number; readonly archetype: string }[];
}
interface Shell {
  readonly x: number;
  readonly y: number;
  readonly battle?: Battle;
}

export async function run(harness: Harness): Promise<SmokeOutcome> {
  const read = shellReader<Shell>(harness, 'game.top-down-shell');
  const evidence: Record<string, unknown> = {};
  await startPlay(harness, 6);
  const booted = await readSnapshot(harness);
  const boss = await waitUntil(harness, read, (s) => (s.battle?.enemiesAlive ?? 0) >= 1, 60, 3);
  const startedOk = booted.installedPacks.includes('sw2d.encounters') && boss.battle?.enemies[0]?.archetype === 'boss' && boss.battle.encounterPhase === 'opening';

  // Dense: within a few seconds the boss's patterns keep hundreds of bullets live.
  const dense = await waitUntil(harness, read, (s) => (s.battle?.projectilesLive ?? 0) >= 300, 300, 5);
  evidence.dense = { live: dense.battle?.projectilesLive, spawned: dense.battle?.projectilesSpawned, allocated: dense.battle?.poolAllocated, reused: dense.battle?.poolReused };
  const denseOk = (dense.battle?.projectilesLive ?? 0) >= 300;
  // Pooled: keep going - spawns keep climbing, allocation stops at the peak, reuse takes over.
  await harness.stepFrames(240);
  const pooled = await read();
  evidence.pooled = { live: pooled.battle?.projectilesLive, spawned: pooled.battle?.projectilesSpawned, allocated: pooled.battle?.poolAllocated, reused: pooled.battle?.poolReused };
  const poolOk = (pooled.battle?.poolReused ?? 0) > 0 && (pooled.battle?.poolAllocated ?? 0) <= (pooled.battle?.projectilesLive ?? 0) + 200 && (pooled.battle?.projectilesSpawned ?? 0) > (pooled.battle?.poolAllocated ?? 0) * 2;

  // Fight: walk up in range, aim at the boss and hold fire until the frenzy phase (boss under half).
  await holdUntil(harness, ['ArrowUp'], read, (s) => s.y <= 380, 40, 4);
  await holdUntil(harness, ['ArrowRight'], read, (s) => s.x >= 400, 60, 4);
  const b = (await read()).battle?.enemies[0];
  if (b) await aimAt(harness, { x: b.x, y: b.y });
  await harness.keyDown('KeyJ');
  const frenzy = await waitUntil(harness, read, (s) => s.battle?.encounterPhase === 'frenzy', 600, 4);
  await harness.keyUp('KeyJ');
  evidence.frenzy = { phase: frenzy.battle?.encounterPhase, boss: frenzy.battle?.bossHealth, deaths: frenzy.battle?.playerDeaths, live: frenzy.battle?.projectilesLive };
  const frenzyOk = frenzy.battle?.encounterPhase === 'frenzy';

  const restart = await restartRun(harness);
  const fresh = await read();
  evidence.restart = { ...restart, live: fresh.battle?.projectilesLive, phase: fresh.battle?.encounterPhase, spawned: fresh.battle?.projectilesSpawned };
  const restartOk = restart.after === restart.before + 1 && (fresh.battle?.projectilesSpawned ?? 1) < 50 && fresh.battle?.outcome === 'playing';

  const passed = startedOk && denseOk && poolOk && frenzyOk && restartOk;
  return { passed, details: { ...evidence, startedOk, denseOk, poolOk, frenzyOk, restartOk } };
}
