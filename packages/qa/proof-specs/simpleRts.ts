import { readShellState, readSnapshot } from '../src/snapshot.ts';
import type { Harness } from '../src/harness.ts';
import type { SmokeOutcome } from '../src/smokeRunner.ts';
import type { OrderIssueResult, StrategyOrder, TacticalExecutionResult, TacticalValidity } from '@sw2d/contracts';
import type { RtsShellState } from '../../proofs/simple-rts/src/game-specific/shellPack.ts';

const SHELL_ID = 'game.rts-shell';

const state = (h: Harness): Promise<RtsShellState> => readShellState(h, SHELL_ID);

function evalShell<T>(harness: Harness, fnStr: string): Promise<T> {
  return harness.evaluate(`
    (() => {
      const shell = window.__SW2D__.context.capabilities.require('${SHELL_ID}');
      return (${fnStr})(shell);
    })()
  `) as Promise<T>;
}

/** Steps frames until `predicate` holds or the budget runs out. Returns the last state. */
async function stepUntil(
  harness: Harness,
  predicate: (s: RtsShellState) => boolean,
  budgetFrames = 400,
): Promise<RtsShellState> {
  let current = await state(harness);
  let stepped = 0;
  while (!predicate(current) && stepped < budgetFrames) {
    await harness.stepFrames(4);
    stepped += 4;
    current = await state(harness);
  }
  return current;
}

/**
 * Steps until a specific order reaches a terminal status. Waiting on
 * `active[actor] === null` is wrong for a freshly issued order: it is `queued`
 * for one tick before it becomes active, so that predicate is already true at
 * the moment of issue.
 */
async function stepUntilResolved(
  harness: Harness,
  orderId: string,
  budgetFrames = 1600,
): Promise<StrategyOrder | undefined> {
  const read = (): Promise<StrategyOrder | undefined> =>
    evalShell<StrategyOrder | undefined>(harness, `(s) => s.order(${JSON.stringify(orderId)})`);
  let current = await read();
  let stepped = 0;
  while (stepped < budgetFrames && current !== undefined && (current.status === 'queued' || current.status === 'active')) {
    await harness.stepFrames(4);
    stepped += 4;
    current = await read();
  }
  return current;
}

