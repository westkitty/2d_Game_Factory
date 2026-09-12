import type { Harness } from '../src/harness.ts';
import { clickAt, restartRun, shellReader, startPlay, waitUntil } from '../src/journey.ts';
import { readSnapshot } from '../src/snapshot.ts';
import type { SmokeOutcome } from '../src/smokeRunner.ts';

interface Targeting {
  readonly active: boolean;
  readonly gold: number;
  readonly placed: number;
  readonly placementRejections: number;
  readonly towerDamage: number;
  readonly enemiesAlive: number;
  readonly outcome: string;
}
interface Shell {
  readonly targeting?: Targeting;
}

export async function run(harness: Harness): Promise<SmokeOutcome> {
  const read = shellReader<Shell>(harness, 'game.grid-shell');
  const evidence: Record<string, unknown> = {};
  await startPlay(harness, 12);
  const booted = await readSnapshot(harness);
  const initial = await read();
  evidence.initial = initial.targeting;
  const startedOk =
    booted.installedPacks.includes('sw2d.targeting') &&
    initial.targeting?.active === true &&
    (initial.targeting.placed ?? 1) === 0 &&
    (initial.targeting.gold ?? 0) >= 40;

  await clickAt(harness, 40, 40);
  const rejected = await read();
  evidence.rejected = rejected.targeting;
  const rejectedOk = (rejected.targeting?.placementRejections ?? 0) >= 1 && (rejected.targeting?.placed ?? 1) === 0;

  await clickAt(harness, 480, 200);
  const placed = await read();
  evidence.placed = placed.targeting;
  const placedOk = (placed.targeting?.placed ?? 0) >= 1 && (placed.targeting?.gold ?? 100) < (initial.targeting?.gold ?? 0);

  await harness.keyTap('KeyK');
  const upgraded = await read();
  evidence.upgraded = upgraded.targeting;
  const upgradedOk = (upgraded.targeting?.towerDamage ?? 0) >= 20;

  const cleared = await waitUntil(harness, read, (s) => s.targeting?.outcome === 'complete', 120, 4);
  evidence.cleared = cleared.targeting;
  const clearedOk = cleared.targeting?.outcome === 'complete';

  const run = await restartRun(harness);
  const fresh = await read();
  evidence.restart = { ...run, targeting: fresh.targeting };
  const restartOk = run.after === run.before + 1 && (fresh.targeting?.placed ?? 1) === 0 && fresh.targeting?.outcome === 'playing';

  const passed = startedOk && rejectedOk && placedOk && upgradedOk && clearedOk && restartOk;
  return { passed, details: { ...evidence, startedOk, rejectedOk, placedOk, upgradedOk, clearedOk, restartOk } };
}
