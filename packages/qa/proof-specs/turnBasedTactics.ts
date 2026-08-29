import { readShellState, readSnapshot } from '../src/snapshot.ts';
import type { Harness } from '../src/harness.ts';
import type { SmokeOutcome } from '../src/smokeRunner.ts';
import type { StrategyOrder, TacticalExecutionResult, TacticalValidity } from '@sw2d/contracts';
import type { TacticsShellState } from '../../proofs/turn-based-tactics/src/game-specific/shellPack.ts';

const SHELL_ID = 'game.grid-shell';

interface ShellSnap extends TacticsShellState {
  readonly unitCol: number;
  readonly unitRow: number;
  readonly cursorCol: number;
  readonly cursorRow: number;
  readonly reachableCount: number;
  readonly cursorReachable: boolean;
  readonly moving: boolean;
  readonly lastPathLen: number;
  readonly lastPathCost: number;
  readonly arrivedAt: { col: number; row: number } | null;
  readonly confirmsRejected: number;
}
function state(h: Harness): Promise<ShellSnap> {
  return readShellState(h, SHELL_ID);
}

function evalShell<T>(harness: Harness, fnStr: string): Promise<T> {
  return harness.evaluate(`
    (() => {
      const shell = window.__SW2D__.context.capabilities.require('${SHELL_ID}');
      return (${fnStr})(shell);
    })()
  `) as Promise<T>;
}

const entity = (id: string): string => `{ kind: 'entity', entityId: '${id}' }`;

