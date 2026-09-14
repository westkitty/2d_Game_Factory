import type { Harness } from '../src/harness.ts';
import { pauseResume, pointerAt, restartRun, shellReader, startPlay, waitUntil } from '../src/journey.ts';
import { readSnapshot } from '../src/snapshot.ts';
import type { SmokeOutcome } from '../src/smokeRunner.ts';

/**
 * survivor-like defining journey. Category-C Wave 17 survival XP plus the
 * Final Product Completion program's run lifecycle (matrix L06): the
 * encounter loops as escalating waves (sw2d.encounters escalation), the
 * scene is one permadeath run on sw2d.runs - death banks meta currency, K
 * buys an unlock between runs, and the next run starts with the loadout.
 */

interface Progression {
  readonly active: boolean;
  readonly mode: string | null;
  readonly xp: number;
  readonly kills: number;
  readonly unlocked: readonly string[];
  readonly lastResult: string | null;
  readonly outcome: string;
  readonly wave: number;
  readonly runOver: boolean;
  readonly run: {
    readonly index: number;
    readonly phase: string;
    readonly cause: string | null;
    readonly metaEarned: number;
    readonly metaCurrency: number;
    readonly unlocked: readonly string[];
    readonly nextUnlock: string | null;
    readonly loadout: { readonly maxHealthBonus: number };
    readonly loadOutcome: string;
  } | null;
}
interface Battle {
  readonly projectilesSpawned: number;
  readonly enemiesAlive: number;
  readonly kills: number;
  readonly playerDeaths: number;
  readonly wavesCleared: number;
  readonly wave: number;
  readonly enemySpeed: number;
  readonly over: boolean;
  readonly outcome: string;
  readonly encounterPhase: string | null;
  readonly playerHealth: { readonly current: number; readonly max: number } | null;
  readonly enemies: readonly { readonly id: string; readonly x: number; readonly y: number }[];
}
interface Shell {
  readonly x: number;
  readonly y: number;
  readonly progression?: Progression;
  readonly battle?: Battle;
}

/** Twin-stick kiting: aim the pointer at the nearest enemy, hold fire, back away from anything close. */
async function kite(harness: Harness, read: () => Promise<Shell>, until: (s: Shell) => boolean, maxSteps: number): Promise<Shell> {
  const held = new Set<string>();
  const setHeld = async (codes: readonly string[]): Promise<void> => {
    for (const code of [...held]) if (!codes.includes(code)) { await harness.keyUp(code); held.delete(code); }
    for (const code of codes) if (!held.has(code)) { await harness.keyDown(code); held.add(code); }
  };
  await harness.keyDown('KeyJ');
  let state = await read();
  try {
    for (let step = 0; step < maxSteps && !until(state) && !(state.battle?.over ?? false); step++) {
      const me = { x: state.x, y: state.y };
      const nearest = [...(state.battle?.enemies ?? [])].sort((a, b) => Math.hypot(a.x - me.x, a.y - me.y) - Math.hypot(b.x - me.x, b.y - me.y))[0];
      if (nearest) {
        await pointerAt(harness, 'pointermove', Math.max(1, Math.min(959, nearest.x)), Math.max(1, Math.min(539, nearest.y)));
        const dx = me.x - nearest.x;
        const dy = me.y - nearest.y;
        if (Math.hypot(dx, dy) < 120) {
          const codes: string[] = [];
          if (Math.abs(dx) >= Math.abs(dy) * 0.6) codes.push(dx >= 0 ? (me.x < 880 ? 'ArrowRight' : 'ArrowLeft') : me.x > 80 ? 'ArrowLeft' : 'ArrowRight');
          if (Math.abs(dy) >= Math.abs(dx) * 0.6) codes.push(dy >= 0 ? (me.y < 440 ? 'ArrowDown' : 'ArrowUp') : me.y > 80 ? 'ArrowUp' : 'ArrowDown');
          await setHeld(codes);
        } else {
          await setHeld([]);
        }
      }
      await harness.stepFrames(3);
      state = await read();
    }
  } finally {
    await setHeld([]);
    await harness.keyUp('KeyJ');
  }
  return state;
}

