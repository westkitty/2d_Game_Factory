import { readShellState, readSnapshot } from '../src/snapshot.ts';
import type { Harness } from '../src/harness.ts';
import type { SmokeOutcome } from '../src/smokeRunner.ts';
import type { ShopShellState } from '../../proofs/shopkeeper/src/game-specific/shellPack.ts';

const SHELL_ID = 'game.shop-shell';

const state = (h: Harness): Promise<ShopShellState> => readShellState(h, SHELL_ID);

function evalShell<T>(harness: Harness, fnStr: string): Promise<T> {
  return harness.evaluate(`
    (() => {
      const shell = window.__SW2D__.context.capabilities.require('${SHELL_ID}');
      return (${fnStr})(shell);
    })()
  `) as Promise<T>;
}

async function stepUntil(
  harness: Harness,
  predicate: (s: ShopShellState) => boolean,
  budgetFrames = 600,
): Promise<ShopShellState> {
  let current = await state(harness);
  let stepped = 0;
  while (!predicate(current) && stepped < budgetFrames) {
    await harness.stepFrames(4);
    stepped += 4;
    current = await state(harness);
  }
  return current;
}

const goodOf = (s: ShopShellState, itemId: string) => s.goods.find((good) => good.itemId === itemId)!;
const stationOf = (s: ShopShellState, id: string) => s.stations.find((station) => station.id === id)!;
const phasesFor = (s: ShopShellState, customerId: string) =>
  s.phaseLog.filter((entry) => entry.startsWith(`${customerId}:`)).map((entry) => entry.split(':')[1]);

