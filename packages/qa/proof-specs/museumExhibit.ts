import type { Harness } from '../src/harness.ts';
import { holdUntil, restartRun, shellReader, startPlay } from '../src/journey.ts';
import { readSnapshot } from '../src/snapshot.ts';
import type { SmokeOutcome } from '../src/smokeRunner.ts';

interface Look {
  readonly active: boolean;
  readonly mode: string | null;
  readonly inspected: number;
  readonly nearId: string | null;
  readonly lastResult: string | null;
  readonly outcome: string;
  readonly entries: readonly { readonly id: string; readonly title: string; readonly image: string | null; readonly portrait: string | null; readonly spotlightColor: string | null; readonly inspected: boolean }[];
  readonly inspection: { readonly id: string; readonly title: string; readonly body: string; readonly image: string | null; readonly portrait: string | null } | null;
  readonly spotlightVisible: boolean;
  readonly vignetteVisible: boolean;
  readonly tourProgress: string;
}
interface Shell {
  readonly x: number;
  readonly look?: Look;
}

export async function run(harness: Harness): Promise<SmokeOutcome> {
  const read = shellReader<Shell>(harness, 'game.top-down-shell');
  const evidence: Record<string, unknown> = {};
  await startPlay(harness, 12);
  const booted = await readSnapshot(harness);
  const initial = await read();
  evidence.initial = { x: initial.x, look: initial.look };
  const startedOk = booted.installedPacks.includes('sw2d.codex') && initial.look?.mode === 'museum' && initial.look.inspected === 0 && initial.look.entries.length === 2 && initial.look.entries.every((entry) => entry.image && entry.portrait && entry.spotlightColor) && initial.look.outcome === 'playing';

  // Reading with no plaque in reach is refused.
  await harness.keyTap('KeyJ');
  await harness.stepFrames(4);
  const tooFar = (await read()).look!;
  const tooFarOk = tooFar.lastResult === 'too-far' && tooFar.inspected === 0;

  // Walk to the plinth, read it; reading it twice is one codex entry.
  const atPlinth = await holdUntil(harness, ['ArrowRight'], read, (s) => s.look?.nearId === 'plinth');
  await harness.keyTap('KeyJ');
  await harness.stepFrames(4);
  const one = (await read()).look!;
  await harness.keyTap('KeyJ');
  await harness.stepFrames(4);
  const oneAgain = (await read()).look!;
  evidence.plinth = { x: atPlinth.x, look: one, again: oneAgain.inspected };
  const plinthOk = atPlinth.look?.nearId === 'plinth' && one.inspected === 1 && one.lastResult === 'inspected-plinth' && oneAgain.inspected === 1 && one.outcome === 'playing' && one.inspection?.id === 'plinth' && one.inspection.title === 'Moon Vessel' && one.spotlightVisible && one.vignetteVisible && one.tourProgress === '1/2';

  // The bust completes the exhibit.
  const atBust = await holdUntil(harness, ['ArrowRight'], read, (s) => s.look?.nearId === 'bust');
  await harness.keyTap('KeyJ');
  await harness.stepFrames(6);
  const done = (await read()).look!;
  evidence.done = { x: atBust.x, look: done };
  const doneOk = atBust.look?.nearId === 'bust' && done.inspected === 2 && done.lastResult === 'read' && done.outcome === 'complete' && done.inspection?.id === 'bust' && done.tourProgress === '2/2';

  const run = await restartRun(harness);
  const fresh = await read();
  evidence.restart = { ...run, x: fresh.x, look: fresh.look };
  const restartOk = run.after === run.before + 1 && fresh.look?.inspected === 0 && fresh.look.outcome === 'playing' && fresh.x === initial.x;

  const passed = startedOk && tooFarOk && plinthOk && doneOk && restartOk;
  return { passed, details: { ...evidence, startedOk, tooFarOk, plinthOk, doneOk, restartOk } };
}
