import type { Harness } from '../src/harness.ts';
import { restartRun, shellReader, startPlay, waitUntil } from '../src/journey.ts';
import { readSnapshot } from '../src/snapshot.ts';
import type { SmokeOutcome } from '../src/smokeRunner.ts';

/**
 * asteroids-shooter defining journey (Final Product Completion Wave 3, matrix
 * L13 / L14): the ship is the sw2d.vehicles `ship` profile (rotational
 * inertia - it keeps spinning after the key lifts; momentum - it keeps
 * moving after the throttle lifts; wrap-around), and the generated vehicle
 * shell runs the rock field: drifting, wrapping rocks; shots split large
 * rocks and score; ramming a rock costs a life; three losses end the run;
 * restart brings the field back.
 */

interface VehicleState {
  readonly x: number;
  readonly y: number;
  readonly heading: number;
  readonly speed: number;
  readonly angularVelocity: number;
  readonly wraps: number;
}
interface Asteroids {
  readonly mode: string | null;
  readonly wave: number;
  readonly rocks: number;
  readonly rocksBySize: { readonly large: number; readonly medium: number; readonly small: number };
  readonly score: number;
  readonly lives: number;
  readonly destroyed: number;
  readonly splits: number;
  readonly wraps: number;
  readonly projectilesSpawned: number;
  readonly invulnerableMsLeft: number;
  readonly lastResult: string | null;
  readonly outcome: string;
}
interface Shell {
  readonly x: number;
  readonly y: number;
  readonly angle: number;
  readonly vehicle?: VehicleState;
  readonly asteroids?: Asteroids;
}

export async function run(harness: Harness): Promise<SmokeOutcome> {
  const read = shellReader<Shell>(harness, 'game.vehicle-shell');
  const evidence: Record<string, unknown> = {};
  await startPlay(harness, 12);
  const booted = await readSnapshot(harness);
  const initial = await read();
  evidence.initial = { vehicle: initial.vehicle, asteroids: initial.asteroids };
  const startedOk =
    booted.installedPacks.includes('sw2d.vehicles') && booted.installedPacks.includes('sw2d.arcade') && initial.asteroids?.mode === 'field' && initial.asteroids.wave === 1 && initial.asteroids.rocksBySize.large === 4 && initial.asteroids.lives === 3 && initial.asteroids.score === 0 && (initial.vehicle?.speed ?? 1) === 0;

  // Rotational inertia: a tap keeps the ship turning after the key lifts, then damping settles it.
  await harness.keyDown('ArrowRight');
  await harness.stepFrames(8);
  await harness.keyUp('ArrowRight');
  const spinning = await read();
  await harness.stepFrames(10);
  const stillTurning = await read();
  const settled = await waitUntil(harness, read, (s) => Math.abs(s.vehicle?.angularVelocity ?? 1) < 0.05, 120, 4);
  evidence.inertia = { spinning: spinning.vehicle?.angularVelocity, later: stillTurning.vehicle, settled: settled.vehicle?.angularVelocity };
  const inertiaOk = (spinning.vehicle?.angularVelocity ?? 0) > 0.5 && (stillTurning.vehicle?.angularVelocity ?? 0) > 0.1 && (stillTurning.vehicle?.heading ?? 0) > (spinning.vehicle?.heading ?? 0) && Math.abs(settled.vehicle?.angularVelocity ?? 1) < 0.05;

  // Momentum: thrust, release, keep drifting; drag bleeds it down slowly.
  await harness.keyDown('ArrowUp');
  await harness.stepFrames(30);
  await harness.keyUp('ArrowUp');
  const thrust = await read();
  await harness.stepFrames(30);
  const coasting = await read();
  evidence.momentum = { thrustSpeed: thrust.vehicle?.speed, coastingSpeed: coasting.vehicle?.speed, moved: Math.hypot((coasting.vehicle?.x ?? 0) - (thrust.vehicle?.x ?? 0), (coasting.vehicle?.y ?? 0) - (thrust.vehicle?.y ?? 0)) };
  const momentumOk = (thrust.vehicle?.speed ?? 0) > 60 && (coasting.vehicle?.speed ?? 0) > (thrust.vehicle?.speed ?? 0) * 0.5 && (coasting.vehicle?.speed ?? 0) < (thrust.vehicle?.speed ?? 0);

  // Wrap: keep thrusting until the ship crosses an edge and reappears on the other side.
  await harness.keyDown('ArrowUp');
  const wrapped = await waitUntil(harness, read, (s) => (s.vehicle?.wraps ?? 0) >= 1, 200, 4);
  await harness.keyUp('ArrowUp');
  evidence.wrap = { wraps: wrapped.vehicle?.wraps, x: wrapped.vehicle?.x, y: wrapped.vehicle?.y };
  const wrapOk = (wrapped.vehicle?.wraps ?? 0) >= 1 && (wrapped.vehicle?.x ?? -1) >= -30 && (wrapped.vehicle?.x ?? 9999) <= 990;

  // Shoot: spin slowly and hold fire until a large rock splits; the field wraps rocks too.
  await harness.keyDown('KeyJ');
  await harness.keyDown('ArrowLeft');
  await harness.stepFrames(6);
  await harness.keyUp('ArrowLeft');
  const split = await waitUntil(harness, read, (s) => (s.asteroids?.splits ?? 0) >= 1 || s.asteroids?.outcome !== 'playing', 400, 4);
  await harness.keyUp('KeyJ');
  evidence.split = split.asteroids;
  const splitOk = (split.asteroids?.splits ?? 0) >= 1 && (split.asteroids?.destroyed ?? 0) >= 1 && (split.asteroids?.score ?? 0) >= 20 && (split.asteroids?.rocksBySize.medium ?? 0) >= 2 && (split.asteroids?.projectilesSpawned ?? 0) >= 1 && (split.asteroids?.wraps ?? 0) >= 1;

  // Collision: thrusting around the field costs lives; the third loss ends the run.
  await harness.keyDown('ArrowUp');
  await harness.keyDown('ArrowRight');
  const hit = await waitUntil(harness, read, (s) => (s.asteroids?.lives ?? 3) < 3 || s.asteroids?.outcome !== 'playing', 400, 4);
  const lost = await waitUntil(harness, read, (s) => s.asteroids?.outcome !== 'playing', 900, 6);
  await harness.keyUp('ArrowRight');
  await harness.keyUp('ArrowUp');
  evidence.lives = { hit: { lives: hit.asteroids?.lives, grace: hit.asteroids?.invulnerableMsLeft, last: hit.asteroids?.lastResult }, lost: { lives: lost.asteroids?.lives, outcome: lost.asteroids?.outcome, last: lost.asteroids?.lastResult } };
  const livesOk = (hit.asteroids?.lives ?? 3) < 3 && lost.asteroids?.outcome === 'failed' && lost.asteroids.lives === 0 && (lost.asteroids.lastResult ?? '') === 'ship lost';

  const restart = await restartRun(harness);
  const fresh = await read();
  evidence.restart = { ...restart, asteroids: fresh.asteroids };
  const restartOk = restart.after === restart.before + 1 && fresh.asteroids?.outcome === 'playing' && fresh.asteroids.lives === 3 && fresh.asteroids.score === 0 && fresh.asteroids.rocksBySize.large === 4;

  const passed = startedOk && inertiaOk && momentumOk && wrapOk && splitOk && livesOk && restartOk;
  return { passed, details: { ...evidence, startedOk, inertiaOk, momentumOk, wrapOk, splitOk, livesOk, restartOk } };
}
