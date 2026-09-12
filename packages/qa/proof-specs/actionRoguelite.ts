import type { Harness } from '../src/harness.ts';
import { buildRoomMap, fightNearestInRoom, readDungeon, walkTo, walkToRoom, type DungeonShell } from '../src/dungeonJourney.ts';
import { restartRun, startPlay, waitUntil } from '../src/journey.ts';
import { readSnapshot } from '../src/snapshot.ts';
import type { SmokeOutcome } from '../src/smokeRunner.ts';

/**
 * action-roguelite defining journey (Final Product Completion Wave 2, matrix
 * L08): the generated dungeon is one run on sw2d.runs. Run 1: clear a room
 * (coin), then die (permadeath) -> the run ends, meta is banked, K buys the
 * first unlock. Restart -> run 2 starts with the loadout (more max health)
 * and a fresh dungeon; clearing every room and reaching the exit clears the
 * run and banks the clear bonus.
 */

async function clearRooms(harness: Harness, map: ReturnType<typeof buildRoomMap>, rooms: readonly string[]): Promise<DungeonShell> {
  let shell = await readDungeon(harness);
  for (const room of rooms) {
    shell = await walkToRoom(harness, map, room);
    for (let guard = 0; guard < 8 && shell.dungeon?.outcome === 'playing'; guard++) {
      const here = shell.dungeon!.room;
      if (!shell.dungeon!.enemies.some((e) => e.room === here)) break;
      shell = await fightNearestInRoom(harness);
    }
    if (shell.dungeon?.outcome !== 'playing') break;
  }
  return shell;
}

export async function run(harness: Harness): Promise<SmokeOutcome> {
  const evidence: Record<string, unknown> = {};
  await startPlay(harness, 8);
  const booted = await readSnapshot(harness);
  const initial = await readDungeon(harness);
  const d0 = initial.dungeon!;
  evidence.initial = { room: d0.room, enemies: d0.enemiesTotal, run: d0.run, hp: [d0.playerHealth, d0.playerMaxHealth] };
  const startedOk =
    booted.installedPacks.includes('sw2d.runs') && booted.installedPacks.includes('sw2d.ai') && d0.mode === 'rogue' && d0.enemiesTotal >= 3 && d0.run?.index === 1 && d0.run.phase === 'in-run' && d0.run.loadOutcome === 'default' && d0.playerMaxHealth === 5;

  const map = buildRoomMap(initial);
  const roomsToClear = [...new Set(d0.enemies.map((e) => e.room))].map((cell) => map.byCell.get(cell)!).filter(Boolean);

  // Run 1: clear the first room - a coin drops - then stand in the next room without striking until the foes bring the run down.
  let shell = await clearRooms(harness, map, roomsToClear.slice(0, 1));
  evidence.firstRoom = { cleared: shell.dungeon?.roomsCleared, coin: shell.dungeon?.currency, kills: shell.dungeon?.kills };
  const coinOk = shell.dungeon?.roomsCleared === 1 && shell.dungeon.currency === 1 && (shell.dungeon.kills ?? 0) >= 1;
  const deathRoom = roomsToClear[1] ?? roomsToClear[0]!;
  shell = await walkToRoom(harness, map, deathRoom, (s) => s.dungeon?.outcome !== 'playing');
  const foe = shell.dungeon?.enemies.find((e) => e.room === shell.dungeon?.room);
  if (foe) await walkTo(harness, foe.x, foe.y, { tolerance: 10, maxSteps: 80, stopWhen: (s) => s.dungeon?.outcome !== 'playing' });
  const dead = await waitUntil(harness, () => readDungeon(harness), (s) => s.dungeon?.outcome !== 'playing', 400, 4);
  evidence.death = { outcome: dead.dungeon?.outcome, run: dead.dungeon?.run, hp: dead.dungeon?.playerHealth };
  const deathOk = dead.dungeon?.outcome === 'failed' && dead.dungeon.run?.phase === 'ended' && dead.dungeon.run.cause === 'death' && (dead.dungeon.run.metaEarned ?? 0) >= 3 && dead.dungeon.run.nextUnlock === 'vigor';

  // Between runs: K buys the next unlock.
  await harness.keyTap('KeyK');
  await harness.stepFrames(2);
  const bought = await readDungeon(harness);
  evidence.bought = { last: bought.dungeon?.lastResult, run: bought.dungeon?.run };
  const boughtOk = bought.dungeon?.lastResult === 'bought vigor' && bought.dungeon.run?.unlocked.includes('vigor') === true;

  // Run 2 starts with the loadout and a fresh dungeon; clear everything and escape.
  const restart = await restartRun(harness);
  const fresh = await readDungeon(harness);
  const f = fresh.dungeon!;
  evidence.run2 = { run: f.run, hp: [f.playerHealth, f.playerMaxHealth], alive: f.enemiesAlive, coin: f.currency };
  const run2Ok = restart.after === restart.before + 1 && f.run?.index === 2 && f.run.loadOutcome === 'loaded' && f.run.loadout.maxHealthBonus === 2 && f.playerMaxHealth === 7 && f.enemiesAlive === d0.enemiesTotal && f.roomsCleared === 0;
  const map2 = buildRoomMap(fresh);
  shell = await clearRooms(harness, map2, [...new Set(f.enemies.map((e) => e.room))].map((cell) => map2.byCell.get(cell)!).filter(Boolean));
  const exitCell = `${Math.floor((shell.dungeon?.exitX ?? 0) / 320)},${Math.floor((shell.dungeon?.exitY ?? 0) / 240)}`;
  const exitRoom = map2.byCell.get(exitCell);
  if (exitRoom && shell.dungeon?.outcome === 'playing') await walkToRoom(harness, map2, exitRoom);
  if (shell.dungeon?.outcome === 'playing') await walkTo(harness, shell.dungeon.exitX, shell.dungeon.exitY, { tolerance: 6, stopWhen: (s) => s.dungeon?.outcome !== 'playing' });
  const done = await waitUntil(harness, () => readDungeon(harness), (s) => s.dungeon?.outcome !== 'playing', 20, 2);
  evidence.done = { outcome: done.dungeon?.outcome, run: done.dungeon?.run, kills: done.dungeon?.kills, coin: done.dungeon?.currency };
  const doneOk = done.dungeon?.outcome === 'complete' && done.dungeon.run?.cause === 'cleared' && (done.dungeon.run.metaEarned ?? 0) >= 10 && done.dungeon.run.phase === 'ended';

  const passed = startedOk && coinOk && deathOk && boughtOk && run2Ok && doneOk;
  return { passed, details: { ...evidence, startedOk, coinOk, deathOk, boughtOk, run2Ok, doneOk } };
}
