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
 * Proof E - idle-incremental (see proofs/idle-incremental/PROOF_CONTRACT.md).
 *
 * Mirrors the reference demo's already-proven smoke journey, extended with
 * the stricter save/reload equality bar this deep proof requires.
 */
export async function run(harness: Harness): Promise<SmokeOutcome> {
  await harness.keyTap('Space'); // start run
  await harness.stepFrames(5);
  const spawnShell = await state(harness);
  // Gold starts producing the instant the scene installs, so by the time this first
  // sample is taken a few frames' worth has already accrued - "known" means
  // deterministic (proven by the tick-delta check below), not exactly zero.
  const startsAtZeroOk = spawnShell.currency === 0 && spawnShell.rateMultiplier === 1 && spawnShell.jobsCompleted === 0;

  // Deterministic production: equal elapsed frame-time yields equal gold deltas, before any upgrade.
  await harness.stepFrames(60);
  const afterTickA = await state(harness);
  await harness.stepFrames(60);
  const afterTickB = await state(harness);
  const deltaA = afterTickA.gold - spawnShell.gold;
  const deltaB = afterTickB.gold - afterTickA.gold;
  const deterministicProductionOk = deltaA > 0 && Math.abs(deltaA - deltaB) < 0.1;

  // Job/queue action, run twice to accumulate enough currency (10 each) for the upgrade (cost 20).
  const afterJob1 = await runOneJobCycle(harness);
  const afterJob2 = await runOneJobCycle(harness);
  const jobQueueOk =
    afterJob1.jobsCompleted === afterTickB.jobsCompleted + 1 &&
    afterJob2.jobsCompleted === afterTickB.jobsCompleted + 2 &&
    afterJob2.currency >= 20 &&
    !afterJob2.jobPending;

  // One upgrade: SECONDARY_ACTION spends currency, doubles the rate.
  await harness.keyTap('KeyK');
  const afterUpgrade = await state(harness);
  const upgradeSpendOk = afterUpgrade.currency === afterJob2.currency - 20 && afterUpgrade.rateMultiplier === 2;

  // The upgrade must change measurable behavior, not just a flag.
  await harness.stepFrames(60);
  const afterUpgradeTick = await state(harness);
  const upgradeAppliesOk = afterUpgradeTick.gold - afterUpgrade.gold > deltaA * 1.5;

  // Save, then a real browser reload (not an in-memory reset) - proves persistence
  // actually round-trips through storage, not just JS state.
  await harness.keyTap('Space'); // CONFIRM -> save
  const savedShell = await state(harness);

  const url = harness.page.url();
  await harness.gotoAndWaitForRuntime(url);
  await harness.keyTap('Space'); // start run again after reload
  await harness.stepFrames(3);
  const reloadedShell = await state(harness);

  const persistenceOk =
    reloadedShell.loadOutcome === 'loaded' &&
    // >= not ===: production resumes the instant the reloaded scene installs, so a
    // few post-reload frames legitimately add a little more before this sample.
    reloadedShell.gold >= savedShell.gold &&
    reloadedShell.currency === savedShell.currency &&
    reloadedShell.rateMultiplier === savedShell.rateMultiplier &&
    reloadedShell.jobsCompleted === savedShell.jobsCompleted;

  // Continue the simulation after reload - one more stepped interval still produces gold.
  await harness.stepFrames(60);
  const afterReloadTick = await state(harness);
  const continuesAfterReloadOk = afterReloadTick.gold > reloadedShell.gold;

  return {
    passed: startsAtZeroOk && deterministicProductionOk && jobQueueOk && upgradeSpendOk && upgradeAppliesOk && persistenceOk && continuesAfterReloadOk,
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
      afterReloadTick,
      startsAtZeroOk,
      deterministicProductionOk,
      jobQueueOk,
      upgradeSpendOk,
      upgradeAppliesOk,
      persistenceOk,
      continuesAfterReloadOk,
    },
  };
}
