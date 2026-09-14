import type { Harness } from '../src/harness.ts';
import { restartRun, shellReader, startPlay, waitUntil } from '../src/journey.ts';
import { readSnapshot } from '../src/snapshot.ts';
import type { SmokeOutcome } from '../src/smokeRunner.ts';

interface Strategy {
  readonly active: boolean;
  readonly fighter: string | null;
  readonly combatant: string | null;
  readonly cpuHealth: number;
  readonly lastResult: string | null;
  readonly outcome: string;
}
interface Shell {
  readonly strategy?: Strategy;
}

export async function run(harness: Harness): Promise<SmokeOutcome> {
  const read = shellReader<Shell>(harness, 'game.ui-simulation-shell');
  const st = async () => (await read()).strategy!;
  const evidence: Record<string, unknown> = {};
  await startPlay(harness, 8);
  const booted = await readSnapshot(harness);
  const initial = await st();
  const startedOk = booted.installedPacks.includes('sw2d.targeting') && initial.fighter === 'FOX' && initial.combatant === null;

  await harness.keyTap('Enter');
  const foxFight = await st();
  const foxOk = foxFight.combatant === 'fox' && foxFight.lastResult === 'fight';
  const foxDone = await waitUntil(harness, read, (s) => s.strategy?.outcome === 'complete', 160, 4);
  evidence.fox = { fight: foxFight, done: foxDone.strategy };
  const foxWin = foxDone.strategy?.outcome === 'complete' && foxDone.strategy.combatant === 'fox';

  const run = await restartRun(harness);
  const fresh = await st();
  await harness.keyTap('ArrowRight');
  const bearPick = await st();
  await harness.keyTap('Enter');
  const bearFight = await st();
  evidence.bear = { pick: bearPick.fighter, combatant: bearFight.combatant };
  const bearOk =
    run.after === run.before + 1 &&
    fresh.combatant === null &&
    bearPick.fighter === 'BEAR' &&
    bearFight.combatant === 'bear';

  const passed = startedOk && foxOk && foxWin && bearOk;
  return { passed, details: { ...evidence, startedOk, foxOk, foxWin, bearOk } };
}
