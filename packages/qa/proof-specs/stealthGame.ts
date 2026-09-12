import type { Harness } from '../src/harness.ts';
import { holdUntil, restartRun, shellReader, startPlay, waitUntil } from '../src/journey.ts';
import { readSnapshot } from '../src/snapshot.ts';
import type { SmokeOutcome } from '../src/smokeRunner.ts';

/**
 * stealth-game defining journey. Category-C Wave 4 infiltrate plus the Final
 * Product Completion program's stealth AI (matrix L09): the guard patrols a
 * route; a clear sighting starts a chase that catches a player who stands
 * still; after a restart, out-running the chase breaks line of sight, the
 * guard investigates where it lost the player, returns to its route and
 * resumes the patrol; sneaking up behind it takes it down; the loot and the
 * exit finish the infiltration.
 */

interface Observer {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly facingDeg: number;
  readonly seesPlayer: boolean;
  readonly state: string;
  readonly patrolling: boolean;
}
interface Perception {
  readonly active: boolean;
  readonly mode: string | null;
  readonly x: number;
  readonly y: number;
  readonly hidden: boolean;
  readonly seen: boolean;
  readonly alarm: boolean;
  readonly suspicion: number;
  readonly objectiveCollected: boolean;
  readonly outcome: string;
  readonly lastResult: string | null;
  readonly takedowns: number;
  readonly transitions: number;
  readonly observers: readonly Observer[];
}
interface Shell {
  readonly x: number;
  readonly y: number;
  readonly perception?: Perception;
}

const guard = (s: Shell): Observer | undefined => s.perception?.observers[0];

export async function run(harness: Harness): Promise<SmokeOutcome> {
  const read = shellReader<Shell>(harness, 'game.top-down-shell');
  const evidence: Record<string, unknown> = {};
  await startPlay(harness);
  const booted = await readSnapshot(harness);
  const initial = await read();
  evidence.initial = { x: initial.x, perception: initial.perception };
  const startedOk =
    booted.installedPacks.includes('sw2d.perception') && initial.perception?.mode === 'infiltrate' && initial.perception.outcome === 'playing' && !initial.perception.seen && guard(initial)?.state === 'patrol' && guard(initial)?.patrolling === true;

  // The guard walks its route: it moves and its facing follows the direction of travel.
  const moved = await waitUntil(harness, read, (s) => (guard(s)?.x ?? 520) > 560, 120, 4);
  evidence.patrol = guard(moved);
  const patrolOk = (guard(moved)?.x ?? 0) > 560 && Math.abs(guard(moved)?.facingDeg ?? 90) < 5 && guard(moved)?.state === 'patrol';

  // 1. Stand in the corridor: the returning guard sees the player, chases, and catches.
  await holdUntil(harness, ['ArrowRight'], read, (s) => s.x >= 330, 40, 4);
  const chased = await waitUntil(harness, read, (s) => guard(s)?.state === 'chase', 300, 4);
  const caught = await waitUntil(harness, read, (s) => s.perception?.outcome !== 'playing', 200, 4);
  evidence.caught = { chased: guard(chased), caught: caught.perception };
  const caughtOk = guard(chased)?.state === 'chase' && chased.perception?.seen === true && caught.perception?.outcome === 'failed' && caught.perception.lastResult === 'caught';

  // 2. Restart; get spotted again, then out-run the chase: the guard loses the player, investigates, returns, patrols.
  const restart = await restartRun(harness);
  const fresh = await read();
  const restartOk = restart.after === restart.before + 1 && fresh.perception?.outcome === 'playing' && guard(fresh)?.state === 'patrol' && fresh.perception.transitions === 0;
  await holdUntil(harness, ['ArrowRight'], read, (s) => s.x >= 330, 40, 4);
  await waitUntil(harness, read, (s) => guard(s)?.state === 'chase', 300, 4);
  const fled = await holdUntil(harness, ['ArrowLeft'], read, (s) => s.x <= 70, 60, 3);
  const investigating = await waitUntil(harness, read, (s) => guard(s)?.state === 'investigate' || s.perception?.outcome !== 'playing', 200, 4);
  const returned = await waitUntil(harness, read, (s) => guard(s)?.state === 'return' || guard(s)?.state === 'patrol' || s.perception?.outcome !== 'playing', 200, 4);
  const patrolling = await waitUntil(harness, read, (s) => guard(s)?.state === 'patrol' || s.perception?.outcome !== 'playing', 300, 4);
  evidence.loop = { fled: guard(fled), investigating: guard(investigating), returned: guard(returned), patrolling: { guard: guard(patrolling), alarm: patrolling.perception?.alarm, transitions: patrolling.perception?.transitions } };
  const loopOk =
    guard(investigating)?.state === 'investigate' && ['return', 'patrol'].includes(guard(returned)?.state ?? '') && guard(patrolling)?.state === 'patrol' && patrolling.perception?.outcome === 'playing' && patrolling.perception.alarm === false && (patrolling.perception.transitions ?? 0) >= 4;

  // 3. Takedown from behind: wait for the guard to walk east (facing away), catch up behind it, J.
  const walkingAway = await waitUntil(harness, read, (s) => guard(s)?.state === 'patrol' && Math.abs(guard(s)?.facingDeg ?? 180) < 5 && (guard(s)?.x ?? 0) > 540, 300, 4);
  await holdUntil(harness, ['ArrowRight'], read, (s) => s.x >= (guard(s)?.x ?? 999) - 30 || s.perception?.outcome !== 'playing', 120, 2);
  await harness.keyTap('KeyJ');
  await harness.stepFrames(2);
  const downed = await read();
  evidence.takedown = { walkingAway: guard(walkingAway), x: downed.x, guard: guard(downed), perception: { last: downed.perception?.lastResult, takedowns: downed.perception?.takedowns } };
  const takedownOk = guard(downed)?.state === 'downed' && downed.perception?.takedowns === 1 && downed.perception.lastResult === 'takedown' && downed.perception.outcome === 'playing';

  // 4. Loot and exit past the downed guard.
  await holdUntil(harness, ['ArrowUp'], read, (s) => s.y <= 150, 60, 4);
  const looted = await holdUntil(harness, ['ArrowRight'], read, (s) => s.perception?.objectiveCollected === true, 120, 4);
  await holdUntil(harness, ['ArrowUp'], read, (s) => s.y <= 100, 40, 3);
  const escaped = await holdUntil(harness, ['ArrowLeft'], read, (s) => s.perception?.outcome !== 'playing', 200, 4);
  evidence.done = { looted: looted.perception?.objectiveCollected, escaped: escaped.perception };
  const doneOk = looted.perception?.objectiveCollected === true && escaped.perception?.outcome === 'complete' && escaped.perception.lastResult === 'escaped';

  const passed = startedOk && patrolOk && caughtOk && restartOk && loopOk && takedownOk && doneOk;
  return { passed, details: { ...evidence, startedOk, patrolOk, caughtOk, restartOk, loopOk, takedownOk, doneOk } };
}
