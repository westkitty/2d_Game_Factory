import type { Harness } from '../src/harness.ts';
import { holdUntil, restartRun, shellReader, startPlay, waitUntil } from '../src/journey.ts';
import { readSnapshot } from '../src/snapshot.ts';
import type { SmokeOutcome } from '../src/smokeRunner.ts';

interface Combat {
  readonly foesAlive: number;
  readonly baseHealth: number;
  readonly damage: number;
  readonly gold: number;
  readonly priority: string;
  readonly outcome: string;
  readonly lastResult: string | null;
}
interface Shell {
  readonly combat?: Combat;
}

export async function run(harness: Harness): Promise<SmokeOutcome> {
  const read = shellReader<Shell>(harness, 'game.top-down-shell');
  const evidence: Record<string, unknown> = {};
  await startPlay(harness, 12);
  const booted = await readSnapshot(harness);
  const initial = await read();
  const startedOk =
    booted.installedPacks.includes('sw2d.encounters') &&
    booted.installedPacks.includes('sw2d.targeting') &&
    initial.combat?.mode === 'hold' &&
    initial.combat.foesAlive === 2 &&
    initial.combat.baseHealth === 3;

  await harness.keyTap('KeyK');
  const upgraded = (await read()).combat!;
  const upgradedOk = upgraded.damage >= 2 && upgraded.lastResult === 'upgraded';
  await harness.keyTap('Backspace');
  const prio = (await read()).combat!;
  const prioOk = prio.priority === 'lowest' || prio.lastResult?.startsWith('priority-') === true;

  const atFirst = await holdUntil(harness, ['ArrowLeft'], read, (s) => Boolean(s.combat?.nearId));
  evidence.first = { at: atFirst.combat };
  let done = await read();
  for (let i = 0; i < 80 && done.combat?.outcome === 'playing'; i++) {
    if (done.combat?.nearId) {
      await harness.keyTap('KeyJ');
      await harness.stepFrames(10);
    } else {
      await harness.keyDown('ArrowLeft');
      await harness.stepFrames(8);
      await harness.keyUp('ArrowLeft');
    }
    done = await read();
  }
  evidence.done = done.combat;
  const doneOk = done.combat?.outcome === 'complete' || done.combat?.outcome === 'failed';

  const run = await restartRun(harness);
  const fresh = await read();
  const restartOk = run.after === run.before + 1 && fresh.combat?.foesAlive === 2 && fresh.combat.outcome === 'playing';

  const passed = startedOk && upgradedOk && prioOk && doneOk && restartOk;
  return { passed, details: { ...evidence, startedOk, upgradedOk, prioOk, doneOk, restartOk } };
}
