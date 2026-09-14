import type { Harness } from '../src/harness.ts';
import { restartRun, shellReader, startPlay, waitUntil } from '../src/journey.ts';
import { readSnapshot } from '../src/snapshot.ts';
import type { SmokeOutcome } from '../src/smokeRunner.ts';

interface Economy {
  readonly active: boolean;
  readonly mode: string | null;
  readonly cash: number;
  readonly queue: readonly { id: string; goodId: string }[];
  readonly served: number;
  readonly lastResult: string | null;
  readonly frontWant: string | null;
  readonly walkers: readonly { id: string; x: number; y: number; phase: string }[];
  readonly payMultiplier: number;
  readonly prestigeLevel: number;
  readonly gold: number;
  readonly selectedId: string | null;
}
interface Shell {
  readonly economy?: Economy;
}

async function selectGood(harness: Harness, read: () => Promise<Shell>, goodId: string): Promise<void> {
  for (let i = 0; i < 6 && (await read()).economy?.selectedId !== goodId; i++) await harness.keyTap('ArrowRight');
}

export async function run(harness: Harness): Promise<SmokeOutcome> {
  const read = shellReader<Shell>(harness, 'game.ui-simulation-shell');
  const evidence: Record<string, unknown> = {};
  await startPlay(harness);
  const booted = await readSnapshot(harness);
  const approaching = await waitUntil(harness, read, (s) => (s.economy?.walkers.length ?? 0) >= 1, 40, 4);
  evidence.approaching = approaching.economy?.walkers[0];
  const walkOk =
    (approaching.economy?.walkers[0]?.phase === 'enter' || (approaching.economy?.queue.length ?? 0) >= 1) &&
    typeof approaching.economy?.walkers[0]?.x === 'number';

  const arrived = (await waitUntil(harness, read, (s) => (s.economy?.queue.length ?? 0) >= 1, 80, 4)).economy!;
  evidence.arrived = { want: arrived.frontWant, phase: arrived.walkers[0]?.phase, x: arrived.walkers[0]?.x };
  await selectGood(harness, read, arrived.frontWant!);
  await harness.keyTap('Enter');
  const served = (await read()).economy!;
  evidence.served = { served: served.served, cash: served.cash, last: served.lastResult };
  const serveOk = served.served >= 1 && served.cash > 12 && (served.lastResult === 'served' || served.served >= 1);

  const rich = await waitUntil(harness, read, (s) => (s.economy?.gold ?? 0) >= 16, 90, 4);
  await harness.keyTap('Backspace');
  const prestiged = (await read()).economy!;
  evidence.prestiged = { gold: rich.economy?.gold, level: prestiged.prestigeLevel, mult: prestiged.payMultiplier };
  const prestigeOk = prestiged.prestigeLevel >= 1 && prestiged.payMultiplier >= 2;

  const startedOk = booted.installedPacks.includes('sw2d.economy') && booted.installedPacks.includes('sw2d.simulation') && arrived.mode === 'shop';
  const run = await restartRun(harness);
  const fresh = (await read()).economy!;
  evidence.restart = { ...run, served: fresh.served, prestige: fresh.prestigeLevel };
  const restartOk = run.after === run.before + 1 && fresh.served === 0;

  const passed = startedOk && walkOk && serveOk && prestigeOk && restartOk;
  return { passed, details: { ...evidence, startedOk, walkOk, serveOk, prestigeOk, restartOk } };
}
