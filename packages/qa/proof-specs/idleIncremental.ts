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
  // Post-ten Phase 19 surface.
  readonly ore: number;
  readonly ingot: number;
  readonly economyJobs: number;
  readonly completedRecipes: readonly string[];
  readonly prestige: {
    readonly level: number;
    readonly multiplier: number;
    readonly eligible: boolean;
    readonly blockedBy: string | null;
  };
  readonly lastOffline: {
    readonly requestedMs: number;
    readonly appliedMs: number;
    readonly clamped: boolean;
    readonly jobsCompleted: number;
  } | null;
  readonly wallClockMs: number;
}

function evalControls<T>(harness: Harness, fnStr: string): Promise<T> {
  return harness.evaluate(`
    (() => {
      const c = window.__SW2D__.context.capabilities.require('game.idle-economy-controls');
      return (${fnStr})(c);
    })()
  `) as Promise<T>;
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
 *
 * Post-ten Phase 19 appends five steps to the end. The seven Phase-10 steps
 * above them are unchanged - the certified journey still has to pass exactly as
 * it did - and the new ones exercise the offline catch-up and prestige this
 * preset previously listed as "not production systems".
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

  // --- Post-ten Phase 19 ------------------------------------------------
  // The reload above wiped the economy back to its authored opening state, so
  // these steps start from a known shelf: 6 ore, 0 ingots.

  // 8. A production job consumes its inputs at the moment it starts, and
  //    produces its output once when it finishes - never on both ends.
  await evalControls(harness, `(c) => c.resetEconomy()`);
  await harness.stepFrames(2);
  const smeltStart = await evalControls<{ ok: boolean; consumed: { itemId: string; quantity: number }[] }>(
    harness,
    `(c) => c.startSmelt()`,
  );
  const midSmelt = await state(harness);
  await harness.stepFrames(70); // ~1167ms, past the authored 1000ms
  const afterSmelt = await state(harness);
  const productionOk =
    smeltStart.ok === true &&
    smeltStart.consumed[0]?.quantity === 2 &&
    midSmelt.ore === 4 && // taken at start
    midSmelt.ingot === 0 &&
    afterSmelt.ore === 4 && // never taken again
    afterSmelt.ingot === 1 &&
    afterSmelt.completedRecipes.filter((id) => id === 'smelt').length === 1;

  // 9. Offline catch-up aggregates whole batches against the injected wall
  //    clock. The document credits 50% efficiency, so 4000ms away buys 2000ms
  //    of work: the in-flight batch plus exactly one more.
  await evalControls(harness, `(c) => c.resetEconomy()`);
  await harness.stepFrames(2);
  await evalControls(harness, `(c) => c.startSmelt()`);
  const trip = await evalControls<{ requestedMs: number; appliedMs: number; clamped: boolean; jobsCompleted: number }>(
    harness,
    `(c) => c.goOffline(4000)`,
  );
  const afterTrip = await state(harness);
  const offlineCatchUpOk =
    trip.requestedMs === 4000 &&
    trip.appliedMs === 4000 &&
    trip.clamped === false &&
    trip.jobsCompleted === 2 &&
    afterTrip.ingot === 2 &&
    afterTrip.ore === 2 && // 6 - 2 (start) - 2 (the second batch paid for itself)
    afterTrip.economyJobs === 0;

  // 10. The absence is bounded: a very long trip is clamped to the authored
  //     maximum and says so, and a clock that moved backwards credits nothing.
  await evalControls(harness, `(c) => c.resetEconomy()`);
  await harness.stepFrames(2);
  await evalControls(harness, `(c) => c.startSmelt()`);
  const longTrip = await evalControls<{ requestedMs: number; appliedMs: number; clamped: boolean }>(
    harness,
    `(c) => c.goOffline(86400000)`,
  );
  const backwards = await evalControls<{ appliedMs: number; jobsCompleted: number }>(
    harness,
    `(c) => c.goOffline(-3600000)`,
  );
  const offlineBoundedOk =
    longTrip.requestedMs === 86_400_000 &&
    longTrip.appliedMs === 20_000 && // the authored cap
    longTrip.clamped === true &&
    backwards.appliedMs === 0 &&
    backwards.jobsCompleted === 0;

  // 11. Prestige is gated on the authored condition, resets what it declares,
  //     and grants its reward after the currency wipe so the reward survives.
  await evalControls(harness, `(c) => c.resetEconomy()`);
  await harness.stepFrames(2);
  const blocked = await evalControls<{ ok: boolean; reason: string }>(harness, `(c) => c.prestige()`);
  await evalControls(harness, `(c) => c.startSmelt()`);
  const earned = await evalControls<{ jobsCompleted: number }>(harness, `(c) => c.goOffline(8000)`);
  const beforePrestige = await state(harness);
  const promoted = await evalControls<{ ok: boolean; level: number; multiplier: number; grantedCurrency: number }>(
    harness,
    `(c) => c.prestige()`,
  );
  const afterPrestige = await state(harness);
  const prestigeOk =
    blocked.ok === false &&
    blocked.reason === 'not-eligible' &&
    beforePrestige.ingot >= 3 && // the authored eligibility now holds
    beforePrestige.prestige.eligible === true &&
    promoted.ok === true &&
    promoted.level === 1 &&
    promoted.multiplier === 3 && // 1 + 1 x the authored multiplierPerLevel of 2
    afterPrestige.ore === 6 && // goods-stock reset to the authored opening
    afterPrestige.ingot === 0 &&
    afterPrestige.currency === 40; // wiped, then granted the reward

  // 12. The prestige multiplier is load-bearing: the same recipe now finishes
  //     in a third of the frames the authored duration would take.
  await evalControls(harness, `(c) => c.startSmelt()`);
  await harness.stepFrames(24); // ~400ms - well under the authored 1000ms
  const sped = await state(harness);
  const multiplierAppliesOk = sped.ingot === 1 && sped.completedRecipes.includes('smelt');

  return {
    passed:
      startsAtZeroOk &&
      deterministicProductionOk &&
      jobQueueOk &&
      upgradeSpendOk &&
      upgradeAppliesOk &&
      persistenceOk &&
      continuesAfterReloadOk &&
      productionOk &&
      offlineCatchUpOk &&
      offlineBoundedOk &&
      prestigeOk &&
      multiplierAppliesOk,
    details: {
      smeltStart,
      midSmelt,
      afterSmelt,
      trip,
      afterTrip,
      longTrip,
      backwards,
      blocked,
      earned,
      beforePrestige,
      promoted,
      afterPrestige,
      sped,
      productionOk,
      offlineCatchUpOk,
      offlineBoundedOk,
      prestigeOk,
      multiplierAppliesOk,
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