export async function run(harness: Harness): Promise<SmokeOutcome> {
  const evidence: Record<string, unknown> = {};
  await harness.keyTap('Space');
  await harness.stepFrames(8);
  const started = await readSnapshot(harness);
  const initial = await state(harness);
  const again = await state(harness);
  evidence.initial = initial;
  const startedOk =
    started.scene === 'sw2d.play' &&
    started.installedPacks.includes('sw2d.navigation') &&
    started.installedPacks.includes('sw2d.strategy-actions') &&
    initial.unitCol === 2 && initial.unitRow === 4 &&
    initial.reachableCount === again.reachableCount && // deterministic
    initial.reachableCount > 6;

  // Move the cursor up 2 - a cell inside the reachable set - and confirm.
  await harness.keyTap('ArrowUp');
  await harness.keyTap('ArrowUp');
  await harness.stepFrames(2);
  const aimed = await state(harness);
  evidence.aimed = aimed;
  const aimOk = aimed.cursorCol === 2 && aimed.cursorRow === 2 && aimed.cursorReachable === true;

  await harness.keyTap('Enter'); // CONFIRM
  for (let i = 0; i < 30 && (await state(harness)).moving; i++) await harness.stepFrames(4);
  const moved = await state(harness);
  evidence.moved = moved;
  const moveOk =
    moved.unitCol === 2 && moved.unitRow === 2 &&
    moved.moving === false &&
    moved.lastPathCost === 2 &&
    moved.lastPathLen === 3 &&
    moved.arrivedAt?.col === 2 && moved.arrivedAt?.row === 2;

  // Try to confirm a cell beyond the budget (around the wall) - rejected.
  for (let i = 0; i < 5; i++) await harness.keyTap('ArrowRight'); // cursor to col ~5-7 past the wall
  await harness.stepFrames(2);
  const farCursor = await state(harness);
  await harness.keyTap('Enter');
  await harness.stepFrames(6);
  const afterReject = await state(harness);
  evidence.farCursor = farCursor;
  evidence.afterReject = afterReject;
  const rejectOk =
    farCursor.cursorReachable === false &&
    afterReject.unitCol === 2 && afterReject.unitRow === 2 && // did not move
    afterReject.confirmsRejected > 0;

  // Restart.
  await harness.keyTap('KeyP');
  await harness.stepFrames(4);
  await harness.keyTap('KeyK');
  await harness.stepFrames(12);
  const afterRestart = await state(harness);
  evidence.afterRestart = afterRestart;
  const restartOk = afterRestart.unitCol === 2 && afterRestart.unitRow === 4 && afterRestart.confirmsRejected === 0;

  // ---------------------------------------------------------------------
  // Phase 14 - bounded tactical actions on the same grid. The hero is back
  // at (2,4); foe-near is at (3,4) (60px away), foe-far at (8,4) (360px).
  // ---------------------------------------------------------------------

  const t0 = await state(harness);
  evidence.tacticsInitial = t0;
  const tacticsBootOk =
    t0.points === 2 &&
    t0.turnNumber === 1 &&
    t0.activeTeam === 'blue' &&
    t0.heroHp === 100 &&
    t0.foeNearHp === 100 &&
    t0.foeFarHp === 100 &&
    // 'snipe' costs 2 and is affordable at full points; every catalog action is
    // available before anything has been spent.
    [...t0.available].sort().join(',') === 'brace,reposition,snipe,strike';

  // Range and minimum range come from the capability, not from the shell.
  const strikeNear = await evalShell<TacticalValidity>(harness, `(s) => s.validate('strike', ${entity('foe-near')})`);
  const strikeFar = await evalShell<TacticalValidity>(harness, `(s) => s.validate('strike', ${entity('foe-far')})`);
  const snipeNear = await evalShell<TacticalValidity>(harness, `(s) => s.validate('snipe', ${entity('foe-near')})`);
  const snipeFar = await evalShell<TacticalValidity>(harness, `(s) => s.validate('snipe', ${entity('foe-far')})`);
  const strikeWrongKind = await evalShell<TacticalValidity>(harness, `(s) => s.validate('strike', { kind: 'position', x: 100, y: 100 })`);
  evidence.validity = { strikeNear, strikeFar, snipeNear, snipeFar, strikeWrongKind };
  const rangeOk =
    strikeNear.valid === true && Math.round(strikeNear.distance ?? 0) === 60 && strikeNear.cost === 1 &&
    strikeFar.valid === false && strikeFar.reason === 'out-of-range' && Math.round(strikeFar.distance ?? 0) === 360 &&
    snipeNear.valid === false && snipeNear.reason === 'too-close' &&
    snipeFar.valid === true && snipeFar.cost === 2 &&
    strikeWrongKind.valid === false && strikeWrongKind.reason === 'invalid-target';

  // Execute a legal action: points are spent, an order is issued, and the world
  // consequence lands when the order runs.
  const struck = await evalShell<TacticalExecutionResult>(harness, `(s) => s.execute('strike', ${entity('foe-near')})`);
  await harness.stepFrames(4);
  const afterStrike = await state(harness);
  const strikeOrder = await evalShell<StrategyOrder | undefined>(
    harness,
    `(s) => s.order(${JSON.stringify(struck.orderId ?? '')})`,
  );
  evidence.struck = struck;
  evidence.afterStrike = afterStrike;
  evidence.strikeOrder = strikeOrder;
  const executeOk =
    struck.ok === true &&
    struck.spent === 1 &&
    typeof struck.orderId === 'string' &&
    afterStrike.points === 1 &&
    afterStrike.foeNearHp === 70 &&
    strikeOrder?.kind === 'attack' &&
    strikeOrder.abilityId === 'strike' &&
    strikeOrder.status === 'completed' &&
    afterStrike.lastOrderStatus === 'completed';

  // Cost is enforced: 1 point left cannot pay for the 2-point snipe.
  const brokeSnipe = await evalShell<TacticalExecutionResult>(harness, `(s) => s.execute('snipe', ${entity('foe-far')})`);
  const afterBrokeSnipe = await state(harness);
  evidence.brokeSnipe = brokeSnipe;
  const costOk =
    brokeSnipe.ok === false &&
    brokeSnipe.reason === 'insufficient-points' &&
    brokeSnipe.spent === 0 &&
    afterBrokeSnipe.points === 1 &&
    afterBrokeSnipe.foeFarHp === 100 &&
    !afterBrokeSnipe.available.includes('snipe');

  // Ending the turn rotates the team and restores tactical resources.
  const turned = await evalShell<{ turnNumber: number; activeTeam: string | null }>(harness, `(s) => s.endTurn()`);
  const afterTurn = await state(harness);
  evidence.turned = turned;
  evidence.afterTurn = afterTurn;
  const turnOk =
    turned.turnNumber === 2 &&
    turned.activeTeam === 'red' &&
    afterTurn.points === 2 &&
    afterTurn.available.includes('snipe');

  // Cooldown is measured in simulation ticks and blocks reuse while it lasts.
  const sniped = await evalShell<TacticalExecutionResult>(harness, `(s) => s.execute('snipe', ${entity('foe-far')})`);
  await harness.stepFrames(2);
  const afterSnipe = await state(harness);
  const snipeAgain = await evalShell<TacticalExecutionResult>(harness, `(s) => s.execute('snipe', ${entity('foe-far')})`);
  evidence.sniped = sniped;
  evidence.afterSnipe = afterSnipe;
  evidence.snipeAgain = snipeAgain;
  const cooldownOk =
    sniped.ok === true &&
    sniped.spent === 2 &&
    afterSnipe.foeFarHp === 70 &&
    afterSnipe.snipeCooldown > 0 &&
    snipeAgain.ok === false &&
    snipeAgain.reason === 'on-cooldown';

  // Uses-per-turn is a separate gate from points.
  await evalShell(harness, `(s) => s.endTurn()`);
  const braced = await evalShell<TacticalExecutionResult>(harness, `(s) => s.execute('brace', { kind: 'none' })`);
  await harness.stepFrames(2);
  const bracedAgain = await evalShell<TacticalExecutionResult>(harness, `(s) => s.execute('brace', { kind: 'none' })`);
  const afterBrace = await state(harness);
  evidence.braced = braced;
  evidence.bracedAgain = bracedAgain;
  const usesOk =
    braced.ok === true &&
    afterBrace.braceUsesRemaining === 0 &&
    bracedAgain.ok === false &&
    bracedAgain.reason === 'no-uses-remaining';

  // A move action: legal destination completes and actually relocates the unit;
  // a destination inside a wall is accepted by the tactics range check but fails
  // as an order, with the adapter's reason surfacing on the order record.
  await evalShell(harness, `(s) => s.endTurn()`);
  const outOfReach = await evalShell<TacticalValidity>(
    harness,
    `(s) => { const c = s.cellCentre(8, 4); return s.validate('reposition', { kind: 'position', x: c.x, y: c.y }); }`,
  );
  const stepAside = await evalShell<TacticalExecutionResult>(
    harness,
    `(s) => { const c = s.cellCentre(3, 5); return s.execute('reposition', { kind: 'position', x: c.x, y: c.y }); }`,
  );
  for (let i = 0; i < 40 && (await state(harness)).lastOrderId !== stepAside.orderId; i++) await harness.stepFrames(4);
  const afterMove = await state(harness);
  const moveOrder = await evalShell<StrategyOrder | undefined>(
    harness,
    `(s) => s.order(${JSON.stringify(stepAside.orderId ?? '')})`,
  );
  evidence.outOfReach = outOfReach;
  evidence.stepAside = stepAside;
  evidence.afterMove = afterMove;
  evidence.moveOrder = moveOrder;
  const moveActionOk =
    outOfReach.valid === false && outOfReach.reason === 'out-of-range' &&
    stepAside.ok === true &&
    moveOrder?.status === 'completed' &&
    afterMove.unitCol === 3 && afterMove.unitRow === 5;

  // Order failure path: a destination inside range that the grid cannot route to
  // (the wall cell one step east). The tactics service admits it - range is all it
  // knows - and the order fails with the adapter's `unreachable`.
  await evalShell(harness, `(s) => s.endTurn()`);
  const intoWall = await evalShell<TacticalExecutionResult>(
    harness,
    `(s) => { const c = s.cellCentre(4, 5); return s.execute('reposition', { kind: 'position', x: c.x, y: c.y }); }`,
  );
  await harness.stepFrames(6);
  const wallOrder = await evalShell<StrategyOrder | undefined>(
    harness,
    `(s) => s.order(${JSON.stringify(intoWall.orderId ?? '')})`,
  );
  const afterWall = await state(harness);
  evidence.intoWall = intoWall;
  evidence.wallOrder = wallOrder;
  const failurePathOk =
    intoWall.ok === true && // the action was legal; the world could not honour it
    wallOrder?.status === 'failed' &&
    wallOrder.failureReason === 'unreachable' &&
    afterWall.unitCol === 3 && afterWall.unitRow === 5; // unit stayed put

  // Target validation against a dead unit and against an ally.
  await evalShell(harness, `(s) => s.slay('foe-near')`);
  const deadTarget = await evalShell<TacticalValidity>(harness, `(s) => s.validate('strike', ${entity('foe-near')})`);
  const deadExecute = await evalShell<TacticalExecutionResult>(harness, `(s) => s.execute('strike', ${entity('foe-near')})`);
  const selfTarget = await evalShell<TacticalValidity>(harness, `(s) => s.validate('strike', ${entity('hero')})`);
  const afterDead = await state(harness);
  evidence.deadTarget = deadTarget;
  evidence.deadExecute = deadExecute;
  evidence.selfTarget = selfTarget;
  const targetValidationOk =
    afterDead.foeNearHp === 0 &&
    deadTarget.valid === false && deadTarget.reason === 'target-lost' &&
    deadExecute.ok === false && deadExecute.spent === 0 &&
    selfTarget.valid === false && selfTarget.reason === 'invalid-target';

  const passed =
    startedOk &&
    aimOk &&
    moveOk &&
    rejectOk &&
    restartOk &&
    tacticsBootOk &&
    rangeOk &&
    executeOk &&
    costOk &&
    turnOk &&
    cooldownOk &&
    usesOk &&
    moveActionOk &&
    failurePathOk &&
    targetValidationOk;

  return {
    passed,
    details: {
      ...evidence,
      startedOk,
      aimOk,
      moveOk,
      rejectOk,
      restartOk,
      tacticsBootOk,
      rangeOk,
      executeOk,
      costOk,
      turnOk,
      cooldownOk,
      usesOk,
      moveActionOk,
      failurePathOk,
      targetValidationOk,
    },
  };
}