export async function run(harness: Harness): Promise<SmokeOutcome> {
  const evidence: Record<string, unknown> = {};
  await harness.keyTap('Space');
  await harness.stepFrames(8);

  // 1. Boot: the reusable pack is installed and every unit starts where the
  //    shell placed it, with full health and no orders.
  const snap = await readSnapshot(harness);
  const s1 = await state(harness);
  evidence.boot = s1;
  const step1_boot =
    snap.scene === 'sw2d.play' &&
    snap.installedPacks.includes('sw2d.strategy-actions') &&
    snap.installedPacks.includes('sw2d.navigation') &&
    Object.keys(s1.units).length === 5 &&
    s1.units['blue-1']!.col === 1 && s1.units['blue-1']!.row === 4 &&
    s1.units['red-1']!.hp === 100 &&
    s1.pendingCount === 0 &&
    s1.selection.length === 0;

  // 2. Select two of the three blue units with a drag rectangle.
  const boxed = await evalShell<readonly string[]>(harness, `(s) => s.selectBox(60, 240, 60, 180)`);
  const s2 = await state(harness);
  evidence.selection = boxed;
  const step2_selection =
    boxed.length === 2 &&
    boxed.includes('blue-1') &&
    boxed.includes('blue-2') &&
    !boxed.includes('blue-3') &&
    s2.selection.length === 2;

  // 3. Issue a move order to both selected units: one order each, deterministic
  //    ids in ascending actor order, both queued before the next tick.
  const moveIssued = await evalShell<OrderIssueResult>(harness, `(s) => s.orderMove(4, 4)`);
  const s3 = await state(harness);
  evidence.moveIssued = moveIssued;
  const step3_moveIssued =
    moveIssued.accepted.length === 2 &&
    moveIssued.rejected.length === 0 &&
    moveIssued.accepted.map((o) => o.actorId).join(',') === 'blue-1,blue-2' &&
    moveIssued.accepted.map((o) => o.orderId).join(',') === 'ord-1,ord-2' &&
    moveIssued.accepted.every((o) => o.status === 'queued' && o.kind === 'move') &&
    s3.pendingCount === 2;

  // 4. On the next tick the order is active and the unit is actually moving.
  await harness.stepFrames(6);
  const s4 = await state(harness);
  evidence.moveActive = s4;
  const step4_orderActive =
    s4.active['blue-1']?.orderId === 'ord-1' &&
    s4.active['blue-1']?.status === 'active' &&
    s4.units['blue-1']!.x > s1.units['blue-1']!.x;

  // 5. The order completes on arrival, and the service records the terminal status.
  const moveOrder1 = await stepUntilResolved(harness, 'ord-1');
  await stepUntilResolved(harness, 'ord-2');
  const s5 = await state(harness);
  evidence.moveArrived = s5;
  evidence.moveOrder1 = moveOrder1;
  const step5_moveCompleted =
    moveOrder1?.status === 'completed' &&
    typeof moveOrder1.startedTick === 'number' &&
    typeof moveOrder1.resolvedTick === 'number' &&
    moveOrder1.resolvedTick > moveOrder1.startedTick &&
    s5.units['blue-1']!.col === 4 && s5.units['blue-1']!.row === 4 &&
    s5.pendingCount === 0 &&
    s5.historyCount === 2;

  // 6. Attack order: a single unit is told to kill a specific enemy. It closes
  //    the distance through the navigation grid, then damages the target.
  await evalShell(harness, `(s) => s.select(['blue-1'])`);
  const attackIssued = await evalShell<OrderIssueResult>(harness, `(s) => s.orderAttack('red-1')`);
  await harness.stepFrames(40);
  const midAttack = await state(harness);
  evidence.attackIssued = attackIssued;
  evidence.midAttack = midAttack;
  const step6_attackIssued =
    attackIssued.accepted.length === 1 &&
    attackIssued.accepted[0]!.kind === 'attack' &&
    midAttack.active['blue-1']?.kind === 'attack';

  // 7. The target takes real combat damage and the order completes when it dies.
  const killed = await stepUntil(harness, (s) => s.units['red-1']!.hp <= 0, 1200);
  const attackOrderId = attackIssued.accepted[0]?.orderId ?? '';
  const attackOrder = await evalShell<StrategyOrder | undefined>(
    harness,
    `(s) => s.order(${JSON.stringify(attackOrderId)})`,
  );
  evidence.killed = killed;
  evidence.attackOrder = attackOrder;
  const step7_targetDamaged =
    killed.units['red-1']!.hp === 0 &&
    killed.units['red-1']!.alive === false &&
    attackOrder?.status === 'completed' &&
    killed.lastResolved?.orderId === attackOrderId &&
    killed.lastResolved.status === 'completed';

  // 8. Queue policy. `append` puts an order behind the active one; `replace`
  //    (the pack default) cancels the active order and the whole queue, marking
  //    the displaced orders 'superseded' rather than 'failed'.
  await evalShell(harness, `(s) => s.select(['blue-2'])`);
  const first = await evalShell<OrderIssueResult>(harness, `(s) => s.orderMove(2, 8)`);
  await harness.stepFrames(4);
  const appended = await evalShell<OrderIssueResult>(harness, `(s) => s.orderMove(1, 1, 'append')`);
  const sQueued = await state(harness);
  const replaced = await evalShell<OrderIssueResult>(harness, `(s) => s.orderHold()`);
  const sReplaced = await state(harness);
  const displaced = await evalShell<StrategyOrder | undefined>(
    harness,
    `(s) => s.order(${JSON.stringify(first.accepted[0]?.orderId ?? '')})`,
  );
  const displacedQueued = await evalShell<StrategyOrder | undefined>(
    harness,
    `(s) => s.order(${JSON.stringify(appended.accepted[0]?.orderId ?? '')})`,
  );
  evidence.queued = { first, appended, replaced, queueLen: sQueued.queueLengths['blue-2'] };
  evidence.displaced = displaced;
  const step8_queueAndReplace =
    sQueued.active['blue-2']?.orderId === first.accepted[0]!.orderId &&
    sQueued.queueLengths['blue-2'] === 1 &&
    replaced.accepted.length === 1 &&
    sReplaced.queueLengths['blue-2'] === 1 && // only the replacement remains
    sReplaced.active['blue-2'] === null &&
    displaced?.status === 'cancelled' &&
    displaced.failureReason === 'superseded' &&
    displacedQueued?.status === 'cancelled' &&
    displacedQueued.failureReason === 'superseded';

  // 9. Stop and explicit cancel.
  await harness.stepFrames(6);
  const sBeforeStop = await state(harness);
  const stopped = await evalShell<number>(harness, `(s) => s.orderStop()`);
  const sAfterStop = await state(harness);
  await evalShell(harness, `(s) => s.select(['blue-3'])`);
  const toCancel = await evalShell<OrderIssueResult>(harness, `(s) => s.orderMove(3, 1)`);
  const cancelOk = await evalShell<boolean>(
    harness,
    `(s) => s.cancel(${JSON.stringify(toCancel.accepted[0]?.orderId ?? '')})`,
  );
  const cancelled = await evalShell<StrategyOrder | undefined>(
    harness,
    `(s) => s.order(${JSON.stringify(toCancel.accepted[0]?.orderId ?? '')})`,
  );
  const sAfterCancel = await state(harness);
  evidence.stopped = { stopped, before: sBeforeStop.active['blue-2'], after: sAfterStop.active['blue-2'] };
  evidence.cancelled = cancelled;
  const step9_stopAndCancel =
    sBeforeStop.active['blue-2']?.kind === 'hold' &&
    stopped >= 1 &&
    sAfterStop.active['blue-2'] === null &&
    sAfterStop.queueLengths['blue-2'] === 0 &&
    cancelOk === true &&
    cancelled?.status === 'cancelled' &&
    sAfterCancel.active['blue-3'] === null;

  // 10. Invalid and dead targets. An order against a unit that never existed is
  //     rejected outright; against a corpse it is rejected as target-lost; and a
  //     unit killed mid-order has its live order failed as actor-removed.
  await evalShell(harness, `(s) => s.select(['blue-3'])`);
  const ghost = await evalShell<OrderIssueResult>(harness, `(s) => s.orderAttack('does-not-exist')`);
  const corpse = await evalShell<OrderIssueResult>(harness, `(s) => s.orderAttack('red-1')`);
  const noTarget = await evalShell<OrderIssueResult>(harness, `(s) => s.orderMove(7, 4)`); // into the wall column
  const wallOrderId = noTarget.accepted[0]?.orderId ?? '';
  await harness.stepFrames(8);
  const wallOrder = await evalShell<StrategyOrder | undefined>(
    harness,
    `(s) => s.order(${JSON.stringify(wallOrderId)})`,
  );

  const doomed = await evalShell<OrderIssueResult>(harness, `(s) => s.orderHold()`);
  await harness.stepFrames(6);
  await evalShell(harness, `(s) => s.slay('blue-3')`);
  await harness.stepFrames(8);
  const doomedOrder = await evalShell<StrategyOrder | undefined>(
    harness,
    `(s) => s.order(${JSON.stringify(doomed.accepted[0]?.orderId ?? '')})`,
  );
  evidence.ghost = ghost;
  evidence.corpse = corpse;
  evidence.wallOrder = wallOrder;
  evidence.doomedOrder = doomedOrder;
  const step10_invalidTargets =
    ghost.accepted.length === 0 && ghost.rejected[0]?.reason === 'invalid-target' &&
    corpse.accepted.length === 0 && corpse.rejected[0]?.reason === 'target-lost' &&
    wallOrder?.status === 'failed' && wallOrder.failureReason === 'unreachable' &&
    doomedOrder?.status === 'failed' && doomedOrder.failureReason === 'actor-removed';

  // 11. A named squad is addressable as one command target.
  const squad = await evalShell<{ groupId: string; actorIds: readonly string[] }>(
    harness,
    `(s) => s.defineSquad('alpha', ['blue-1', 'blue-2'])`,
  );
  const squadOrder = await evalShell<OrderIssueResult>(harness, `(s) => s.orderSquadHold('alpha')`);
  await harness.stepFrames(6);
  const sSquad = await state(harness);
  evidence.squad = { squad, squadOrder };
  const step11_squad =
    squad.actorIds.length === 2 &&
    squadOrder.accepted.length === 2 &&
    squadOrder.accepted.map((o) => o.actorId).join(',') === 'blue-1,blue-2' &&
    sSquad.active['blue-1']?.kind === 'hold' &&
    sSquad.active['blue-2']?.kind === 'hold';

  // 12. The tactical half of the same pack reads the same catalog document:
  //     `focus-fire` has a 220-unit range, so the far enemy is out of reach and
  //     the near one is not, and executing it raises a real attack order.
  await evalShell(harness, `(s) => s.select(['blue-1'])`);
  await evalShell(harness, `(s) => s.orderStop()`);
  const sBeforeTactics = await state(harness);
  // blue-2 sits on the far side of the map from red-2; blue-1 chased red-1 into
  // the same corner as red-2. One catalog entry, two different verdicts.
  const farVerdict = await evalShell<TacticalValidity>(harness, `(s) => s.validateAction('focus-fire', 'blue-2', 'red-2')`);
  const nearVerdict = await evalShell<TacticalValidity>(harness, `(s) => s.validateAction('focus-fire', 'blue-1', 'red-2')`);
  const fired = await evalShell<TacticalExecutionResult>(harness, `(s) => s.executeAction('focus-fire', 'blue-1', 'red-2')`);
  await harness.stepFrames(8);
  const sFired = await state(harness);
  const firedOrder = await evalShell<StrategyOrder | undefined>(
    harness,
    `(s) => s.order(${JSON.stringify(fired.orderId ?? '')})`,
  );
  evidence.tactics = { farVerdict, nearVerdict, fired, firedOrder, before: sBeforeTactics.units };
  const step12_tacticalAction =
    farVerdict.valid === false && farVerdict.reason === 'out-of-range' && (farVerdict.distance ?? 0) > 220 &&
    nearVerdict.valid === true && (nearVerdict.distance ?? 999) <= 220 &&
    fired.ok === true &&
    firedOrder?.kind === 'attack' &&
    firedOrder.abilityId === 'focus-fire' &&
    sFired.units['red-2']!.hp < 100;

  // 13. Determinism: the same command issued from the same start position
  //     produces the same world result and the same number of execution ticks.
  await evalShell(harness, `(s) => s.select(['blue-2'])`);
  await evalShell(harness, `(s) => s.orderStop()`);

  const home = await evalShell<{ orderId: string }>(
    harness,
    `(s) => ({ orderId: s.orderMove(1, 6).accepted[0].orderId })`,
  );
  await stepUntilResolved(harness, home.orderId);
  const homeState = await state(harness);

  const firstRun = await evalShell<{ orderId: string }>(
    harness,
    `(s) => ({ orderId: s.orderMove(3, 1).accepted[0].orderId })`,
  );
  const firstOrder = await stepUntilResolved(harness, firstRun.orderId);
  const firstPos = (await state(harness)).units['blue-2']!;

  const homeAgain = await evalShell<{ orderId: string }>(
    harness,
    `(s) => ({ orderId: s.orderMove(1, 6).accepted[0].orderId })`,
  );
  await stepUntilResolved(harness, homeAgain.orderId);
  const homeStateAgain = await state(harness);

  const secondRun = await evalShell<{ orderId: string }>(
    harness,
    `(s) => ({ orderId: s.orderMove(3, 1).accepted[0].orderId })`,
  );
  const secondOrder = await stepUntilResolved(harness, secondRun.orderId);
  const secondPos = (await state(harness)).units['blue-2']!;

  evidence.determinism = { firstRun, secondRun, firstPos, secondPos, firstOrder, secondOrder, homeState: homeState.units['blue-2'], homeStateAgain: homeStateAgain.units['blue-2'] };
  const firstTicks = (firstOrder?.resolvedTick ?? -1) - (firstOrder?.startedTick ?? 0);
  const secondTicks = (secondOrder?.resolvedTick ?? -2) - (secondOrder?.startedTick ?? 0);
  const step13_deterministic =
    // Both runs start from the identical position...
    homeState.units['blue-2']!.x === homeStateAgain.units['blue-2']!.x &&
    homeState.units['blue-2']!.y === homeStateAgain.units['blue-2']!.y &&
    // ...both orders complete...
    firstOrder?.status === 'completed' && secondOrder?.status === 'completed' &&
    // ...at the identical destination...
    firstPos.x === secondPos.x && firstPos.y === secondPos.y &&
    firstPos.col === 3 && firstPos.row === 1 &&
    // ...having spent the identical number of simulation ticks executing.
    firstTicks > 0 && firstTicks === secondTicks;

  const passed =
    step1_boot &&
    step2_selection &&
    step3_moveIssued &&
    step4_orderActive &&
    step5_moveCompleted &&
    step6_attackIssued &&
    step7_targetDamaged &&
    step8_queueAndReplace &&
    step9_stopAndCancel &&
    step10_invalidTargets &&
    step11_squad &&
    step12_tacticalAction &&
    step13_deterministic;

  return {
    passed,
    details: {
      ...evidence,
      step1_boot,
      step2_selection,
      step3_moveIssued,
      step4_orderActive,
      step5_moveCompleted,
      step6_attackIssued,
      step7_targetDamaged,
      step8_queueAndReplace,
      step9_stopAndCancel,
      step10_invalidTargets,
      step11_squad,
      step12_tacticalAction,
      step13_deterministic,
    },
  };
}
