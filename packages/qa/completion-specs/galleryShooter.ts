import type { Harness } from '../src/harness.ts';
import { restartRun, shellReader, startPlay, waitUntil } from '../src/journey.ts';
import { aimAt, leadPoint } from '../src/shooterJourney.ts';
import { readSnapshot } from '../src/snapshot.ts';
import type { SmokeOutcome } from '../src/smokeRunner.ts';

/**
 * gallery-shooter completion journey (matrix L15): the freshly generated
 * pointer shell runs authored target rounds - drifting targets in
 * formations, pointer-aimed shots, hit / miss accuracy, score through
 * sw2d.arcade, a time limit, round 1 → round 2 → cleared; restart resets.
 */

interface Enemy {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly vx: number;
  readonly vy: number;
}
interface Battle {
  readonly enemiesAlive: number;
  readonly kills: number;
  readonly score: number;
  readonly hits: number;
  readonly shots: number;
  readonly escaped: number;
  readonly timeLeftMs: number | null;
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
  const initial = await waitUntil(harness, read, (s) => (s.gallery?.battle?.enemiesAlive ?? 0) >= 4, 60, 3);
  const g0 = initial.gallery!;
  evidence.initial = { mode: g0.mode, gun: [g0.gunX, g0.gunY], battle: { ...g0.battle, enemies: g0.battle?.enemies.length } };
  const startedOk =
    booted.installedPacks.includes('sw2d.encounters') && booted.installedPacks.includes('sw2d.arcade') && g0.mode === 'gallery' && (g0.battle?.enemiesAlive ?? 0) >= 4 &&
    g0.battle?.sequenceLength === 2 && g0.battle.timeLeftMs !== null && g0.battle.score === 0;

  // Shoot every target: lead the nearest one, hold fire.
  await harness.keyDown('KeyJ');
  let state = initial;
  let roundOne: Shell | null = null;
  for (let step = 0; step < 700 && state.gallery?.outcome === 'playing'; step++) {
    const b = state.gallery!.battle!;
    const gun = { x: state.gallery!.gunX, y: state.gallery!.gunY };
    const nearest = [...b.enemies].sort((a, c) => Math.hypot(a.x - gun.x, a.y - gun.y) - Math.hypot(c.x - gun.x, c.y - gun.y))[0];
    if (nearest) await aimAt(harness, leadPoint(gun, nearest, SIDEARM_SPEED));
    await harness.stepFrames(3);
    state = await read();
    if (!roundOne && (state.gallery?.battle?.bossesDefeated ?? 0) >= 1) roundOne = state;
  }
  await harness.keyUp('KeyJ');
  const done = state.gallery!;
  evidence.roundOne = roundOne?.gallery?.battle ? { kills: roundOne.gallery.battle.kills, score: roundOne.gallery.battle.score, index: roundOne.gallery.battle.sequenceIndex } : null;
  evidence.done = { ...done.battle, enemies: done.battle?.enemies.length };
  const roundOk = (roundOne?.gallery?.battle?.kills ?? 0) >= 4 && (roundOne?.gallery?.battle?.score ?? 0) >= 40;
  const doneOk =
    done.outcome === 'complete' && done.battle?.bossesDefeated === 2 && (done.battle.kills ?? 0) >= 11 && (done.battle.score ?? 0) >= 120 && (done.battle.hits ?? 0) >= 11 && (done.battle.shots ?? 0) >= (done.battle.hits ?? 0) && (done.battle.timeLeftMs ?? 0) > 0;

  const restart = await restartRun(harness);
  const fresh = await waitUntil(harness, read, (s) => (s.gallery?.battle?.enemiesAlive ?? 0) >= 4, 60, 3);
  evidence.restart = { ...restart, score: fresh.gallery?.battle?.score, kills: fresh.gallery?.battle?.kills, outcome: fresh.gallery?.outcome };
  const restartOk = restart.after === restart.before + 1 && fresh.gallery?.battle?.score === 0 && fresh.gallery.battle.kills === 0 && fresh.gallery.outcome === 'playing';

  const passed = startedOk && roundOk && doneOk && restartOk;
  return { passed, details: { ...evidence, startedOk, roundOk, doneOk, restartOk } };
}
