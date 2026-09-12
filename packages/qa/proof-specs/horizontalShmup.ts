import type { Harness } from '../src/harness.ts';
import { pauseResume, restartRun, shellReader, startPlay, waitUntil } from '../src/journey.ts';
import { readSnapshot } from '../src/snapshot.ts';
import type { SmokeOutcome } from '../src/smokeRunner.ts';

interface Stage {
  readonly active: boolean;
  readonly mode: string | null;
  readonly offset: number;
  readonly progress: number;
  readonly playerX: number;
  readonly playerY: number;
  readonly fireX: number;
  readonly fireY: number;
  readonly outcome: string;
  readonly layers: readonly { readonly id: string; readonly offset: number; readonly speedFactor: number }[];
  readonly currentSpeed: number;
  readonly crossOffset: number;
  readonly railLeg: number;
}
interface Battle {
  readonly projectilesSpawned: number;
  readonly enemiesAlive: number;
  readonly kills: number;
  readonly escaped: number;
  readonly enemies: readonly { readonly id: string; readonly x: number; readonly y: number; readonly archetype: string }[];
}
interface Shell {
  readonly stageScroll?: Stage;
  readonly battle?: Battle;
}

export async function run(harness: Harness): Promise<SmokeOutcome> {
  const read = shellReader<Shell>(harness, 'game.top-down-shell');
  const evidence: Record<string, unknown> = {};
  await startPlay(harness);
  const booted = await readSnapshot(harness);
  const initial = await read();
  evidence.initial = initial.stageScroll;
  const startedOk =
    booted.installedPacks.includes('sw2d.stage-scroll') && booted.installedPacks.includes('sw2d.encounters') &&
    initial.stageScroll?.mode === 'horizontal' && initial.stageScroll.fireX === 1 && initial.stageScroll.fireY === 0 && initial.stageScroll.outcome === 'playing';

  // The stage streams past on its own; the ship moves within its band.
  await harness.stepFrames(10);
  const scrolled = (await read()).stageScroll!;
  const scrollOk = scrolled.offset > initial.stageScroll!.offset;
  await harness.keyDown('ArrowDown');
  await harness.stepFrames(20);
  await harness.keyUp('ArrowDown');
  const moved = (await read()).stageScroll!;
  evidence.moved = { playerY: moved.playerY, from: initial.stageScroll!.playerY, offset: moved.offset };
  const moveOk = moved.playerY > initial.stageScroll!.playerY + 8;

  // Firing spawns projectiles along the stage's fire axis (weapons + encounters underneath).
  await harness.keyTap('KeyJ');
  await harness.stepFrames(6);
  const fired = (await read()).battle!;
  evidence.fired = fired;
  const fireOk = fired.projectilesSpawned >= 1;

  // Pause freezes the scroll.
  const beforePause = (await read()).stageScroll!.offset;
  const paused = await pauseResume(harness);
  const afterPause = (await read()).stageScroll!.offset;
  evidence.pause = { ...paused, beforePause, afterPause };
  const pauseOk = paused.pausedDuring && !paused.pausedAfter && afterPause - beforePause < 40;

  // Parallax planes move at their own factors; the formation sweeps in from the incoming edge.
  const formation = await waitUntil(harness, read, (s) => (s.battle?.enemiesAlive ?? 0) >= 3, 60, 4);
  const layers = formation.stageScroll!.layers;
  evidence.parallax = { layers, enemies: formation.battle?.enemies.length, archetype: formation.battle?.enemies[0]?.archetype };
  const far = layers.find((l) => l.speedFactor < 0.5);
  const near = layers.find((l) => l.speedFactor > 1);
  const parallaxOk = layers.length === 3 && far !== undefined && near !== undefined && far.offset < near.offset && (formation.battle?.enemies[0]?.archetype ?? '') === 'raider';

  // The rail path: the middle leg slows the stage and drifts the camera; the last leg speeds it up.
  const leg2 = await waitUntil(harness, read, (s) => (s.stageScroll?.railLeg ?? -1) >= 1, 120, 6);
  const leg3 = await waitUntil(harness, read, (s) => (s.stageScroll?.railLeg ?? -1) >= 2, 120, 6);
  evidence.rail = { leg2: { leg: leg2.stageScroll?.railLeg, speed: leg2.stageScroll?.currentSpeed, cross: leg2.stageScroll?.crossOffset }, leg3: { leg: leg3.stageScroll?.railLeg, speed: leg3.stageScroll?.currentSpeed, cross: leg3.stageScroll?.crossOffset } };
  const railOk = leg2.stageScroll?.railLeg === 1 && leg2.stageScroll.currentSpeed === 120 && leg3.stageScroll?.railLeg === 2 && leg3.stageScroll.currentSpeed === 220 && Math.abs(leg3.stageScroll.crossOffset) > 20;

  // Survive to stage-clear; formations that flew past count as escaped, not as kills.
  const done = await waitUntil(harness, read, (s) => s.stageScroll?.outcome === 'complete', 90, 8);
  evidence.done = { stage: done.stageScroll, battle: { escaped: done.battle?.escaped, kills: done.battle?.kills } };
  const doneOk = done.stageScroll?.outcome === 'complete' && done.stageScroll.progress >= 1 && done.stageScroll.offset >= 720 && (done.battle?.escaped ?? 0) + (done.battle?.kills ?? 0) >= 3;

  const run = await restartRun(harness);
  const fresh = (await read()).stageScroll!;
  evidence.restart = { ...run, offset: fresh.offset, outcome: fresh.outcome };
  const restartOk = run.after === run.before + 1 && fresh.outcome === 'playing' && fresh.offset < 200;

  const passed = startedOk && scrollOk && moveOk && fireOk && pauseOk && parallaxOk && railOk && doneOk && restartOk;
  return { passed, details: { ...evidence, startedOk, scrollOk, moveOk, fireOk, pauseOk, parallaxOk, railOk, doneOk, restartOk } };
}
