import type { Harness } from '../src/harness.ts';
import { holdUntil, restartRun, shellReader, startPlay, waitUntil } from '../src/journey.ts';
import { readSnapshot } from '../src/snapshot.ts';
import type { SmokeOutcome } from '../src/smokeRunner.ts';

/**
 * precision-platformer defining journey. Category-C Wave 27/30 gap course
 * plus the Final Product Completion program's ledge grammar (matrix L03):
 * running off the edge grabs the far ledge, DOWN drops into the gap (fail),
 * UP climbs onto the platform and the course finishes; a precise jump
 * clears the gap without touching the ledge.
 */

interface Parkour {
  readonly active: boolean;
  readonly mode: string | null;
  readonly jumps: number;
  readonly lastResult: string | null;
  readonly outcome: string;
}
interface Wall {
  readonly sliding: boolean;
  readonly wallId: string | null;
  readonly state: string;
  readonly ledgeId: string | null;
  readonly ledges: { readonly grabs: number; readonly climbs: number; readonly drops: number };
  readonly lastResult: string | null;
  readonly outcome: string;
}
interface Shell {
  readonly x: number;
  readonly y: number;
  readonly onGround: boolean;
  readonly parkour?: Parkour;
  readonly wall?: Wall;
}

export async function run(harness: Harness): Promise<SmokeOutcome> {
  const read = shellReader<Shell>(harness, 'game.platform-shell');
  const evidence: Record<string, unknown> = {};
  await startPlay(harness, 12);
  const booted = await readSnapshot(harness);
  const initial = await read();
  evidence.initial = { x: initial.x, parkour: initial.parkour, wall: initial.wall };
  const startedOk =
    booted.installedPacks.includes('sw2d.wall') &&
    initial.parkour?.mode === 'precision' &&
    initial.parkour.outcome === 'playing' &&
    initial.x < 200 &&
    initial.wall?.state === 'grounded';

  // 1. Run off the edge without jumping: the far ledge is grabbed, not a fall.
  const hung = await holdUntil(harness, ['ArrowRight'], read, (s) => s.wall?.state === 'ledge-hang' || s.parkour?.outcome !== 'playing', 120, 2);
  evidence.hung = { x: hung.x, y: hung.y, wall: hung.wall, parkour: hung.parkour };
  const hungOk = hung.wall?.state === 'ledge-hang' && hung.wall.ledgeId === 'gap-ledge' && hung.wall.ledges.grabs === 1 && hung.parkour?.outcome === 'playing';
  // Hanging is stable: the body stays pinned frame to frame.
  await harness.stepFrames(20);
  const stillHung = await read();
  const stableOk = stillHung.wall?.state === 'ledge-hang' && Math.abs(stillHung.y - hung.y) < 2 && Math.abs(stillHung.x - hung.x) < 2;

  // 2. DOWN drops into the gap: the course fails.
  await harness.keyTap('ArrowDown');
  const dropped = await waitUntil(harness, read, (s) => s.parkour?.outcome !== 'playing', 90, 3);
  evidence.dropped = { y: dropped.y, wall: dropped.wall, parkour: dropped.parkour };
  const droppedOk = dropped.wall?.ledges.drops === 1 && dropped.parkour?.outcome === 'failed' && dropped.parkour.lastResult === 'fell';

  // 3. Restart; grab again; UP climbs onto the platform; run on and finish.
  const run1 = await restartRun(harness);
  const fresh = await read();
  const restartOk = run1.after === run1.before + 1 && fresh.parkour?.outcome === 'playing' && fresh.wall?.ledges.grabs === 0 && fresh.x < 200;
  await holdUntil(harness, ['ArrowRight'], read, (s) => s.wall?.state === 'ledge-hang' || s.parkour?.outcome !== 'playing', 120, 2);
  await harness.keyTap('ArrowUp');
  const climbed = await waitUntil(harness, read, (s) => s.wall?.state === 'grounded' && s.wall.ledges.climbs === 1, 60, 2);
  evidence.climbed = { x: climbed.x, y: climbed.y, wall: climbed.wall };
  const climbedOk = climbed.wall?.ledges.climbs === 1 && climbed.wall.lastResult === 'climbed' && climbed.x > 360 && climbed.y < 470;
  const finished = await holdUntil(harness, ['ArrowRight'], read, (s) => s.parkour?.outcome !== 'playing', 160, 4);
  evidence.finished = { x: finished.x, parkour: finished.parkour };
  const finishedOk = finished.parkour?.outcome === 'complete' && finished.parkour.lastResult === 'finished' && finished.x >= 820;

  // 4. Restart; one precise jump clears the gap without touching the ledge.
  const run2 = await restartRun(harness);
  await harness.keyDown('ArrowRight');
  let state = await read();
  let jumped = false;
  for (let step = 0; step < 160 && state.parkour?.outcome === 'playing'; step++) {
    if (!jumped && state.x >= 210 && state.x <= 270 && state.onGround) {
      await harness.keyTap('Space');
      jumped = true;
    }
    await harness.stepFrames(4);
    state = await read();
  }
  await harness.keyUp('ArrowRight');
  await harness.stepFrames(8);
  const clean = await read();
  evidence.clean = { x: clean.x, parkour: clean.parkour, wall: clean.wall };
  const cleanOk = run2.after === run2.before + 1 && clean.parkour?.outcome === 'complete' && clean.parkour.jumps === 1 && clean.wall?.ledges.grabs === 0 && clean.x >= 820;

  const passed = startedOk && hungOk && stableOk && droppedOk && restartOk && climbedOk && finishedOk && cleanOk;
  return { passed, details: { ...evidence, startedOk, hungOk, stableOk, droppedOk, restartOk, climbedOk, finishedOk, cleanOk } };
}
