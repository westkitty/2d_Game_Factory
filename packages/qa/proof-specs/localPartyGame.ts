import type { Harness } from '../src/harness.ts';
import { restartRun, shellReader, startPlay } from '../src/journey.ts';
import { readSnapshot } from '../src/snapshot.ts';
import type { SmokeOutcome } from '../src/smokeRunner.ts';

interface LocalPlay {
  readonly active: boolean;
  readonly mode: string | null;
  readonly currentPlayer: number;
  readonly scores: readonly number[];
  readonly turns: number;
  readonly winner: number | null;
  readonly lastResult: string | null;
  readonly outcome: string;
}
interface Shell {
  readonly localPlay?: LocalPlay;
}

export async function run(harness: Harness): Promise<SmokeOutcome> {
  const read = shellReader<Shell>(harness, 'game.ui-simulation-shell');
  const lp = async () => (await read()).localPlay!;
  const evidence: Record<string, unknown> = {};
  await startPlay(harness);
  const booted = await readSnapshot(harness);
  const initial = await lp();
  evidence.initial = initial;
  const startedOk = booted.installedPacks.includes('sw2d.local-play') && initial.active && initial.mode === 'hotseat' && initial.turns === 0 && initial.currentPlayer === 0;

  // Hot-seat: each act is owned by the current seat, then the seat passes.
  await harness.keyTap('KeyJ');
  const one = await lp();
  evidence.one = one;
  const seatOneOk = one.turns === 1 && one.currentPlayer === 1 && one.scores[0]! > 0 && one.scores[1] === 0;
  await harness.keyTap('KeyJ');
  const two = await lp();
  evidence.two = two;
  const seatTwoOk = two.turns === 2 && two.currentPlayer === 0 && two.scores[1]! > 0;

  // Play the round out to a decided winner.
  for (let i = 0; i < 4; i++) await harness.keyTap('KeyJ');
  const done = await lp();
  evidence.done = done;
  const doneOk = done.turns === 6 && done.winner !== null && done.outcome === 'complete';
  await harness.keyTap('KeyJ');
  const after = await lp();
  const inertOk = after.turns === 6;

  const run = await restartRun(harness);
  const fresh = await lp();
  evidence.restart = { ...run, turns: fresh.turns, winner: fresh.winner, outcome: fresh.outcome };
  const restartOk = run.after === run.before + 1 && fresh.turns === 0 && fresh.winner === null && fresh.outcome === 'playing';

  const passed = startedOk && seatOneOk && seatTwoOk && doneOk && inertOk && restartOk;
  return { passed, details: { ...evidence, startedOk, seatOneOk, seatTwoOk, doneOk, inertOk, restartOk } };
}
