import type { Harness } from '../src/harness.ts';
import { holdUntil, restartRun, shellReader, startPlay } from '../src/journey.ts';
import { readSnapshot } from '../src/snapshot.ts';
import type { SmokeOutcome } from '../src/smokeRunner.ts';

interface Toy {
  readonly active: boolean;
  readonly mode: string | null;
  readonly shots: number;
  readonly captured: readonly string[];
  readonly nearId: string | null;
  readonly lastResult: string | null;
  readonly outcome: string;
}
interface Shell {
  readonly x: number;
  readonly y: number;
  readonly toy?: Toy;
}

export async function run(harness: Harness): Promise<SmokeOutcome> {
  const read = shellReader<Shell>(harness, 'game.top-down-shell');
  const evidence: Record<string, unknown> = {};
  await startPlay(harness, 12);
  const booted = await readSnapshot(harness);
  const initial = await read();
  evidence.initial = { x: initial.x, toy: initial.toy };
  const startedOk = booted.installedPacks.includes('sw2d.camera') && initial.toy?.mode === 'photo' && initial.toy.shots === 0 && initial.x === 120;

  // Shooting with no subject framed is refused.
  await harness.keyTap('KeyJ');
  await harness.stepFrames(4);
  const tooFar = (await read()).toy!;
  const tooFarOk = tooFar.lastResult === 'too-far' && tooFar.shots === 0;

  // Frame the bird and shoot; re-shooting the same subject is not a second capture.
  const atBird = await holdUntil(harness, ['ArrowRight'], read, (s) => s.toy?.nearId === 'bird');
  await harness.keyTap('KeyJ');
  await harness.stepFrames(4);
  const bird = (await read()).toy!;
  await harness.keyTap('KeyJ');
  await harness.stepFrames(4);
  const birdAgain = (await read()).toy!;
  evidence.bird = { x: atBird.x, toy: bird, again: birdAgain.captured.length };
  const birdOk = atBird.toy?.nearId === 'bird' && bird.lastResult === 'shot-bird' && bird.captured.includes('bird') && bird.shots === 1 && bird.outcome === 'playing' && birdAgain.captured.length === 1;

  // The tree completes the album.
  const atTree = await holdUntil(harness, ['ArrowRight'], read, (s) => s.toy?.nearId === 'tree');
  await harness.keyTap('KeyJ');
  await harness.stepFrames(4);
  const done = (await read()).toy!;
  evidence.done = { x: atTree.x, toy: done };
  const doneOk = done.lastResult === 'shot-tree' && done.captured.includes('tree') && done.captured.length === 2 && done.outcome === 'complete';

  const run = await restartRun(harness);
  const fresh = await read();
  evidence.restart = { ...run, x: fresh.x, toy: fresh.toy };
  const restartOk = run.after === run.before + 1 && fresh.toy?.shots === 0 && fresh.toy.captured.length === 0 && fresh.x === 120;

  const passed = startedOk && tooFarOk && birdOk && doneOk && restartOk;
  return { passed, details: { ...evidence, startedOk, tooFarOk, birdOk, doneOk, restartOk } };
}
