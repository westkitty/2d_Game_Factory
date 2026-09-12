import type { Harness } from '../src/harness.ts';
import { holdUntil, restartRun, shellReader, startPlay } from '../src/journey.ts';
import { readSnapshot } from '../src/snapshot.ts';
import type { SmokeOutcome } from '../src/smokeRunner.ts';

interface Narrative {
  readonly active: boolean;
  readonly mode: string | null;
  readonly seen: readonly string[];
  readonly choices: readonly string[];
  readonly nearId: string | null;
  readonly lastResult: string | null;
  readonly ending: string | null;
  readonly outcome: string;
  readonly boardEntries: readonly { readonly id: string; readonly unlocked: boolean }[];
  readonly links: readonly (readonly [string, string])[];
  readonly conclusion: string | null;
  readonly invalidAttempts: number;
}
interface Shell {
  readonly x: number;
  readonly y: number;
  readonly narrative?: Narrative;
}

export async function run(harness: Harness): Promise<SmokeOutcome> {
  const read = shellReader<Shell>(harness, 'game.top-down-shell');
  const evidence: Record<string, unknown> = {};
  await startPlay(harness, 12);
  const booted = await readSnapshot(harness);
  const initial = await read();
  evidence.initial = { x: initial.x, narrative: initial.narrative };
  const startedOk =
    booted.installedPacks.includes('sw2d.narrative') && booted.installedPacks.includes('sw2d.codex') &&
    initial.narrative?.mode === 'case' && initial.narrative.seen.length === 0 && initial.narrative.outcome === 'playing';

  // Inspecting with nothing in reach is refused; deducing at the desk before the clues is refused.
  await harness.keyTap('KeyJ');
  await harness.stepFrames(4);
  const tooFar = (await read()).narrative!;
  const tooFarOk = tooFar.lastResult === 'too-far';

  // Walk the scene: print, then photo, each recorded as seen (the codex entry).
  await holdUntil(harness, ['ArrowRight'], read, (s) => s.narrative?.nearId === 'print');
  await harness.keyTap('KeyJ');
  await harness.stepFrames(4);
  const print = (await read()).narrative!;
  await harness.keyTap('KeyJ');
  await harness.stepFrames(4);
  const printAgain = (await read()).narrative!;
  await holdUntil(harness, ['ArrowRight'], read, (s) => s.narrative?.nearId === 'photo');
  await harness.keyTap('KeyJ');
  await harness.stepFrames(4);
  const photo = (await read()).narrative!;
  evidence.print = print;
  evidence.photo = photo;
  const cluesOk = print.lastResult === 'inspected' && print.seen.includes('print') && printAgain.seen.length === 1 && photo.seen.includes('photo') && photo.seen.length === 2 && photo.outcome === 'playing';

  // At the desk, reject one authored false lead, then solve from the same evidence board.
  await holdUntil(harness, ['ArrowRight'], read, (s) => s.narrative?.nearId === 'desk');
  await harness.keyTap('KeyJ');
  await harness.stepFrames(4);
  const rejected = (await read()).narrative!;
  await harness.keyTap('KeyJ');
  await harness.stepFrames(4);
  const done = (await read()).narrative!;
  evidence.rejected = rejected;
  evidence.done = done;
  const rejectedOk = rejected.lastResult === 'invalid-deduction' && rejected.invalidAttempts === 1 && rejected.outcome === 'playing';
  const doneOk = done.lastResult === 'deduced' && done.ending === 'closed' && done.choices.includes('deduce') && done.outcome === 'complete' && done.links.length === 1 && done.conclusion?.includes('window') === true && done.boardEntries.every((entry) => entry.unlocked);

  const run = await restartRun(harness);
  const fresh = await read();
  evidence.restart = { ...run, narrative: fresh.narrative };
  const restartOk = run.after === run.before + 1 && fresh.narrative?.seen.length === 0 && fresh.narrative.ending === null && fresh.narrative.outcome === 'playing';

  const passed = startedOk && tooFarOk && cluesOk && rejectedOk && doneOk && restartOk;
  return { passed, details: { ...evidence, startedOk, tooFarOk, cluesOk, rejectedOk, doneOk, restartOk } };
}
