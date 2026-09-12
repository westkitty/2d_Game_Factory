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
  const startedOk = booted.installedPacks.includes('sw2d.arcade') && initial.mode === 'micro' && initial.phase === 'wait' && initial.round === 1 && initial.score === 0;

  // Round 1 is a reaction tap: tapping during "wait" is refused; tapping at "go" scores and advances.
  await harness.keyTap('Enter');
  const early = await a();
  const earlyOk = early.round === 1 && early.score === 0;
  const go = (await waitUntil(harness, read, (s) => s.arcade?.phase === 'go', 90, 2)).arcade!;
  await harness.keyTap('Enter');
  const tapped = await a();
  evidence.tapped = { go: go.phase, last: tapped.lastResult, phase: tapped.phase, round: tapped.round, score: tapped.score };
  const tapOk = go.phase === 'go' && tapped.lastResult === 'tapped' && tapped.phase === 'mash' && tapped.round === 2 && tapped.score > 0;

  // Round 2 is a mash: each PRIMARY press counts until the set completes.
  for (let i = 0; i < 5; i++) await harness.keyTap('KeyJ');
  const done = await a();
  evidence.done = { last: done.lastResult, mash: done.mash, round: done.round, score: done.score, outcome: done.outcome };
  const mashOk = done.lastResult === 'set' && done.mash === 5 && done.score > tapped.score && done.outcome === 'complete';
  await harness.keyTap('KeyJ');
  const after = await a();
  const inertOk = after.mash === 5;

  const run = await restartRun(harness);
  const fresh = await a();
  evidence.restart = { ...run, round: fresh.round, mash: fresh.mash, score: fresh.score, phase: fresh.phase };
  const restartOk = run.after === run.before + 1 && fresh.round === 1 && fresh.mash === 0 && fresh.score === 0 && fresh.phase === 'wait';

  const passed = startedOk && earlyOk && tapOk && mashOk && inertOk && restartOk;
  return { passed, details: { ...evidence, startedOk, earlyOk, tapOk, mashOk, inertOk, restartOk } };
}
