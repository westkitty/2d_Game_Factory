import type { Harness } from '../src/harness.ts';
import { holdUntil, pointerAt, restartRun, shellReader, startPlay, waitUntil } from '../src/journey.ts';
import { readSnapshot } from '../src/snapshot.ts';
import type { SmokeOutcome } from '../src/smokeRunner.ts';

/**
 * twin-stick-shooter completion journey (matrix L05): a freshly generated
 * twin-stick shooter fights real waves out of the box - sw2d.encounters is
 * required, so content/encounters.json spawns chasing grunts, the sidearm
 * kills them, wave 1 clears into wave 2 (shooters), and a restart resets.
 */

interface Battle {
  readonly weaponId: string | null;
  readonly projectilesSpawned: number;
  readonly enemiesAlive: number;
  readonly kills: number;
  readonly playerDeaths: number;
  readonly wavesCleared: number;
  readonly encounterPhase: string | null;
  readonly playerHealth: { readonly current: number; readonly max: number } | null;
  readonly enemies: readonly { readonly id: string; readonly x: number; readonly y: number }[];
}
interface Shell {
  readonly x: number;
  readonly y: number;
  readonly battle?: Battle;
}

export async function run(harness: Harness): Promise<SmokeOutcome> {
  const read = shellReader<Shell>(harness, 'game.top-down-shell');
  const evidence: Record<string, unknown> = {};
  await startPlay(harness, 4);
  const booted = await readSnapshot(harness);
  const spawned = await waitUntil(harness, read, (s) => (s.battle?.enemiesAlive ?? 0) >= 1, 60, 4);
  evidence.spawned = spawned.battle;
  const startedOk =
    booted.installedPacks.includes('sw2d.encounters') && booted.installedPacks.includes('sw2d.weapons') && (spawned.battle?.enemiesAlive ?? 0) >= 1 && spawned.battle?.encounterPhase === 'wave-1' && spawned.battle.weaponId !== null;

  // Twin-stick play: walk out of the corner to the middle, then kite - the pointer aims (no digital
  // aim held) at the nearest grunt while fire is held, and the player backs away from anything close.
  await holdUntil(harness, ['ArrowRight'], read, (s) => s.x >= 470, 80, 3);
  await holdUntil(harness, ['ArrowUp'], read, (s) => s.y <= 280, 80, 3);
  await harness.keyDown('KeyJ');
  let state = await read();
  let killed: Shell | null = null;
  const held = new Set<string>();
  const setHeld = async (codes: readonly string[]): Promise<void> => {
    for (const code of [...held]) if (!codes.includes(code)) { await harness.keyUp(code); held.delete(code); }
    for (const code of codes) if (!held.has(code)) { await harness.keyDown(code); held.add(code); }
  };
  for (let step = 0; step < 260 && state.battle?.encounterPhase === 'wave-1' && (state.battle.wavesCleared ?? 0) === 0; step++) {
    const me = { x: state.x, y: state.y };
    const nearest = [...(state.battle?.enemies ?? [])].sort((a, b) => Math.hypot(a.x - me.x, a.y - me.y) - Math.hypot(b.x - me.x, b.y - me.y))[0];
    if (nearest) {
      await pointerAt(harness, 'pointermove', Math.max(1, Math.min(959, nearest.x)), Math.max(1, Math.min(539, nearest.y)));
      const dx = me.x - nearest.x;
      const dy = me.y - nearest.y;
      if (Math.hypot(dx, dy) < 110) {
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
    if (!killed && (state.battle?.kills ?? 0) >= 1) killed = state;
  }
  await setHeld([]);
  await harness.keyUp('KeyJ');
  evidence.killed = killed?.battle ?? null;
  const killOk = (killed?.battle?.kills ?? 0) >= 1 && (killed?.battle?.projectilesSpawned ?? 0) >= 1;
  const wave2 = state;
  evidence.wave2 = wave2.battle;
  const waveOk = (wave2.battle?.kills ?? 0) >= 3 && (wave2.battle?.encounterPhase === 'wave-2' || (wave2.battle?.wavesCleared ?? 0) >= 1);

  const restart = await restartRun(harness);
  const fresh = await waitUntil(harness, read, (s) => (s.battle?.enemiesAlive ?? 0) >= 1, 60, 4);
  evidence.restart = { ...restart, battle: fresh.battle };
  const restartOk = restart.after === restart.before + 1 && fresh.battle?.kills === 0 && fresh.battle.encounterPhase === 'wave-1' && (fresh.battle.enemiesAlive ?? 0) >= 1;

  const passed = startedOk && killOk && waveOk && restartOk;
  return { passed, details: { ...evidence, startedOk, killOk, waveOk, restartOk } };
}
