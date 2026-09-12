import type { Harness } from '../src/harness.ts';
import { restartRun, shellReader, startPlay } from '../src/journey.ts';
import { readSnapshot } from '../src/snapshot.ts';
import type { SmokeOutcome } from '../src/smokeRunner.ts';

interface Dialogue {
  readonly active: boolean;
  readonly mode: string | null;
  readonly kind: string;
  readonly step: number;
  readonly selectedIndex: number;
  readonly branch: string | null;
  readonly ending: string | null;
  readonly outcome: string;
  readonly flags: readonly string[];
  readonly lastResult: string | null;
}
interface Shell {
  readonly dialogue?: Dialogue;
}

export async function run(harness: Harness): Promise<SmokeOutcome> {
  const read = shellReader<Shell>(harness, 'game.ui-simulation-shell');
  const d = async () => (await read()).dialogue!;
  const evidence: Record<string, unknown> = {};
  await startPlay(harness);
  const booted = await readSnapshot(harness);
  const initial = await d();
  evidence.initial = initial;
  const startedOk = booted.installedPacks.includes('sw2d.dialogue') && initial.active && initial.mode === 'novel' && initial.step === 0;

  // Advance two lines; the third node is a choice with two options.
  await harness.keyTap('Space');
  await harness.keyTap('Space');
  const choice = await d();
  evidence.choice = choice;
  const choiceOk = choice.kind === 'choice' && choice.step === 2 && choice.selectedIndex === 0;

  // Pick the second option -> its branch; play to the branch ending.
  await harness.keyTap('ArrowRight');
  const moved = await d();
  await harness.keyTap('Space');
  const branched = await d();
  await harness.keyTap('Space');
  const midnight = await d();
  evidence.branched = branched;
  evidence.midnight = { ending: midnight.ending, outcome: midnight.outcome, flags: midnight.flags };
  const branchOk = moved.selectedIndex === 1 && branched.branch === 'keep-the-secret';
  const endingOk = midnight.ending === 'midnight-ending' && midnight.outcome === 'complete';

  // Advancing past the ending is inert.
  await harness.keyTap('Space');
  const still = await d();
  const inertOk = still.ending === 'midnight-ending' && still.outcome === 'complete';

  // Restart reinstalls the graph at step 0; the other branch reaches the other ending.
  const run = await restartRun(harness);
  const fresh = await d();
  evidence.restart = { ...run, step: fresh.step, ending: fresh.ending, outcome: fresh.outcome };
  const restartOk = run.after === run.before + 1 && fresh.step === 0 && fresh.ending === null && fresh.outcome === 'playing';
  await harness.keyTap('Space');
  await harness.keyTap('Space');
  await harness.keyTap('ArrowLeft');
  await harness.keyTap('Space');
  await harness.keyTap('Space');
  const dawn = await d();
  evidence.dawn = { branch: dawn.branch, ending: dawn.ending, outcome: dawn.outcome };
  const otherBranchOk = dawn.ending === 'dawn-ending' && dawn.outcome === 'complete' && dawn.branch !== branched.branch;

  const passed = startedOk && choiceOk && branchOk && endingOk && inertOk && restartOk && otherBranchOk;
  return { passed, details: { ...evidence, startedOk, choiceOk, branchOk, endingOk, inertOk, restartOk, otherBranchOk } };
}
