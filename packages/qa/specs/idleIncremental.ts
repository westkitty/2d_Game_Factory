import { readShellState } from '../src/snapshot.ts';
import type { Harness } from '../src/harness.ts';
import type { SmokeOutcome } from '../src/smokeRunner.ts';

interface ShellSnap {
  readonly gold: number;
  readonly currency: number;
  readonly rateMultiplier: number;
  readonly jobsCompleted: number;
  readonly jobPending: boolean;
  readonly loadOutcome: string;
  readonly lastSaveOutcome: string;
}

function state(harness: Harness): Promise<ShellSnap> {
  return readShellState(harness, 'game.ui-simulation-shell');
}

async function runOneJobCycle(harness: Harness): Promise<ShellSnap> {
  await harness.keyTap('KeyJ'); // PRIMARY_ACTION -> queue job
  let sample = await state(harness);
  for (let i = 0; i < 40 && sample.jobPending; i++) {
    await harness.stepFrames(3);
    sample = await state(harness);
  }
  return sample;
}

/**
 * Smoke contract: deterministic production, job/queue action, one upgrade,
 * save/reload persistence. No canvas movement required.
 */
export async function run(harness: Harness): Promise<SmokeOutcome> {
  await harness.keyTap('Space'); // start run
  await harness.stepFrames(5);

  const spawnShell = await state(harness);

  // Deterministic production: equal elapsed frame-time yields equal gold
  // deltas, before any upgrade changes the rate.
  await harness.stepFrames(60);
  const afterTickA = await state(harness);
  await harness.stepFrames(60);
  const afterTickB = await state(harness);
  const deltaA = afterTickA.gold - spawnShell.gold;
  const deltaB = afterTickB.gold - afterTickA.gold;
  const deterministicProductionProven = deltaA > 0 && Math.abs(deltaA - deltaB) < 0.1;

  // Job/queue action, run twice to accumulate enough currency (10 each) for the upgrade (cost 20).
  const afterJob1 = await runOneJobCycle(harness);
  const afterJob2 = await runOneJobCycle(harness);
  const jobQueueProven = afterJob1.jobsCompleted === afterTickB.jobsCompleted + 1 && afterJob2.jobsCompleted === afterTickB.jobsCompleted + 2 && afterJob2.currency >= 20;

  // One upgrade: SECONDARY_ACTION spends currency, doubles the rate.
  await harness.keyTap('KeyK');
  const afterUpgrade = await state(harness);
  const upgradeSpendProven = afterUpgrade.currency === afterJob2.currency - 20 && afterUpgrade.rateMultiplier === 2;

  await harness.stepFrames(60);
  const afterUpgradeTick = await state(harness);
  const upgradeAppliesProven = afterUpgradeTick.gold - afterUpgrade.gold > deltaA * 1.5;

  // Save, then a real browser reload (not an in-memory reset) - proves
  // persistence actually round-trips through storage, not just JS state.
  await harness.keyTap('Space'); // CONFIRM -> save
  const savedShell = await state(harness);

  const url = harness.page.url();
  await harness.gotoAndWaitForRuntime(url);
  await harness.keyTap('Space'); // start run again after reload
  await harness.stepFrames(3);
  const reloadedShell = await state(harness);

  const persistenceProven =
    reloadedShell.loadOutcome === 'loaded' &&
    reloadedShell.gold >= savedShell.gold &&
    reloadedShell.currency === savedShell.currency &&
    reloadedShell.rateMultiplier === savedShell.rateMultiplier &&
    reloadedShell.jobsCompleted === savedShell.jobsCompleted;

  return {
    passed: deterministicProductionProven && jobQueueProven && upgradeSpendProven && upgradeAppliesProven && persistenceProven,
    details: {
      spawnShell,
      afterTickA,
      afterTickB,
      deltaA,
      deltaB,
      afterJob1,
      afterJob2,
      afterUpgrade,
      afterUpgradeTick,
      savedShell,
      reloadedShell,
      deterministicProductionProven,
      jobQueueProven,
      upgradeSpendProven,
      upgradeAppliesProven,
      persistenceProven,
    },
  };
}
