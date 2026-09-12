import type { Harness } from '../src/harness.ts';
import { restartRun, shellReader, startPlay } from '../src/journey.ts';
import { readSnapshot } from '../src/snapshot.ts';
import type { SmokeOutcome } from '../src/smokeRunner.ts';

interface Strategy {
  readonly selected: string | null;
  readonly moved: boolean;
  readonly acted: boolean;
  readonly lastResult: string | null;
  readonly gruntHp: number;
  readonly outcome: string;
}
interface Shell {
  readonly strategy?: Strategy;
}

export async function run(harness: Harness): Promise<SmokeOutcome> {
  const read = shellReader<Shell>(harness, 'game.grid-shell');
  const st = async () => (await read()).strategy!;
  const evidence: Record<string, unknown> = {};
  await startPlay(harness, 8);
  const booted = await readSnapshot(harness);
  const initial = await st();
  const startedOk = booted.installedPacks.includes('sw2d.strategy') && booted.installedPacks.includes('sw2d.targeting') && initial.outcome === 'playing';

  await harness.keyTap('KeyJ');
  const selected = await st();
  const selectedOk = selected.selected === 'scout' && selected.lastResult === 'selected';

  await harness.keyTap('ArrowRight');
  const moved = await st();
  const movedOk = moved.moved === true && moved.lastResult === 'moved';
  await harness.keyTap('ArrowRight');
  const spent = await st();
  const spentOk = spent.lastResult === 'spent';

  await harness.keyTap('Enter');
  const ended = await st();
  evidence.turn = { selected, moved, spent, ended };
  const endedOk = ended.lastResult === 'ended' || ended.lastResult === 'cpu-pass' || ended.lastResult === 'cpu-hit';

  const run = await restartRun(harness);
  const fresh = await st();
  const restartOk = run.after === run.before + 1 && fresh.moved === false && fresh.outcome === 'playing';

  const passed = startedOk && selectedOk && movedOk && spentOk && endedOk && restartOk;
  return { passed, details: { ...evidence, startedOk, selectedOk, movedOk, spentOk, endedOk, restartOk } };
}
