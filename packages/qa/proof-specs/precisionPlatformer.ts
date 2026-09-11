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

async function runCourse(harness: Harness, read: () => Promise<Shell>, jump: boolean): Promise<Shell> {
  await harness.keyDown('ArrowRight');
  let state = await read();
  let jumped = false;
  for (let step = 0; step < 160 && state.parkour?.outcome === 'playing'; step++) {
    if (jump && !jumped && state.x >= 210 && state.x <= 270 && state.onGround) {
      await harness.keyTap('Space');
      jumped = true;
    }
    await harness.stepFrames(4);
    state = await read();
  }
  await harness.keyUp('ArrowRight');
  await harness.stepFrames(8);
  return read();
}

export async function run(harness: Harness): Promise<SmokeOutcome> {
  const read = shellReader<Shell>(harness, 'game.platform-shell');
  const evidence: Record<string, unknown> = {};
  await startPlay(harness, 12);
  const booted = await readSnapshot(harness);
  const initial = await read();
  evidence.initial = { x: initial.x, parkour: initial.parkour, wall: initial.wall };
  const startedOk = booted.installedPacks.includes('sw2d.wall') && initial.parkour?.mode === 'precision' && initial.parkour.outcome === 'playing' && initial.x < 200 && Boolean(initial.wall);

  // Running without the timed jump falls into the gap: the course fails.
  const fell = await runCourse(harness, read, false);
  evidence.fell = { x: fell.x, parkour: fell.parkour };
  const fellOk = fell.parkour?.outcome === 'failed' && fell.parkour.jumps === 0;

  // Restart, then clear the gap with one precise jump and finish.
  const run = await restartRun(harness);
  const fresh = await read();
  const restartOk = run.after === run.before + 1 && fresh.parkour?.outcome === 'playing' && fresh.x < 200;
  const done = await runCourse(harness, read, true);
  evidence.done = { x: done.x, parkour: done.parkour, wall: done.wall };
  const doneOk = done.parkour?.outcome === 'complete' && done.parkour.lastResult === 'finished' && done.parkour.jumps === 1 && done.x >= 820;

  const passed = startedOk && fellOk && restartOk && doneOk;
  return { passed, details: { ...evidence, startedOk, fellOk, restartOk, doneOk } };
}
