import type { Harness } from '../src/harness.ts';
import { pointerAt, restartRun, shellReader, startPlay } from '../src/journey.ts';
import { readSnapshot } from '../src/snapshot.ts';
import type { SmokeOutcome } from '../src/smokeRunner.ts';

interface PointerPlay {
  readonly active: boolean;
  readonly mode: string | null;
  readonly attached: readonly string[];
  readonly draggingId: string | null;
  readonly lastResult: string | null;
  readonly outcome: string;
}
interface Shell {
  readonly pointerPlay?: PointerPlay;
}

async function dragFromTo(harness: Harness, x1: number, y1: number, x2: number, y2: number, read: () => Promise<Shell>): Promise<PointerPlay> {
  await pointerAt(harness, 'pointermove', x1, y1);
  await harness.stepFrames(2);
  await pointerAt(harness, 'pointerdown', x1, y1);
  await harness.stepFrames(2);
  let mid: PointerPlay | null = null;
  for (let i = 1; i <= 8; i++) {
    const t = i / 8;
    await pointerAt(harness, 'pointermove', x1 + (x2 - x1) * t, y1 + (y2 - y1) * t);
    await harness.stepFrames(1);
    if (i === 4) mid = (await read()).pointerPlay!;
  }
  await pointerAt(harness, 'pointerup', x2, y2);
  await harness.stepFrames(4);
  return mid!;
}

export async function run(harness: Harness): Promise<SmokeOutcome> {
  const read = shellReader<Shell>(harness, 'game.pointer-shell');
  const pp = async () => (await read()).pointerPlay!;
  const evidence: Record<string, unknown> = {};
  await startPlay(harness, 12);
  const booted = await readSnapshot(harness);
  const initial = await pp();
  evidence.initial = initial;
  const startedOk = booted.scene === 'sw2d.play' && initial.mode === 'wardrobe' && initial.attached.length === 0 && initial.outcome === 'playing';

  // Dropping a garment away from the figure does not attach it.
  await dragFromTo(harness, 200, 160, 300, 460, read);
  const missed = await pp();
  const missOk = missed.attached.length === 0;

  // Drag the hat onto the figure: mid-drag the pointer is captured (draggingId), the drop attaches it.
  const midHat = await dragFromTo(harness, 200, 160, 700, 200, read);
  const hat = await pp();
  evidence.hat = { mid: midHat.draggingId, result: hat };
  const hatOk = midHat.draggingId === 'hat' && hat.lastResult === 'drop-hat' && hat.attached.includes('hat') && hat.attached.length === 1 && hat.outcome === 'playing';
  await dragFromTo(harness, 200, 340, 700, 300, read);
  const done = await pp();
  evidence.done = done;
  const doneOk = done.lastResult === 'drop-shirt' && done.attached.includes('shirt') && done.attached.length === 2 && done.outcome === 'complete';

  const run = await restartRun(harness);
  const fresh = await pp();
  evidence.restart = { ...run, attached: fresh.attached, outcome: fresh.outcome };
  const restartOk = run.after === run.before + 1 && fresh.attached.length === 0 && fresh.outcome === 'playing';

  const passed = startedOk && missOk && hatOk && doneOk && restartOk;
  return { passed, details: { ...evidence, startedOk, missOk, hatOk, doneOk, restartOk } };
}
