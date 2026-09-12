import type { Harness } from '../src/harness.ts';
import { restartRun, shellReader, startPlay } from '../src/journey.ts';
import { readSnapshot } from '../src/snapshot.ts';
import type { SmokeOutcome } from '../src/smokeRunner.ts';

interface Narrative {
  readonly mode: string | null;
  readonly nodeId: string | null;
  readonly flags: readonly string[];
  readonly choices: readonly string[];
  readonly lastResult: string | null;
  readonly ending: string | null;
  readonly outcome: string;
  readonly transcript: readonly string[];
  readonly lastCommand: string | null;
  readonly inputVisible: boolean;
}
interface Shell { readonly narrative?: Narrative }

async function command(harness: Harness, value: string): Promise<void> {
  const input = harness.page.locator('[data-sw2d-narrative-command="true"]');
  await input.fill(value);
  await input.press('Enter');
  await harness.stepFrames(2);
}

export async function run(harness: Harness): Promise<SmokeOutcome> {
  const read = shellReader<Shell>(harness, 'game.ui-simulation-shell');
  const n = async () => (await read()).narrative!;
  const evidence: Record<string, unknown> = {};
  await startPlay(harness, 12);
  const booted = await readSnapshot(harness);
  const initial = await n();
  evidence.initial = initial;
  const startedOk = booted.installedPacks.includes('sw2d.narrative') && initial.mode === 'fiction' && initial.nodeId === 'cabin' && initial.inputVisible && initial.outcome === 'playing';

  await command(harness, 'dance moon');
  const unknown = await n();
  await command(harness, 'take brass key');
  const blocked = await n();
  const rejectionOk = unknown.lastResult === 'unknown-verb' && blocked.lastResult === 'blocked' && blocked.outcome === 'playing';

  await command(harness, 'look at crumpled note');
  const looked = await n();
  await command(harness, 'take brass key');
  const took = await n();
  await command(harness, 'unlock door with brass key');
  const done = await n();
  evidence.journey = { unknown, blocked, looked, took, done };
  const grammarOk = looked.flags.includes('saw-note') && looked.lastCommand === 'look at crumpled note' && took.flags.includes('has-key');
  const doneOk = done.lastResult === 'matched' && done.ending === 'escaped' && done.outcome === 'complete' && done.choices.includes('unlock-door') && done.transcript.length >= 5;

  const run = await restartRun(harness);
  const fresh = await n();
  evidence.restart = { ...run, fresh };
  const restartOk = run.after === run.before + 1 && fresh.nodeId === 'cabin' && fresh.flags.length === 0 && fresh.ending === null && fresh.inputVisible;

  const passed = startedOk && rejectionOk && grammarOk && doneOk && restartOk;
  return { passed, details: { ...evidence, startedOk, rejectionOk, grammarOk, doneOk, restartOk } };
}
