import type { Harness } from '../src/harness.ts';
import { restartRun, shellReader, startPlay, waitUntil } from '../src/journey.ts';
import type { SmokeOutcome } from '../src/smokeRunner.ts';

interface PhysicsToy { readonly active: boolean; readonly mode: string | null; readonly ballX: number; readonly ballY: number; readonly nudges: number; readonly props: number; readonly resets: number; readonly lastResult: string | null; readonly outcome: string }
interface Shell { readonly physicsPlay?: PhysicsToy }

export async function run(harness: Harness): Promise<SmokeOutcome> {
  const read = shellReader<Shell>(harness, 'game.pointer-shell');
  const toy = async () => (await read()).physicsPlay!;
  await startPlay(harness, 12);
  const initial = await toy();
  const startedOk = initial.active && initial.mode === 'toy' && initial.props >= 7 && initial.outcome === 'playing';
  await harness.keyTap('KeyJ');
  const launched = await toy();
  let done = await waitUntil(harness, toy, (state) => state.outcome === 'complete', 50, 4);
  for (let attempt = 0; attempt < 5 && done.outcome !== 'complete'; attempt++) {
    await harness.keyTap('KeyJ');
    done = await waitUntil(harness, toy, (state) => state.outcome === 'complete', 50, 4);
  }
  const journeyOk = launched.nudges === 1 && launched.lastResult === 'nudge' && done.ballX >= 740 && done.lastResult === 'goal';
  await harness.keyTap('KeyK'); await harness.stepFrames(4);
  const reset = await toy();
  const resetOk = reset.resets === 1 && reset.nudges === 0 && reset.outcome === 'playing' && reset.ballX === 220;
  const run = await restartRun(harness);
  const fresh = await toy();
  const restartOk = run.after === run.before + 1 && fresh.props >= 7 && fresh.resets === 0 && fresh.outcome === 'playing';
  return { passed: startedOk && journeyOk && resetOk && restartOk, details: { initial, launched, done, reset, fresh, startedOk, journeyOk, resetOk, restartOk } };
}
