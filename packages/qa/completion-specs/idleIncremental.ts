import type { Harness } from '../src/harness.ts';
import { restartRun, shellReader, startPlay, waitUntil } from '../src/journey.ts';
import { readSnapshot } from '../src/snapshot.ts';
import type { SmokeOutcome } from '../src/smokeRunner.ts';

interface Simulation {
  readonly active: boolean;
  readonly mode: string | null;
  readonly gold: number;
  readonly goldLabel: string;
  readonly currency: number;
  readonly rate: number;
  readonly prestigeLevel: number;
  readonly prestigeMultiplier: number;
  readonly lastResult: string | null;
  readonly outcome: string;
  readonly jobCount: number;
}
interface Shell {
  readonly simulation?: Simulation;
}

export async function run(harness: Harness): Promise<SmokeOutcome> {
  const read = shellReader<Shell>(harness, 'game.ui-simulation-shell');
  const sim = async () => (await read()).simulation!;
  const evidence: Record<string, unknown> = {};
  await startPlay(harness, 12);
  const booted = await readSnapshot(harness);
  const initial = await sim();
  evidence.initial = { mode: initial.mode, gold: initial.gold, rate: initial.rate };
  const startedOk =
    booted.installedPacks.includes('sw2d.simulation') && initial.mode === 'idle' && initial.prestigeLevel === 0;

  await harness.stepFrames(60);
  const ticking = await sim();
  evidence.ticking = { gold: ticking.gold, label: ticking.goldLabel };
  const tickOk = ticking.gold > initial.gold && ticking.goldLabel.length >= 1;

  await harness.keyTap('KeyJ');
  const gathering = await sim();
  const gatherOk = gathering.lastResult === 'gathering' || gathering.jobCount >= 1;
  await waitUntil(harness, read, (s) => (s.simulation?.currency ?? 0) >= 10, 40, 4);
  await harness.keyTap('KeyJ');
  await waitUntil(harness, read, (s) => (s.simulation?.currency ?? 0) >= 20, 40, 4);
  await harness.keyTap('KeyK');
  const upgraded = await sim();
  evidence.upgraded = { currency: upgraded.currency, rate: upgraded.rate, last: upgraded.lastResult };
  const upgradeOk = upgraded.lastResult === 'upgraded' && upgraded.rate > ticking.rate;

  const rich = await waitUntil(harness, read, (s) => (s.simulation?.gold ?? 0) >= 16, 90, 4);
  await harness.keyTap('Backspace');
  const prestiged = await sim();
  evidence.prestiged = { gold: prestiged.gold, level: prestiged.prestigeLevel, outcome: prestiged.outcome, before: rich.simulation?.gold };
  const prestigeOk = prestiged.prestigeLevel >= 1 && prestiged.prestigeMultiplier >= 2 && prestiged.gold < 16;

  const run = await restartRun(harness);
  const fresh = await sim();
  evidence.restart = { ...run, gold: fresh.gold, level: fresh.prestigeLevel, mode: fresh.mode };
  const restartOk = run.after === run.before + 1 && fresh.mode === 'idle' && fresh.prestigeLevel >= 1;

  await harness.evaluate(() => {
    const key = Object.keys(localStorage).find((entry) => entry.includes(':simulation'));
    if (!key) return;
    const raw = localStorage.getItem(key);
    if (!raw) return;
    const parsed = JSON.parse(raw) as { lastSeenWallClockMs?: number };
    parsed.lastSeenWallClockMs = Date.now() - 4000;
    localStorage.setItem(key, JSON.stringify(parsed));
  });
  const url = harness.page.url();
  await harness.gotoAndWaitForRuntime(url);
  await startPlay(harness, 8);
  const afterOffline = await sim();
  evidence.offline = { gold: afterOffline.gold, level: afterOffline.prestigeLevel };
  const offlineOk = afterOffline.gold > 8 && afterOffline.prestigeLevel >= 1;

  const passed = startedOk && tickOk && gatherOk && upgradeOk && prestigeOk && restartOk && offlineOk;
  return {
    passed,
    details: { ...evidence, startedOk, tickOk, gatherOk, upgradeOk, prestigeOk, restartOk, offlineOk },
  };
}