export async function run(harness: Harness): Promise<SmokeOutcome> {
  const evidence: Record<string, unknown> = {};
  await harness.keyTap('Space');
  await harness.stepFrames(8);

  // 1. Boot: the pack is installed and the shelf holds exactly what the document
  //    authored - three goods, at their authored stock, capacity and prices.
  const snap = await readSnapshot(harness);
  const s1 = await state(harness);
  evidence.boot = { goods: s1.goods, funds: s1.funds, stations: s1.stations };
  const step1_boot =
    snap.scene === 'sw2d.play' &&
    snap.installedPacks.includes('sw2d.economy') &&
    s1.goods.map((good) => good.itemId).join(',') === 'apple,cider,pie' &&
    goodOf(s1, 'apple').stock === 8 &&
    goodOf(s1, 'apple').capacity === 12 &&
    goodOf(s1, 'apple').unitSellPrice === 5 &&
    goodOf(s1, 'apple').unitBuyPrice === 2 &&
    // The shop's funds are progression's currency, seeded from game.json.
    s1.funds === 60;

  // 2. A sale moves stock one way and money the other, in one indivisible step.
  const sale = await evalShell<{ ok: boolean; total: number; stockAfter: number; shopFundsAfter: number }>(
    harness,
    `(s) => s.sell('apple', 2, 50)`,
  );
  const s2 = await state(harness);
  evidence.sale = { sale, apple: goodOf(s2, 'apple'), funds: s2.funds };
  const step2_sale =
    sale.ok === true &&
    sale.total === 10 &&
    goodOf(s2, 'apple').stock === 6 &&
    s2.funds === 70 &&
    s2.transactions.filter((entry) => entry.ok).length === 1;

  // 3. A refused sale changes nothing at all - not a partial fill, not a
  //    half-charged buyer, and no transaction on the record.
  const refused = await evalShell<{ ok: boolean; reason: string }>(harness, `(s) => s.sell('apple', 99, 9999)`);
  const broke = await evalShell<{ ok: boolean; reason: string }>(harness, `(s) => s.sell('apple', 1, 0)`);
  const s3 = await state(harness);
  evidence.refused = { refused, broke, apple: goodOf(s3, 'apple'), funds: s3.funds };
  const step3_refusedIsAtomic =
    refused.ok === false &&
    refused.reason === 'insufficient-stock' &&
    broke.ok === false &&
    broke.reason === 'insufficient-funds' &&
    goodOf(s3, 'apple').stock === 6 &&
    s3.funds === 70 &&
    s3.transactions.filter((entry) => entry.ok).length === 1; // still just the one

  // 4. Demand scales what a customer pays and leaves what a supplier charges
  //    alone, and a restock spends the shop's own money at the buy price.
  await evalShell(harness, `(s) => s.setDemand('apple', 2)`);
  const restock = await evalShell<{ ok: boolean; total: number; quantity: number }>(
    harness,
    `(s) => s.restock('apple')`,
  );
  const s4 = await state(harness);
  evidence.demand = { restock, apple: goodOf(s4, 'apple'), funds: s4.funds };
  const step4_demandAndRestock =
    goodOf(s4, 'apple').unitSellPrice === 10 &&
    goodOf(s4, 'apple').unitBuyPrice === 2 && // demand did not move the supplier
    restock.quantity === 4 && // the authored restockQuantity
    restock.total === 8 &&
    goodOf(s4, 'apple').stock === 10 &&
    s4.funds === 62;
  await evalShell(harness, `(s) => s.setDemand('apple', 1)`);

  // 5. A restock beyond shelf capacity is refused whole rather than topped up.
  const overflow = await evalShell<{ ok: boolean; reason: string }>(harness, `(s) => s.restock('apple', 9)`);
  const s5 = await state(harness);
  evidence.overflow = { overflow, apple: goodOf(s5, 'apple') };
  const step5_capacity =
    overflow.ok === false && overflow.reason === 'insufficient-capacity' && goodOf(s5, 'apple').stock === 10;

  // 6. Production consumes its inputs at the moment the job starts, and produces
  //    its outputs exactly once when it finishes - never on both ends.
  const started = await evalShell<{ ok: boolean; jobId: string; consumed: { itemId: string; quantity: number }[] }>(
    harness,
    `(s) => s.startJob('bake-pie')`,
  );
  const mid = await state(harness);
  const baked = await stepUntil(harness, (s) => s.completedJobs.includes('bake-pie'));
  evidence.production = {
    started,
    appleAtStart: goodOf(mid, 'apple').stock,
    appleAfter: goodOf(baked, 'apple').stock,
    pie: goodOf(baked, 'pie'),
  };
  const step6_consumeAtStart =
    started.ok === true &&
    started.consumed.length === 1 &&
    started.consumed[0]!.quantity === 3 &&
    goodOf(mid, 'apple').stock === 7 && // taken immediately
    goodOf(mid, 'pie').stock === 0 && // and nothing produced yet
    goodOf(baked, 'apple').stock === 7 && // never taken a second time
    goodOf(baked, 'pie').stock === 1 &&
    baked.completedJobs.filter((id) => id === 'bake-pie').length === 1 &&
    baked.jobs.length === 0;

  // 7. A cancelled job refunds exactly what it took and produces nothing, even
  //    when it was cancelled a hair before finishing.
  const second = await evalShell<{ jobId: string }>(harness, `(s) => s.startJob('bake-pie')`);
  const beforeCancel = await state(harness);
  const cancelled = await evalShell<boolean>(harness, `(s) => s.cancelJob('${second.jobId}')`);
  await harness.stepFrames(120);
  const s7 = await state(harness);
  evidence.cancel = { cancelled, before: goodOf(beforeCancel, 'apple').stock, after: goodOf(s7, 'apple').stock };
  const step7_cancelRefunds =
    cancelled === true &&
    goodOf(beforeCancel, 'apple').stock === 4 &&
    goodOf(s7, 'apple').stock === 7 && // the 3 apples came back
    goodOf(s7, 'pie').stock === 1 && // and no second pie appeared
    s7.jobs.length === 0;

  // 8. A locked recipe stays locked until its authored flag exists.
  const lockedStart = await evalShell<{ ok: boolean; reason: string }>(
    harness,
    `(s) => s.startJob('press-cider')`,
  );
  const s8 = await state(harness);
  evidence.locked = { lockedStart, unlocked: s8.unlocked };
  const step8_locked =
    s8.unlocked['bake-pie'] === true &&
    s8.unlocked['press-cider'] === false &&
    lockedStart.ok === false &&
    lockedStart.reason === 'locked';

  // 9. Placement is validated against the authored zones, not merely recorded:
  //    outside the buildable zone, overlapping, and unreachable each fail by name.
  const outside = await evalShell<{ ok: boolean; reason: string }>(harness, `(s) => s.canPlace('oven', 100, 100)`);
  const unreachable = await evalShell<{ ok: boolean; reason: string }>(harness, `(s) => s.canPlace('oven', 6, 3)`);
  const placedOven = await evalShell<{ ok: boolean }>(harness, `(s) => s.place('oven', 6, 9)`);
  const overlapping = await evalShell<{ ok: boolean; reason: string }>(harness, `(s) => s.canPlace('press', 7, 9)`);
  const clear = await evalShell<{ ok: boolean }>(harness, `(s) => s.place('press', 14, 9)`);
  const s9 = await state(harness);
  evidence.placement = { outside, unreachable, placedOven, overlapping, clear, stations: s9.stations };
  const step9_placement =
    outside.ok === false &&
    outside.reason === 'outside-zone' &&
    // The oven declares an access point 3 below its centre; at y=3 that lands on
    // the back-room floor, which is buildable but is not somewhere to stand.
    unreachable.ok === false &&
    unreachable.reason === 'inaccessible' &&
    placedOven.ok === true &&
    overlapping.ok === false &&
    overlapping.reason === 'overlaps-station' &&
    clear.ok === true &&
    stationOf(s9, 'oven').position !== null &&
    stationOf(s9, 'press').position !== null;

  // 10. A customer walks the whole authored flow in order and buys something.
  //     The shell never moved them between phases - it only recorded what the
  //     capability announced.
  await evalShell(harness, `(s) => s.reset()`);
  await harness.stepFrames(4);
  await evalShell(harness, `(s) => s.spawn('regular', 'walker')`);
  const shopped = await stepUntil(harness, (s) => s.departures.some((entry) => entry.startsWith('walker:')));
  evidence.flow = { phases: phasesFor(shopped, 'walker'), departures: shopped.departures, apple: goodOf(shopped, 'apple') };
  const step10_customerFlow =
    phasesFor(shopped, 'walker').join(',') === 'arrive,choose-target,navigate,queue,service,transaction,leave' &&
    shopped.departures.includes('walker:purchased') &&
    goodOf(shopped, 'apple').stock === 7; // the sale really happened

  // 11. The queue is strictly FIFO with one service slot: three customers reach
  //     the till in the order they joined, whoever arrived when.
  //
  //     The ids are deliberately in *reverse* alphabetical order of arrival.
  //     The economy iterates customers by ascending id so a frame is
  //     reproducible, and with ids that happen to sort in join order this step
  //     would pass even if the queue promoted whoever it reached first.
  await evalShell(harness, `(s) => s.reset()`);
  await harness.stepFrames(4);
  await evalShell(harness, `(s) => s.spawn('gourmet', 'zoe')`);
  await harness.stepFrames(12);
  await evalShell(harness, `(s) => s.spawn('regular', 'mia')`);
  await harness.stepFrames(12);
  await evalShell(harness, `(s) => s.spawn('regular', 'ada')`);
  await stepUntil(harness, (s) => s.departures.length >= 3, 900);
  // A customer in `leave` is cleared on the following frame, so step once more
  // before asserting the shop is actually empty.
  await harness.stepFrames(4);
  const queued = await state(harness);
  const servedOrder = queued.phaseLog
    .filter((entry) => entry.endsWith(':service'))
    .map((entry) => entry.split(':')[0]);
  evidence.queue = { servedOrder, departures: queued.departures, queues: queued.queues };
  const step11_fifo =
    // Join order, not id order - which would be ada,mia,zoe.
    servedOrder.join(',') === 'zoe,mia,ada' &&
    // Nobody is left holding a waiting place or a service slot once all have gone.
    queued.queues.every((queue) => queue.waiting.length === 0 && queue.serving.length === 0) &&
    queued.customers.length === 0;

  // 12. An arrival beyond the queue's authored capacity leaves rather than
  //     waiting invisibly - the shop can be genuinely too busy.
  await evalShell(harness, `(s) => s.reset()`);
  await harness.stepFrames(4);
  await evalShell(harness, `(s) => { s.spawn('gourmet', 'q1'); s.spawn('gourmet', 'q2'); s.spawn('gourmet', 'q3'); s.spawn('gourmet', 'q4'); }`);
  const overfull = await stepUntil(harness, (s) => s.departures.some((entry) => entry.endsWith(':queue-full')), 400);
  evidence.queueFull = { departures: overfull.departures, queues: overfull.queues };
  const step12_queueCapacity =
    overfull.departures.filter((entry) => entry.endsWith(':queue-full')).length === 1 &&
    overfull.queues[0]!.waiting.length + overfull.queues[0]!.serving.length <= 3;

  // 13. Patience runs out while walking and waiting, and the customer leaves
  //     cleanly: no orphaned queue place, and everyone behind still gets served.
  await evalShell(harness, `(s) => s.reset()`);
  await harness.stepFrames(4);
  await evalShell(harness, `(s) => s.spawn('gourmet', 'patient')`);
  // Arrive behind someone already at the counter. Spawned together, the hurried
  // customer would simply be served first and never wait at all.
  await harness.stepFrames(12);
  await evalShell(harness, `(s) => s.spawn('impatient', 'hasty')`);
  await stepUntil(harness, (s) => s.departures.length >= 2, 900);
  await harness.stepFrames(4);
  const impatient = await state(harness);
  evidence.patience = { departures: impatient.departures, queues: impatient.queues };
  const step13_patience =
    impatient.departures.includes('hasty:impatient') &&
    impatient.departures.includes('patient:purchased') &&
    impatient.queues.every((queue) => queue.waiting.length === 0 && queue.serving.length === 0);

  // 14. Out-of-stock and unaffordable are different facts, and the capability
  //     reports which one actually happened.
  await evalShell(harness, `(s) => s.reset()`);
  await harness.stepFrames(4);
  await evalShell(harness, `(s) => s.spawn('window-shopper', 'empty-shelf')`);
  const emptyShelf = await stepUntil(harness, (s) => s.departures.some((entry) => entry.startsWith('empty-shelf:')));
  await evalShell(harness, `(s) => s.restock('pie', 2)`);
  await evalShell(harness, `(s) => s.spawn('window-shopper', 'too-dear')`);
  const tooDear = await stepUntil(harness, (s) => s.departures.some((entry) => entry.startsWith('too-dear:')));
  evidence.outcomes = { departures: tooDear.departures, pie: goodOf(tooDear, 'pie') };
  const step14_outcomesAreDistinct =
    emptyShelf.departures.includes('empty-shelf:out-of-stock') &&
    // Same customer, same 1-coin budget - the only thing that changed is that
    // the pie now exists, and the reported reason changes with it.
    tooDear.departures.includes('too-dear:unaffordable') &&
    goodOf(tooDear, 'pie').stock === 2;

  // 15. Offline catch-up: an absence is aggregated into whole completed batches,
  //     never replayed frame by frame, and a long absence is clamped.
  await evalShell(harness, `(s) => s.reset()`);
  await harness.stepFrames(4);
  await evalShell(harness, `(s) => s.startJob('bake-pie')`);
  const shortTrip = await evalShell<{ requestedMs: number; appliedMs: number; clamped: boolean; jobsCompleted: number }>(
    harness,
    `(s) => s.goOffline(2600)`,
  );
  const afterShort = await state(harness);
  evidence.offlineShort = { shortTrip, pie: goodOf(afterShort, 'pie'), apple: goodOf(afterShort, 'apple') };
  const step15_offlineCatchUp =
    shortTrip.appliedMs === 2600 &&
    shortTrip.clamped === false &&
    // 1200ms in flight + one more whole 1200ms batch fits in 2600ms; the third
    // does not, so exactly two pies - and 3 more apples were paid for.
    shortTrip.jobsCompleted === 2 &&
    goodOf(afterShort, 'pie').stock === 2 &&
    goodOf(afterShort, 'apple').stock === 2; // 8 - 3 (start) - 3 (second batch)

  // 16. A long absence is clamped to the authored maximum and says so, and a
  //     clock that went backwards credits nothing at all.
  await evalShell(harness, `(s) => s.reset()`);
  await harness.stepFrames(4);
  await evalShell(harness, `(s) => s.startJob('bake-pie')`);
  const longTrip = await evalShell<{ requestedMs: number; appliedMs: number; clamped: boolean }>(
    harness,
    `(s) => s.goOffline(9000000)`,
  );
  const backwards = await evalShell<{ appliedMs: number; jobsCompleted: number }>(
    harness,
    `(s) => s.goOffline(-500000)`,
  );
  evidence.offlineBounds = { longTrip, backwards };
  const step16_offlineBounds =
    longTrip.requestedMs === 9_000_000 &&
    longTrip.appliedMs === 30_000 && // the authored cap
    longTrip.clamped === true &&
    backwards.appliedMs === 0 &&
    backwards.jobsCompleted === 0;

  // 17. Prestige: ineligible until the authored condition holds, then it resets
  //     the scopes it declares, keeps the one it retains, and the reward survives
  //     the currency wipe because it is granted after it.
  await evalShell(harness, `(s) => s.reset()`);
  await harness.stepFrames(4);
  await evalShell(harness, `(s) => s.place('oven', 6, 9)`);
  const ineligible = await evalShell<{ ok: boolean; reason: string }>(harness, `(s) => s.prestige()`);
  await evalShell(harness, `(s) => { s.setDemand('apple', 2); s.sell('apple', 5, 999); }`);
  const beforePrestige = await state(harness);
  const promoted = await evalShell<{ ok: boolean; level: number; multiplier: number; grantedCurrency: number; resetScopes: string[] }>(
    harness,
    `(s) => s.prestige()`,
  );
  const afterPrestige = await state(harness);
  evidence.prestige = {
    ineligible,
    lifetimeBefore: beforePrestige.prestige.lifetimeEarnings,
    promoted,
    after: afterPrestige.prestige,
    apple: goodOf(afterPrestige, 'apple'),
    funds: afterPrestige.funds,
    oven: stationOf(afterPrestige, 'oven'),
    unlocked: afterPrestige.unlocked,
  };
  const step17_prestige =
    ineligible.ok === false &&
    ineligible.reason === 'not-eligible' &&
    beforePrestige.prestige.lifetimeEarnings === 50 &&
    promoted.ok === true &&
    promoted.level === 1 &&
    promoted.multiplier === 2 &&
    // `station-placement` is retained, so it is not among the applied scopes.
    promoted.resetScopes.includes('station-placement') === false &&
    stationOf(afterPrestige, 'oven').position !== null &&
    goodOf(afterPrestige, 'apple').stock === 8 && // stock reset to the authored value
    afterPrestige.funds === 25 && // wiped, then granted the reward
    afterPrestige.prestige.lifetimeEarnings === 50 && // never reset
    afterPrestige.unlocked['press-cider'] === true; // the prestige unlock flag fired

  // 18. The prestige multiplier is load-bearing: the same recipe finishes in
  //     half the frames it took before.
  const withMultiplier = await evalShell<{ ok: boolean }>(harness, `(s) => s.startJob('bake-pie')`);
  await harness.stepFrames(40); // ~667ms at 16.67ms/frame - under the authored 1200ms
  const halfway = await state(harness);
  evidence.multiplier = { withMultiplier, completed: halfway.completedJobs, pie: goodOf(halfway, 'pie') };
  const step18_multiplierApplies =
    withMultiplier.ok === true &&
    halfway.completedJobs.includes('bake-pie') &&
    goodOf(halfway, 'pie').stock === 1;

  const passed =
    step1_boot &&
    step2_sale &&
    step3_refusedIsAtomic &&
    step4_demandAndRestock &&
    step5_capacity &&
    step6_consumeAtStart &&
    step7_cancelRefunds &&
    step8_locked &&
    step9_placement &&
    step10_customerFlow &&
    step11_fifo &&
    step12_queueCapacity &&
    step13_patience &&
    step14_outcomesAreDistinct &&
    step15_offlineCatchUp &&
    step16_offlineBounds &&
    step17_prestige &&
    step18_multiplierApplies;

  return {
    passed,
    details: {
      ...evidence,
      step1_boot,
      step2_sale,
      step3_refusedIsAtomic,
      step4_demandAndRestock,
      step5_capacity,
      step6_consumeAtStart,
      step7_cancelRefunds,
      step8_locked,
      step9_placement,
      step10_customerFlow,
      step11_fifo,
      step12_queueCapacity,
      step13_patience,
      step14_outcomesAreDistinct,
      step15_offlineCatchUp,
      step16_offlineBounds,
      step17_prestige,
      step18_multiplierApplies,
    },
  };
}
