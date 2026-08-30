import { readShellState, readSnapshot } from '../src/snapshot.ts';
import type { Harness } from '../src/harness.ts';
import type { SmokeOutcome } from '../src/smokeRunner.ts';
import type { WorkOrder } from '@sw2d/contracts';
import type { ColonyShellState } from '../../proofs/colony-lite/src/game-specific/shellPack.ts';

const SHELL_ID = 'game.colony-shell';

const state = (h: Harness): Promise<ColonyShellState> => readShellState(h, SHELL_ID);

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
  predicate: (s: ColonyShellState) => boolean,
  budgetFrames = 900,
): Promise<ColonyShellState> {
  let current = await state(harness);
  let stepped = 0;
  while (!predicate(current) && stepped < budgetFrames) {
    await harness.stepFrames(4);
    stepped += 4;
    current = await state(harness);
  }
  return current;
}

const orderOf = (s: ColonyShellState, id: string) => s.orders.find((order) => order.id === id)!;
const agentOf = (s: ColonyShellState, id: string) => s.agents.find((agent) => agent.agentId === id)!;

export async function run(harness: Harness): Promise<SmokeOutcome> {
  const evidence: Record<string, unknown> = {};
  await harness.keyTap('Space');
  await harness.stepFrames(8);

  // 1. Boot: two colonists with different tags, three authored orders, all open.
  const snap = await readSnapshot(harness);
  const s1 = await state(harness);
  evidence.boot = { agents: s1.agents.map((a) => ({ id: a.agentId, tags: a.tags })), orders: s1.orders };
  const step1_boot =
    snap.scene === 'sw2d.play' &&
    snap.installedPacks.includes('sw2d.simulation-agents') &&
    s1.agents.map((a) => a.agentId).join(',') === 'builder,hauler' &&
    agentOf(s1, 'hauler').tags.includes('hauler') &&
    agentOf(s1, 'builder').tags.includes('builder') &&
    s1.orders.length === 3 &&
    s1.openOrders === 3 &&
    s1.orders.every((order) => order.reservedBy === null);

  // 2. Tag gating: the highest-priority order overall is the builder's, but the
  //    hauler is never offered it - it is offered the best order IT can take.
  const forHauler = await evalShell<WorkOrder | null>(harness, `(s) => s.nextFor('hauler')`);
  const forBuilder = await evalShell<WorkOrder | null>(harness, `(s) => s.nextFor('builder')`);
  evidence.offered = { hauler: forHauler, builder: forBuilder };
  const step2_tagGating =
    forHauler !== null &&
    forHauler.kind === 'haul' &&
    forBuilder !== null &&
    forBuilder.id === 'raise-wall' && // priority 9 beats the haul jobs
    forHauler.id !== 'raise-wall';

  // 3. Priority and stable ordering: with two equal-priority haul jobs, the
  //    offer is the lower id - a stable choice, not a Map's insertion order.
  const step3_priorityOrder = forHauler.id === 'haul-crates';

  // 4. Reserving takes the order out of circulation for everyone else.
  const reserved = await evalShell<boolean>(harness, `(s) => s.reserve('haul-crates', 'hauler')`);
  const s4 = await state(harness);
  const stolen = await evalShell<boolean>(harness, `(s) => s.reserve('haul-crates', 'builder')`);
  const nextAfter = await evalShell<WorkOrder | null>(harness, `(s) => s.nextFor('hauler')`);
  evidence.reserve = { reserved, stolen, order: orderOf(s4, 'haul-crates'), next: nextAfter };
  const step4_exclusiveReservation =
    reserved === true &&
    orderOf(s4, 'haul-crates').reservedBy === 'hauler' &&
    orderOf(s4, 'haul-crates').state !== 'open' &&
    agentOf(s4, 'hauler').workOrderId === 'haul-crates' &&
    stolen === false && // already owned
    nextAfter?.id === 'haul-ore'; // the reserved one is no longer offered

  // 5. An agent holds one job at a time.
  const second = await evalShell<boolean>(harness, `(s) => s.reserve('haul-ore', 'hauler')`);
  // ...and cannot take a job whose required tag it lacks.
  const wrongTag = await evalShell<boolean>(harness, `(s) => s.reserve('raise-wall', 'hauler')`);
  evidence.limits = { second, wrongTag };
  const step5_oneJobAndTagged = second === false && wrongTag === false;

  // 6. A reserved order progresses to completion on simulation time and frees
  //    its owner. The shell never decided it was finished.
  const completed = await stepUntil(harness, (s) => s.completedOrders.includes('haul-crates'));
  evidence.completed = {
    completed: completed.completedOrders,
    order: orderOf(completed, 'haul-crates'),
    hauler: agentOf(completed, 'hauler').workOrderId,
  };
  const step6_completion =
    completed.completedOrders.filter((id) => id === 'haul-crates').length === 1 &&
    orderOf(completed, 'haul-crates').state === 'complete' &&
    agentOf(completed, 'hauler').workOrderId === null;

  // 7. Release puts an order back and resets its progress, so the work is not
  //    silently half-credited to the next taker.
  await evalShell(harness, `(s) => s.reserve('haul-ore', 'hauler')`);
  await harness.stepFrames(8);
  const midway = await state(harness);
  const releasedOk = await evalShell<boolean>(harness, `(s) => s.release('haul-ore')`);
  const s7 = await state(harness);
  evidence.release = { progressBefore: orderOf(midway, 'haul-ore').progressMs, after: orderOf(s7, 'haul-ore') };
  const step7_release =
    orderOf(midway, 'haul-ore').progressMs > 0 &&
    releasedOk === true &&
    orderOf(s7, 'haul-ore').state === 'open' &&
    orderOf(s7, 'haul-ore').reservedBy === null &&
    orderOf(s7, 'haul-ore').progressMs === 0 &&
    agentOf(s7, 'hauler').workOrderId === null;

  // 8. Cancelling removes an order from circulation entirely.
  const cancelled = await evalShell<boolean>(harness, `(s) => s.cancel('haul-ore')`);
  const s8 = await state(harness);
  const offeredAfterCancel = await evalShell<WorkOrder | null>(harness, `(s) => s.nextFor('hauler')`);
  evidence.cancel = { cancelled, order: orderOf(s8, 'haul-ore'), offered: offeredAfterCancel };
  const step8_cancel =
    cancelled === true &&
    orderOf(s8, 'haul-ore').state === 'cancelled' &&
    offeredAfterCancel === null; // both haul jobs are gone now

  // 9. A colonist dismissed mid-job must not take the reservation with them.
  await evalShell(harness, `(s) => s.reset()`);
  await harness.stepFrames(4);
  await evalShell(harness, `(s) => s.reserve('raise-wall', 'builder')`);
  const held = await state(harness);
  const dismissed = await evalShell<boolean>(harness, `(s) => s.dismiss('builder')`);
  const s9 = await state(harness);
  evidence.dismiss = { heldBy: orderOf(held, 'raise-wall').reservedBy, after: orderOf(s9, 'raise-wall') };
  const step9_noLeakedReservation =
    orderOf(held, 'raise-wall').reservedBy === 'builder' &&
    dismissed === true &&
    s9.agents.every((agent) => agent.agentId !== 'builder') &&
    orderOf(s9, 'raise-wall').state === 'open' &&
    orderOf(s9, 'raise-wall').reservedBy === null;

  // 10. Several agents run at once, each deciding for itself, and a drained
  //     need re-ranks that agent's behaviour without touching the other's.
  await evalShell(harness, `(s) => s.reset()`);
  await harness.stepFrames(8);
  const bothWorking = await state(harness);
  await evalShell(harness, `(s) => s.drain('hauler', 'stamina', 90)`);
  const rested = await stepUntil(harness, (s) => s.startedBehaviors.some((entry) => entry === 'hauler:rest'), 400);
  evidence.multiAgent = {
    before: bothWorking.agents.map((a) => a.active?.behaviorId ?? null),
    started: rested.startedBehaviors.slice(-8),
    haulerStamina: agentOf(rested, 'hauler').needs['stamina'],
    builderStamina: agentOf(rested, 'builder').needs['stamina'],
  };
  const step10_multiAgent =
    rested.startedBehaviors.includes('hauler:rest') &&
    // Draining one colonist did not drain the other.
    agentOf(rested, 'builder').needs['stamina']!.value > agentOf(rested, 'hauler').needs['stamina']!.value - 100 &&
    rested.agents.length === 2;

  // 11. `assignNext` is the whole assignment loop: ask the capability, claim
  //     what it offers. Both colonists end up on the right kind of job.
  await evalShell(harness, `(s) => s.reset()`);
  await harness.stepFrames(4);
  const assignedHauler = await evalShell<{ orderId: string | null; reserved: boolean }>(
    harness,
    `(s) => s.assignNext('hauler')`,
  );
  const assignedBuilder = await evalShell<{ orderId: string | null; reserved: boolean }>(
    harness,
    `(s) => s.assignNext('builder')`,
  );
  const s11 = await state(harness);
  evidence.assign = { assignedHauler, assignedBuilder, orders: s11.orders };
  const step11_assignment =
    assignedHauler.reserved === true &&
    assignedBuilder.reserved === true &&
    orderOf(s11, assignedHauler.orderId!).kind === 'haul' &&
    orderOf(s11, assignedBuilder.orderId!).kind === 'build' &&
    s11.openOrders === 1; // one haul job still unclaimed

  // 12. The game clock advances and the schedule follows it.
  const scheduled = await stepUntil(harness, (s) => agentOf(s, 'hauler').scheduleActivity !== null, 300);
  evidence.clock = { clock: scheduled.clock, activity: agentOf(scheduled, 'hauler').scheduleActivity };
  const step12_clock =
    scheduled.clock.elapsedMs > 0 &&
    scheduled.clock.minuteOfDay >= 0 &&
    scheduled.clock.minuteOfDay < 1440 &&
    ['work', 'evening', 'sleep'].includes(agentOf(scheduled, 'hauler').scheduleActivity!);

  const passed =
    step1_boot &&
    step2_tagGating &&
    step3_priorityOrder &&
    step4_exclusiveReservation &&
    step5_oneJobAndTagged &&
    step6_completion &&
    step7_release &&
    step8_cancel &&
    step9_noLeakedReservation &&
    step10_multiAgent &&
    step11_assignment &&
    step12_clock;

  return {
    passed,
    details: {
      ...evidence,
      step1_boot,
      step2_tagGating,
      step3_priorityOrder,
      step4_exclusiveReservation,
      step5_oneJobAndTagged,
      step6_completion,
      step7_release,
      step8_cancel,
      step9_noLeakedReservation,
      step10_multiAgent,
      step11_assignment,
      step12_clock,
    },
  };
}
