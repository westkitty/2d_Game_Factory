import type { Harness } from '../src/harness.ts';
import { restartRun, shellReader, startPlay } from '../src/journey.ts';
import { readSnapshot } from '../src/snapshot.ts';
import type { SmokeOutcome } from '../src/smokeRunner.ts';

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
  evidence.initial = { x: initial.x, y: initial.y, parkour: initial.parkour, wall: initial.wall };
  const startedOk = booted.installedPacks.includes('sw2d.wall') && initial.parkour?.mode === 'climb' && initial.parkour.outcome === 'playing' && initial.y > 400 && Boolean(initial.wall);

  // Walking into the wall without jumping never gains height.
  await harness.keyDown('ArrowRight');
  await harness.stepFrames(40);
  await harness.keyUp('ArrowRight');
  const stuck = await read();
  const stuckOk = stuck.y > 400 && stuck.parkour?.outcome === 'playing' && stuck.parkour.jumps === 0;

  // Two jumps up the ledges (sw2d.wall slide contact between them) reach the summit.
  await harness.keyDown('ArrowRight');
  let state = await read();
  const jumpedAt = new Set<number>();
  let slid = false;
  for (let step = 0; step < 160 && state.parkour?.outcome === 'playing'; step++) {
    const band = state.x < 220 ? 1 : state.x < 360 ? 2 : 3;
    if (state.onGround && !jumpedAt.has(band) && band < 3) {
      await harness.keyTap('Space');
      jumpedAt.add(band);
    }
    if (state.wall?.sliding) slid = true;
    await harness.stepFrames(4);
    state = await read();
  }
  await harness.keyUp('ArrowRight');
  await harness.stepFrames(8);
  const done = await read();
  evidence.done = { x: done.x, y: done.y, parkour: done.parkour, wall: done.wall, slid };
  const doneOk = done.parkour?.outcome === 'complete' && done.parkour.lastResult === 'summit' && done.y <= 410 && done.x >= 400 && done.parkour.jumps >= 2;

  const run = await restartRun(harness);
  const fresh = await read();
  evidence.restart = { ...run, y: fresh.y, parkour: fresh.parkour };
  const restartOk = run.after === run.before + 1 && fresh.parkour?.outcome === 'playing' && fresh.y > 400 && fresh.parkour.jumps === 0;

  const passed = startedOk && stuckOk && doneOk && restartOk;
  return { passed, details: { ...evidence, startedOk, stuckOk, doneOk, restartOk } };
}
