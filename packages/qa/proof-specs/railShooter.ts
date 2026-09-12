import type { Harness } from '../src/harness.ts';
import { restartRun, shellReader, startPlay, waitUntil } from '../src/journey.ts';
import { aimAt, leadPoint } from '../src/shooterJourney.ts';
import { readSnapshot } from '../src/snapshot.ts';
import type { SmokeOutcome } from '../src/smokeRunner.ts';

/**
 * rail-shooter defining journey (Final Product Completion Wave 3, matrix
 * L17): the gun rides the sw2d.camera rail (the scroll advances), fires the
 * sw2d.weapons catalog weapon at sw2d.encounters `approach` drones, scores
 * through sw2d.arcade, and clears both legs of the rail; restart resets.
 */

interface Enemy {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly vx: number;
  readonly vy: number;
}
interface Battle {
  readonly weaponId: string | null;
  readonly enemiesAlive: number;
  readonly kills: number;
  readonly score: number;
  readonly hits: number;
  readonly shots: number;
  readonly escaped: number;
  readonly projectilesSpawned: number;
  readonly sequenceIndex: number;
  readonly sequenceLength: number;
  readonly bossesDefeated: number;
  readonly outcome: string;
  readonly enemies: readonly Enemy[];
}
interface Gallery {
  readonly mode: string | null;
  readonly gunX: number;
  readonly gunY: number;
  readonly railProgress: number;
  readonly scrollX: number;
  readonly scrollY: number;
  readonly battle: Battle | null;
  readonly outcome: string;
}
interface Shell {
  readonly gallery?: Gallery;
}

const SIDEARM_SPEED = 460;

export async function run(harness: Harness): Promise<SmokeOutcome> {
  const read = shellReader<Shell>(harness, 'game.pointer-shell');
  const evidence: Record<string, unknown> = {};
  await startPlay(harness, 6);
  const booted = await readSnapshot(harness);
  const initial = await waitUntil(harness, read, (s) => (s.gallery?.battle?.enemiesAlive ?? 0) >= 1, 60, 3);
  const g0 = initial.gallery!;
  evidence.initial = { mode: g0.mode, gun: [g0.gunX, g0.gunY], scroll: [g0.scrollX, g0.scrollY], progress: g0.railProgress, weapon: g0.battle?.weaponId, alive: g0.battle?.enemiesAlive };
  const startedOk =
    booted.installedPacks.includes('sw2d.camera') && booted.installedPacks.includes('sw2d.weapons') && booted.installedPacks.includes('sw2d.encounters') && g0.mode === 'rail' && g0.battle?.weaponId !== null && (g0.battle?.enemiesAlive ?? 0) >= 1 && g0.battle?.sequenceLength === 2;

  // Ride the rail and shoot the approaching drones (lead the nearest, hold fire).
  await harness.keyDown('KeyJ');
  let state = initial;
  let rode: Shell | null = null;
  for (let step = 0; step < 700 && state.gallery?.outcome === 'playing'; step++) {
    const g = state.gallery!;
    const gun = { x: g.gunX, y: g.gunY };
    const nearest = [...g.battle!.enemies].sort((a, c) => Math.hypot(a.x - gun.x, a.y - gun.y) - Math.hypot(c.x - gun.x, c.y - gun.y))[0];
    if (nearest) await aimAt(harness, leadPoint(gun, nearest, SIDEARM_SPEED), { x: g.scrollX, y: g.scrollY });
    await harness.stepFrames(3);
    state = await read();
    if (!rode && (state.gallery?.railProgress ?? 0) > 0.3) rode = state;
  }
  await harness.keyUp('KeyJ');
  const done = state.gallery!;
  evidence.rode = rode ? { progress: rode.gallery?.railProgress, scrollX: rode.gallery?.scrollX, gunX: rode.gallery?.gunX } : null;
  evidence.done = { progress: done.railProgress, scroll: [done.scrollX, done.scrollY], battle: { ...done.battle, enemies: done.battle?.enemies.length } };
  const rodeOk = (rode?.gallery?.scrollX ?? -999) > g0.scrollX + 150 && (rode?.gallery?.gunX ?? 0) > g0.gunX + 150;
  const doneOk =
    done.outcome === 'complete' && done.battle?.bossesDefeated === 2 && (done.battle.kills ?? 0) >= 9 && (done.battle.score ?? 0) >= 45 && (done.battle.projectilesSpawned ?? 0) >= 9 && (done.battle.hits ?? 0) >= 9;

  const restart = await restartRun(harness);
  const fresh = await read();
  evidence.restart = { ...restart, progress: fresh.gallery?.railProgress, score: fresh.gallery?.battle?.score, outcome: fresh.gallery?.outcome };
  const restartOk = restart.after === restart.before + 1 && (fresh.gallery?.railProgress ?? 1) < 0.1 && fresh.gallery?.battle?.score === 0 && fresh.gallery.outcome === 'playing';

  const passed = startedOk && rodeOk && doneOk && restartOk;
  return { passed, details: { ...evidence, startedOk, rodeOk, doneOk, restartOk } };
}
