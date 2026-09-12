import type { Harness } from '../src/harness.ts';
import { clickAt, restartRun, shellReader, startPlay } from '../src/journey.ts';
import { readSnapshot } from '../src/snapshot.ts';
import type { SmokeOutcome } from '../src/smokeRunner.ts';

interface Dialogue {
  readonly mode: string | null;
  readonly kind: string;
  readonly flags: readonly string[];
  readonly ending: string | null;
  readonly outcome: string;
  readonly hotspots: readonly { readonly id: string; readonly locked: boolean }[];
  readonly scene: { readonly id: string; readonly background: string; readonly backgroundImage?: string } | null;
  readonly speakerPresentation: { readonly id: string; readonly portrait: string; readonly position: string } | null;
}
interface Shell { readonly dialogue?: Dialogue }

export async function run(harness: Harness): Promise<SmokeOutcome> {
  const read = shellReader<Shell>(harness, 'game.pointer-shell');
  const d = async () => (await read()).dialogue!;
  const evidence: Record<string, unknown> = {};
  await startPlay(harness, 10);
  const booted = await readSnapshot(harness);
  const initial = await d();
  const startedOk = booted.installedPacks.includes('sw2d.dialogue') && initial.mode === 'adventure' && initial.kind === 'idle' && initial.hotspots.find((h) => h.id === 'door')?.locked === true;

  await clickAt(harness, 240, 280);
  const note = await d();
  await harness.keyTap('Enter');
  await clickAt(harness, 480, 280);
  const clock = await d();
  await harness.keyTap('Enter');
  const unlocked = await d();
  evidence.authored = { note, clock, unlocked };
  const presentationOk = note.scene?.id === 'study' && note.scene.backgroundImage === 'study' && note.speakerPresentation?.portrait === 'detective-profile' && note.speakerPresentation.position === 'left';
  const flagsOk = unlocked.flags.includes('saw-note') && unlocked.flags.includes('saw-clock') && unlocked.hotspots.find((h) => h.id === 'door')?.locked === false;

  await clickAt(harness, 720, 280);
  await harness.keyTap('Enter');
  const done = await d();
  evidence.done = done;
  const doneOk = done.ending === 'escaped' && done.outcome === 'complete';

  const run = await restartRun(harness);
  const fresh = await d();
  const restartOk = run.after === run.before + 1 && fresh.kind === 'idle' && fresh.flags.length === 0 && fresh.outcome === 'playing';
  const passed = startedOk && presentationOk && flagsOk && doneOk && restartOk;
  return { passed, details: { ...evidence, startedOk, presentationOk, flagsOk, doneOk, restartOk } };
}
