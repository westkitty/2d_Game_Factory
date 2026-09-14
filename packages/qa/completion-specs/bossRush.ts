import type { Harness } from '../src/harness.ts';
import { holdUntil, restartRun, shellReader, startPlay, waitUntil } from '../src/journey.ts';
import { aimAt } from '../src/shooterJourney.ts';
import { readSnapshot } from '../src/snapshot.ts';
import type { SmokeOutcome } from '../src/smokeRunner.ts';

/**
 * boss-rush completion journey (matrix L10): the freshly generated top-down
 * shell runs the encounter catalog's boss `sequence` - three bosses with
 * their own patterns, a readable transition between them, per-boss health
 * on the HUD, final completion, and a restart that starts again at boss 1.
 */

interface Battle {
  readonly enemiesAlive: number;
  readonly kills: number;
  readonly playerDeaths: number;
  readonly sequenceIndex: number;
  readonly sequenceLength: number;
  readonly bossesDefeated: number;
  readonly transitionMsLeft: number;
  readonly bossHealth: { readonly current: number; readonly max: number } | null;
  readonly outcome: string;
  readonly over: boolean;
  readonly encounterPhase: string | null;
  readonly enemies: readonly { readonly id: string; readonly x: number; readonly y: number; readonly vx: number; readonly vy: number; readonly archetype: string }[];
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
  const first = await waitUntil(harness, read, (s) => (s.battle?.enemiesAlive ?? 0) >= 1, 60, 3);
  evidence.first = { ...first.battle, enemies: first.battle?.enemies };
  const startedOk =
    booted.installedPacks.includes('sw2d.encounters') && first.battle?.sequenceLength === 3 && first.battle.sequenceIndex === 0 && first.battle.enemies[0]?.archetype === 'boss' && (first.battle.bossHealth?.max ?? 0) === 60;

  // Walk into range and hold fire at the boss (pointer aim); a transition separates the bosses.
  await holdUntil(harness, ['ArrowUp'], read, (s) => s.y <= 380, 40, 4);
  await holdUntil(harness, ['ArrowRight'], read, (s) => s.x >= 300, 60, 4);
  await harness.keyDown('KeyJ');
  let state = await read();
  let transition: Shell | null = null;
  let second: Shell | null = null;
  for (let step = 0; step < 900 && state.battle?.outcome === 'playing'; step++) {
    const boss = state.battle?.enemies[0];
    if (boss) await aimAt(harness, { x: boss.x, y: boss.y });
    await harness.stepFrames(3);
    state = await read();
    if (!transition && (state.battle?.transitionMsLeft ?? 0) > 0) transition = state;
    if (!second && state.battle?.sequenceIndex === 1 && (state.battle.enemiesAlive ?? 0) >= 1) second = state;
  }
  await harness.keyUp('KeyJ');
  evidence.transition = transition?.battle ? { bossesDefeated: transition.battle.bossesDefeated, transitionMsLeft: transition.battle.transitionMsLeft, alive: transition.battle.enemiesAlive } : null;
  evidence.second = second?.battle ? { index: second.battle.sequenceIndex, bossHealth: second.battle.bossHealth } : null;
  evidence.done = { ...state.battle, enemies: state.battle?.enemies.length };
  const transitionOk = transition?.battle?.bossesDefeated === 1 && (transition.battle.transitionMsLeft ?? 0) > 0 && transition.battle.enemiesAlive === 0;
  const secondOk = second?.battle?.sequenceIndex === 1 && (second.battle.bossHealth?.max ?? 0) === 90;
  const doneOk = state.battle?.outcome === 'complete' && state.battle.bossesDefeated === 3 && state.battle.over === true;

  const restart = await restartRun(harness);
  const fresh = await waitUntil(harness, read, (s) => (s.battle?.enemiesAlive ?? 0) >= 1, 60, 3);
  evidence.restart = { ...restart, index: fresh.battle?.sequenceIndex, defeated: fresh.battle?.bossesDefeated, outcome: fresh.battle?.outcome };
  const restartOk = restart.after === restart.before + 1 && fresh.battle?.sequenceIndex === 0 && fresh.battle.bossesDefeated === 0 && fresh.battle.outcome === 'playing';

  const passed = startedOk && transitionOk && secondOk && doneOk && restartOk;
  return { passed, details: { ...evidence, startedOk, transitionOk, secondOk, doneOk, restartOk } };
}
