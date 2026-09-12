import type { Harness } from '../src/harness.ts';
import { pointerAt, restartRun, shellReader, startPlay } from '../src/journey.ts';
import { readSnapshot } from '../src/snapshot.ts';
import type { SmokeOutcome } from '../src/smokeRunner.ts';

interface PointerPlay {
  readonly active: boolean;
  readonly mode: string | null;
  readonly strokes: number;
  readonly strokeLength: number;
  readonly lastResult: string | null;
  readonly outcome: string;
}
interface Shell {
  readonly pointerPlay?: PointerPlay;
}

async function dragFromTo(harness: Harness, x1: number, y1: number, x2: number, y2: number, steps = 8): Promise<void> {
  await pointerAt(harness, 'pointermove', x1, y1);
  await harness.stepFrames(2);
  await pointerAt(harness, 'pointerdown', x1, y1);
  await harness.stepFrames(2);
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    await pointerAt(harness, 'pointermove', x1 + (x2 - x1) * t, y1 + (y2 - y1) * t);
    await harness.stepFrames(1);
  }
  await pointerAt(harness, 'pointerup', x2, y2);
  await harness.stepFrames(4);
}

export async function run(harness: Harness): Promise<SmokeOutcome> {
  const read = shellReader<Shell>(harness, 'game.pointer-shell');
  const pp = async () => (await read()).pointerPlay!;
  const evidence: Record<string, unknown> = {};
  await startPlay(harness, 12);
  const booted = await readSnapshot(harness);
  const initial = await pp();
  evidence.initial = initial;
  const startedOk = booted.scene === 'sw2d.play' && initial.mode === 'draw' && initial.strokes === 0 && initial.outcome === 'playing';

  // A press-and-release with no movement is not a stroke.
  await pointerAt(harness, 'pointermove', 200, 200);
  await harness.stepFrames(2);
  await pointerAt(harness, 'pointerdown', 200, 200);
  await harness.stepFrames(2);
  await pointerAt(harness, 'pointerup', 200, 200);
  await harness.stepFrames(4);
  const tap = await pp();
  const tapOk = tap.strokes === 0;

  // A drag is a stroke whose length is the pointer path (ADR-0018 spatial pointer drag).
  await dragFromTo(harness, 200, 200, 520, 200);
  const first = await pp();
  evidence.first = first;
  const firstOk = first.lastResult === 'stroke' && first.strokes === 1 && first.strokeLength >= 300 && first.outcome === 'playing';
  await dragFromTo(harness, 200, 320, 520, 320);
  const done = await pp();
  evidence.done = done;
  const doneOk = done.strokes === 2 && done.outcome === 'complete';

  const run = await restartRun(harness);
  const fresh = await pp();
  evidence.restart = { ...run, strokes: fresh.strokes, outcome: fresh.outcome };
  const restartOk = run.after === run.before + 1 && fresh.strokes === 0 && fresh.outcome === 'playing';

  const passed = startedOk && tapOk && firstOk && doneOk && restartOk;
  return { passed, details: { ...evidence, startedOk, tapOk, firstOk, doneOk, restartOk } };
}