export async function run(harness: Harness): Promise<SmokeOutcome> {
  const read = shellReader<Shell>(harness, 'game.top-down-shell');
  const evidence: Record<string, unknown> = {};
  await startPlay(harness, 4);
  const booted = await readSnapshot(harness);
  const initial = await read();
  evidence.initial = { progression: initial.progression, battle: initial.battle };
  const startedOk =
    booted.installedPacks.includes('sw2d.progression') && booted.installedPacks.includes('sw2d.encounters') && booted.installedPacks.includes('sw2d.runs') &&
    initial.progression?.mode === 'survive' && initial.progression.xp === 0 && initial.progression.outcome === 'playing' &&
    initial.progression.run?.index === 1 && initial.progression.run.loadOutcome === 'default' && initial.battle?.wave === 0 && initial.battle.playerHealth?.max === 100 &&
    (initial.battle?.enemiesAlive ?? 0) >= 1;

  // Survival XP ticks on the clock, but slowly: a second in is still far from the surge.
  await harness.stepFrames(62);
  const ticked = (await read()).progression!;
  evidence.ticked = { xp: ticked.xp, last: ticked.lastResult, outcome: ticked.outcome };
  const tickOk = ticked.xp >= 1 && ticked.xp < 6 && ticked.outcome === 'playing';

  // Pause freezes the survival clock.
  const paused = await pauseResume(harness);
  const afterPause = (await read()).progression!;
  const pauseOk = paused.pausedDuring && !paused.pausedAfter && afterPause.xp === ticked.xp;

  // Fight through the first loop: kills credit XP, the surge unlocks, and once both phases clear the
  // same content returns as wave 2 - escalated (more enemies, faster).
  const killed = await kite(harness, read, (s) => (s.progression?.kills ?? 0) >= 1, 200);
  evidence.killed = { progression: killed.progression, battle: killed.battle };
  const killOk = (killed.progression?.kills ?? 0) >= 1 && (killed.battle?.kills ?? 0) >= 1 && (killed.battle?.projectilesSpawned ?? 0) >= 1;
  const surged = await kite(harness, read, (s) => s.progression?.outcome === 'complete', 200);
  evidence.surged = surged.progression;
  const surgeOk = surged.progression?.outcome === 'complete' && surged.progression.unlocked.includes('surge') && surged.progression.xp >= 6;
  const escalated = await kite(harness, read, (s) => (s.battle?.wavesCleared ?? 0) >= 1 && (s.battle?.enemiesAlive ?? 0) >= 1, 900);
  evidence.escalated = { battle: escalated.battle, progression: escalated.progression };
  const escalationOk = escalated.battle?.wavesCleared === 1 && escalated.battle.wave === 1 && escalated.battle.enemySpeed > 60 && escalated.progression?.wave === 1;

  // Permadeath: stop kiting and let the wave close in - the run ends and its result is banked.
  const over = await waitUntil(harness, read, (s) => s.progression?.runOver === true, 600, 6);
  evidence.over = { progression: over.progression, battle: over.battle };
  const overOk =
    over.progression?.runOver === true && over.battle?.outcome === 'failed' && over.battle.playerDeaths === 1 && over.progression.run?.phase === 'ended' && over.progression.run.cause === 'death' &&
    (over.progression.run.metaEarned ?? 0) >= 4 && over.progression.run.nextUnlock === 'sturdy';

  // Between runs: K buys the cheapest unlock.
  await harness.keyTap('KeyK');
  await harness.stepFrames(2);
  const bought = (await read()).progression!;
  evidence.bought = { last: bought.lastResult, run: bought.run };
  const boughtOk = bought.lastResult === 'bought sturdy' && bought.run?.unlocked.includes('sturdy') === true;

  // Run 2 starts with the loadout: +40 max health, fresh XP, wave 0.
  const restart = await restartRun(harness);
  const fresh = await read();
  evidence.restart = { ...restart, progression: fresh.progression, health: fresh.battle?.playerHealth };
  const restartOk =
    restart.after === restart.before + 1 && fresh.progression?.xp === 0 && fresh.progression.kills === 0 && fresh.progression.outcome === 'playing' &&
    fresh.progression.run?.index === 2 && fresh.progression.run.loadOutcome === 'loaded' && fresh.progression.run.loadout.maxHealthBonus === 40 &&
    fresh.battle?.playerHealth?.max === 140 && fresh.battle.wave === 0 && fresh.battle.over === false;

  const passed = startedOk && tickOk && pauseOk && killOk && surgeOk && escalationOk && overOk && boughtOk && restartOk;
  return { passed, details: { ...evidence, startedOk, tickOk, pauseOk, killOk, surgeOk, escalationOk, overOk, boughtOk, restartOk } };
}
