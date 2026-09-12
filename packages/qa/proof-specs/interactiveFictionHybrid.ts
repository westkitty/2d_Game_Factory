import type { Harness } from '../src/harness.ts';
import { restartRun, shellReader, startPlay } from '../src/journey.ts';
import { readSnapshot } from '../src/snapshot.ts';
import type { SmokeOutcome } from '../src/smokeRunner.ts';

interface Narrative {
  readonly active: boolean;
  readonly mode: string | null;
  readonly nodeId: string | null;
  readonly selectedVerb: string | null;
  readonly flags: readonly string[];
  readonly seen: readonly string[];
  readonly choices: readonly string[];
  readonly lastResult: string | null;
  readonly ending: string | null;
  readonly outcome: string;
}
interface Shell {
  readonly narrative?: Narrative;
}

export async function run(harness: Harness): Promise<SmokeOutcome> {
  const read = shellReader<Shell>(harness, 'game.ui-simulation-shell');
  const n = async () => (await read()).narrative!;
  const evidence: Record<string, unknown> = {};
  await startPlay(harness, 12);
  const booted = await readSnapshot(harness);
  const initial = await n();
  evidence.initial = initial;
  const startedOk = booted.installedPacks.includes('sw2d.narrative') && initial.mode === 'fiction' && initial.nodeId === 'start' && initial.selectedVerb === 'LOOK' && initial.outcome === 'playing';

  // TAKE before LOOK is gated by a flag the story has not set yet.
  await harness.keyTap('ArrowRight');
  await harness.keyTap('Enter');
  const locked = await n();
  evidence.locked = { last: locked.lastResult, verb: locked.selectedVerb, node: locked.nodeId };
  const lockedOk = locked.lastResult === 'locked' && locked.selectedVerb === 'TAKE' && locked.outcome === 'playing';

  // LOOK sets the flag, records the seen entry and moves the node.
  await harness.keyTap('ArrowLeft');
  await harness.keyTap('Enter');
  const looked = await n();
  evidence.looked = { last: looked.lastResult, flags: looked.flags, seen: looked.seen, node: looked.nodeId };
  const lookOk = looked.lastResult === 'looked' && looked.flags.includes('saw-note') && looked.seen.includes('note') && looked.nodeId === 'looked';

  // Now TAKE succeeds and ends the story with the recorded choice.
  await harness.keyTap('ArrowRight');
  await harness.keyTap('Enter');
  const done = await n();
  evidence.done = { last: done.lastResult, ending: done.ending, choices: done.choices, outcome: done.outcome };
  const doneOk = done.lastResult === 'escaped' && done.ending === 'escaped' && done.choices.includes('take') && done.outcome === 'complete';

  const run = await restartRun(harness);
  const fresh = await n();
  evidence.restart = { ...run, node: fresh.nodeId, flags: fresh.flags, ending: fresh.ending };
  const restartOk = run.after === run.before + 1 && fresh.nodeId === 'start' && fresh.flags.length === 0 && fresh.ending === null;

  const passed = startedOk && lockedOk && lookOk && doneOk && restartOk;
  return { passed, details: { ...evidence, startedOk, lockedOk, lookOk, doneOk, restartOk } };
}
