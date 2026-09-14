import type { Harness } from '../src/harness.ts';
import { buildRoomMap, fightNearestInRoom, readDungeon, walkTo, walkToRoom, type DungeonShell } from '../src/dungeonJourney.ts';
import { restartRun, startPlay, waitUntil } from '../src/journey.ts';
import { readSnapshot } from '../src/snapshot.ts';
import type { SmokeOutcome } from '../src/smokeRunner.ts';

/**
 * dungeon-crawler completion journey (matrix L07): the generated room graph's
 * Enemy objects are live sw2d.ai agents. Enter a room -> its foes chase ->
 * leave the room -> they return home (patrol -> idle) -> come back and clear
 * every room with J -> the exit opens -> reach it -> complete; restart resets.
 */

export async function run(harness: Harness): Promise<SmokeOutcome> {
  const evidence: Record<string, unknown> = {};
  await startPlay(harness, 8);
  const booted = await readSnapshot(harness);
  const initial = await readDungeon(harness);
  const d0 = initial.dungeon!;
  evidence.initial = { room: d0.room, enemies: d0.enemiesTotal, rooms: d0.roomsWithEnemies, states: d0.states, world: [d0.worldWidth, d0.worldHeight] };
  const startedOk =
    booted.installedPacks.includes('sw2d.generation') && booted.installedPacks.includes('sw2d.ai') && d0.mode === 'crawl' && d0.enemiesTotal >= 3 && d0.states.idle === d0.enemiesTotal && !d0.exitOpen && d0.outcome === 'playing' && (d0.worldWidth > 960 || d0.worldHeight > 540);

  const map = buildRoomMap(initial);
  const startRoom = map.byCell.get(d0.room) ?? 'r0';
  const roomsToClear = [...new Set(d0.enemies.map((e) => e.room))].map((cell) => map.byCell.get(cell)!).filter(Boolean);
  evidence.plan = { startRoom, roomsToClear };

  // Enter the first enemy room: the foes there wake up and chase.
  const firstRoom = roomsToClear[0]!;
  const woke = await walkToRoom(harness, map, firstRoom, (s) => (s.dungeon?.states.chase ?? 0) > 0);
  const chased = await waitUntil(harness, () => readDungeon(harness), (s) => (s.dungeon?.states.chase ?? 0) > 0, 40, 3);
  evidence.chase = { room: chased.dungeon?.room, states: chased.dungeon?.states, last: chased.dungeon?.lastResult };
  const chaseOk = (chased.dungeon?.states.chase ?? 0) > 0 && chased.dungeon?.lastResult?.includes('chases') === true;

  // Leave: the chasers lose the player, return home (patrol) and settle (idle).
  await walkToRoom(harness, map, startRoom);
  const returning = await waitUntil(harness, () => readDungeon(harness), (s) => (s.dungeon?.states.patrol ?? 0) > 0 || (s.dungeon?.states.chase ?? 0) === 0, 60, 3);
  const settled = await waitUntil(harness, () => readDungeon(harness), (s) => (s.dungeon?.states.chase ?? 0) === 0 && (s.dungeon?.states.patrol ?? 0) === 0, 160, 4);
  evidence.leash = { returning: returning.dungeon?.states, settled: settled.dungeon?.states };
  const leashOk = (returning.dungeon?.states.chase ?? 1) === 0 || (returning.dungeon?.states.patrol ?? 0) > 0;
  const settledOk = settled.dungeon?.states.chase === 0 && settled.dungeon.states.patrol === 0 && settled.dungeon.enemiesAlive === d0.enemiesTotal;
  void woke;

  // Clear every room.
  let shell: DungeonShell = settled;
  const cleared: string[] = [];
  for (const room of roomsToClear) {
    shell = await walkToRoom(harness, map, room);
    for (let guard = 0; guard < 8 && shell.dungeon?.outcome === 'playing'; guard++) {
      const here = shell.dungeon!.room;
      if (!shell.dungeon!.enemies.some((e) => e.room === here)) break;
      shell = await fightNearestInRoom(harness);
    }
    cleared.push(`${room}:${shell.dungeon?.roomsCleared}`);
    if (shell.dungeon?.outcome !== 'playing') break;
  }
  evidence.cleared = { steps: cleared, kills: shell.dungeon?.kills, alive: shell.dungeon?.enemiesAlive, exitOpen: shell.dungeon?.exitOpen, hp: shell.dungeon?.playerHealth };
  const clearedOk = shell.dungeon?.enemiesAlive === 0 && shell.dungeon.roomsCleared === shell.dungeon.roomsWithEnemies && shell.dungeon.exitOpen === true && shell.dungeon.outcome === 'playing';

  // Exit.
  const exitCell = `${Math.floor((shell.dungeon?.exitX ?? 0) / 320)},${Math.floor((shell.dungeon?.exitY ?? 0) / 240)}`;
  const exitRoom = map.byCell.get(exitCell);
  if (exitRoom) await walkToRoom(harness, map, exitRoom);
  const done = await walkTo(harness, shell.dungeon?.exitX ?? 0, shell.dungeon?.exitY ?? 0, { tolerance: 6, stopWhen: (s) => s.dungeon?.outcome !== 'playing' });
  const finished = await waitUntil(harness, () => readDungeon(harness), (s) => s.dungeon?.outcome !== 'playing', 20, 2);
  evidence.done = { outcome: finished.dungeon?.outcome, last: finished.dungeon?.lastResult, x: done.x, y: done.y };
  const doneOk = finished.dungeon?.outcome === 'complete' && finished.dungeon.lastResult === 'escaped';

  const restart = await restartRun(harness);
  const fresh = await readDungeon(harness);
  evidence.restart = { ...restart, alive: fresh.dungeon?.enemiesAlive, cleared: fresh.dungeon?.roomsCleared, outcome: fresh.dungeon?.outcome };
  const restartOk = restart.after === restart.before + 1 && fresh.dungeon?.enemiesAlive === d0.enemiesTotal && fresh.dungeon.roomsCleared === 0 && fresh.dungeon.outcome === 'playing';

  const passed = startedOk && chaseOk && leashOk && settledOk && clearedOk && doneOk && restartOk;
  return { passed, details: { ...evidence, startedOk, chaseOk, leashOk, settledOk, clearedOk, doneOk, restartOk } };
}
