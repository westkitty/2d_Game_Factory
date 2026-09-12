import type { Harness } from '../src/harness.ts';
import { restartRun, shellReader, startPlay, waitUntil } from '../src/journey.ts';
import { readSnapshot } from '../src/snapshot.ts';
import type { SmokeOutcome } from '../src/smokeRunner.ts';

interface Arcade {
  readonly active: boolean;
  readonly mode: string | null;
  readonly score: number;
  readonly phase: string;
  readonly round: number;
  readonly mash: number;
  readonly lastResult: string | null;
  readonly outcome: string;
  readonly roundId: string | null;
  readonly roundKind: string | null;
  readonly roundsCompleted: number;
  readonly failures: number;
}
interface Shell {
  readonly arcade?: Arcade;
}

export async function run(harness: Harness): Promise<SmokeOutcome> {
  const read = shellReader<Shell>(harness, 'game.ui-simulation-shell');
  const a = async () => (await read()).arcade!;
  const evidence: Record<string, unknown> = {};
  await startPlay(harness, 12);
  const booted = await readSnapshot(harness);
  const initial = await a();
  evidence.initial = initial;
  const startedOk = booted.installedPacks.includes('sw2d.arcade') && initial.mode === 'micro' && initial.phase === 'countdown' && initial.round === 1 && initial.roundKind === 'react' && initial.score === 0;

  // Round 1 is a reaction tap: tapping during "wait" is refused; tapping at "go" scores and advances.
  await harness.keyTap('Enter');
  const early = await a();
  const earlyOk = early.round === 1 && early.score === 0 && early.failures === 1;
  const go = (await waitUntil(harness, read, (s) => s.arcade?.phase === 'go', 90, 2)).arcade!;
  await harness.keyTap('Enter');
  const tapped = await a();
  evidence.tapped = { go: go.phase, last: tapped.lastResult, phase: tapped.phase, round: tapped.round, score: tapped.score };
  const tapOk = go.phase === 'go' && tapped.lastResult === 'round-clear' && tapped.phase === 'transition' && tapped.roundsCompleted === 1 && tapped.score > 0;

  const mashGo = (await waitUntil(harness, read, (s) => s.arcade?.roundKind === 'mash' && s.arcade.phase === 'go', 90, 2)).arcade!;
  for (let i = 0; i < 4; i++) await harness.keyTap('KeyJ');
  const mashed = await a();
  const mashOk = mashGo.roundId === 'scramble' && mashed.roundsCompleted === 2;

  await waitUntil(harness, read, (s) => s.arcade?.roundKind === 'hold' && s.arcade.phase === 'go', 90, 2);
  await harness.keyDown('KeyJ');
  await harness.stepFrames(40);
  await harness.keyUp('KeyJ');
  await harness.stepFrames(2);
  const held = await a();
  const holdOk = held.roundsCompleted === 3;

  await waitUntil(harness, read, (s) => s.arcade?.roundKind === 'alternate' && s.arcade.phase === 'go', 90, 2);
  await harness.keyTap('KeyJ');
  await harness.keyTap('KeyK');
  await harness.keyTap('KeyJ');
  await harness.keyTap('KeyK');
  const done = await a();
  evidence.done = { last: done.lastResult, mash: done.mash, round: done.round, score: done.score, outcome: done.outcome };
  const alternateOk = done.lastResult === 'set' && done.roundsCompleted === 4 && done.score > tapped.score && done.outcome === 'complete';
  await harness.keyTap('KeyJ');
  const after = await a();
  const inertOk = after.roundsCompleted === 4;

  const run = await restartRun(harness);
  const fresh = await a();
  evidence.restart = { ...run, round: fresh.round, mash: fresh.mash, score: fresh.score, phase: fresh.phase };
  const restartOk = run.after === run.before + 1 && fresh.round === 1 && fresh.mash === 0 && fresh.score === 0 && fresh.phase === 'countdown';

  const passed = startedOk && earlyOk && tapOk && mashOk && holdOk && alternateOk && inertOk && restartOk;
  return { passed, details: { ...evidence, mashed, held, startedOk, earlyOk, tapOk, mashOk, holdOk, alternateOk, inertOk, restartOk } };
}
