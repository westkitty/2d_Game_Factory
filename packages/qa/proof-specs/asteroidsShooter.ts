import type { Harness } from '../src/harness.ts';
import { restartRun, shellReader, startPlay, waitUntil } from '../src/journey.ts';
import { readSnapshot } from '../src/snapshot.ts';
import type { SmokeOutcome } from '../src/smokeRunner.ts';

interface Weapon {
  readonly weaponId: string | null;
  readonly projectilesLive: number;
  readonly projectilesSpawned: number;
}
interface Shell {
  readonly x: number;
  readonly y: number;
  readonly angle: number;
  readonly speed?: number;
  readonly weapon?: Weapon | null;
}

export async function run(harness: Harness): Promise<SmokeOutcome> {
  const read = shellReader<Shell>(harness, 'game.vehicle-shell');
  const evidence: Record<string, unknown> = {};
  await startPlay(harness, 12);
  const booted = await readSnapshot(harness);
  const initial = await read();
  evidence.initial = initial;
  const startedOk = booted.installedPacks.includes('sw2d.weapons') && booted.installedPacks.includes('sw2d.combat') && initial.weapon?.weaponId === 'sidearm' && initial.weapon.projectilesSpawned === 0 && (initial.speed ?? 0) === 0;

  // Steering turns the ship in place; thrust accelerates along the heading; drag brings it back down.
  await harness.keyDown('ArrowLeft');
  await harness.stepFrames(10);
  await harness.keyUp('ArrowLeft');
  const turned = await read();
  const turnOk = turned.angle !== initial.angle && (turned.speed ?? 0) === 0;
  await harness.keyDown('ArrowUp');
  await harness.stepFrames(20);
  const thrust = await read();
  await harness.keyUp('ArrowUp');
  const drift = (await waitUntil(harness, read, (s) => (s.speed ?? 0) < (thrust.speed ?? 0) * 0.5, 60, 4));
  evidence.motion = { turnedAngle: turned.angle, thrustSpeed: thrust.speed, moved: Math.hypot(thrust.x - initial.x, thrust.y - initial.y), driftSpeed: drift.speed };
  const thrustOk = (thrust.speed ?? 0) > 8 && Math.hypot(thrust.x - initial.x, thrust.y - initial.y) > 8;
  const dragOk = (drift.speed ?? 99) < (thrust.speed ?? 0) * 0.5;

  // Fire along the heading through sw2d.weapons; the projectile is live then expires; the cooldown gates spam.
  await harness.keyTap('KeyJ');
  await harness.stepFrames(2);
  const fired = await read();
  for (let i = 0; i < 4; i++) await harness.keyTap('KeyJ');
  const spam = await read();
  const expired = await waitUntil(harness, read, (s) => (s.weapon?.projectilesLive ?? 1) === 0, 80, 5);
  evidence.fire = { fired: fired.weapon, spam: spam.weapon, expired: expired.weapon };
  const fireOk = (fired.weapon?.projectilesSpawned ?? 0) >= 1 && (fired.weapon?.projectilesLive ?? 0) >= 1;
  const cooldownOk = (spam.weapon?.projectilesSpawned ?? 0) < 5;
  const expireOk = expired.weapon?.projectilesLive === 0;

  const run = await restartRun(harness);
  const fresh = await read();
  evidence.restart = { ...run, weapon: fresh.weapon, speed: fresh.speed };
  const restartOk = run.after === run.before + 1 && fresh.weapon?.projectilesSpawned === 0 && (fresh.speed ?? 0) === 0;

  const passed = startedOk && turnOk && thrustOk && dragOk && fireOk && cooldownOk && expireOk && restartOk;
  return { passed, details: { ...evidence, startedOk, turnOk, thrustOk, dragOk, fireOk, cooldownOk, expireOk, restartOk } };
}
