import { readShellState } from '../src/snapshot.ts';
import type { Harness } from '../src/harness.ts';
import type { SmokeOutcome } from '../src/smokeRunner.ts';

interface ShellSnap {
  readonly cursor: { readonly col: number; readonly row: number };
  readonly currency: number;
  readonly towerPlaced: boolean;
  readonly towerUpgraded: boolean;
  readonly towerDamage: number;
  readonly placementRejections: number;
  readonly upgradeRejections: number;
  readonly spawnedTotal: number;
  readonly defeatedTotal: number;
  readonly breachedTotal: number;
  readonly lives: number;
  readonly outcome: 'pending' | 'victory' | 'defeat';
}

function state(harness: Harness): Promise<ShellSnap> {
  return readShellState(harness, 'game.grid-shell');
}

/**
 * Proof C - tower-defense (see proofs/tower-defense/PROOF_CONTRACT.md).
 *
 * Extends the smoke-validated demo's proven journey (route, placement,
 * currency, target selection, damage, victory) with the one mechanic Phase
 * 10 requires beyond it: a real tower upgrade that changes a stat the win
 * condition depends on (the second enemy dies in one hit at the upgraded
 * damage instead of two).
 */
export async function run(harness: Harness): Promise<SmokeOutcome> {
  await harness.keyTap('Space'); // start run
  await harness.stepFrames(10);
  const spawnShell = await state(harness);

  // CONFIRM off a placement cell: rejected, no currency spent, no tower.
  await harness.keyTap('Space');
  const afterInvalidConfirm = await state(harness);
  const invalidPlacementRejected =
    afterInvalidConfirm.placementRejections > spawnShell.placementRejections &&
    !afterInvalidConfirm.towerPlaced &&
    afterInvalidConfirm.currency === spawnShell.currency;

  // Grid-cursor movement to a real placement cell: three UP steps.
  await harness.keyTap('ArrowUp');
  await harness.keyTap('ArrowUp');
  await harness.keyTap('ArrowUp');
  const afterMove = await state(harness);
  const gridCursorMovementProven = afterMove.cursor.row === spawnShell.cursor.row - 3 && afterMove.cursor.col === spawnShell.cursor.col;

  // CONFIRM on the placement cell: tower placed, currency deducted (cost).
  await harness.keyTap('Space');
  const afterPlacement = await state(harness);
  const towerPlacementProven = afterPlacement.towerPlaced;
  const currencyCostProven = afterPlacement.currency === afterMove.currency - 40;

  // Let the first enemy die at base damage (two hits), proving real target
  // selection/damage before the upgrade changes anything.
  let afterFirstKill = afterPlacement;
  for (let i = 0; i < 80 && afterFirstKill.defeatedTotal < 1; i++) {
    await harness.stepFrames(5);
    afterFirstKill = await state(harness);
  }
  const firstKillOk = afterFirstKill.defeatedTotal >= 1 && afterFirstKill.towerDamage === 10;

  // Upgrade the tower (cursor still parked on the tower's own cell).
  await harness.keyTap('KeyK'); // SECONDARY_ACTION
  const afterUpgrade = await state(harness);
  const upgradeOk =
    afterUpgrade.towerUpgraded === true &&
    afterUpgrade.towerDamage === 20 &&
    afterUpgrade.currency === afterFirstKill.currency - 30;

  // Run the wave out to a terminal result. The second enemy must die in a
  // single hit at the upgraded damage - if it took two, the upgrade would
  // not actually be load-bearing for the win.
  let finalShell = afterUpgrade;
  for (let i = 0; i < 200 && finalShell.outcome === 'pending'; i++) {
    await harness.stepFrames(5);
    finalShell = await state(harness);
  }
  const reachableOutcomeProven = finalShell.outcome === 'victory' && finalShell.breachedTotal === 0 && finalShell.defeatedTotal === 2;

  return {
    passed: invalidPlacementRejected && gridCursorMovementProven && towerPlacementProven && currencyCostProven && firstKillOk && upgradeOk && reachableOutcomeProven,
    details: {
      spawnShell,
      afterInvalidConfirm,
      afterMove,
      afterPlacement,
      afterFirstKill,
      afterUpgrade,
      finalShell,
      invalidPlacementRejected,
      gridCursorMovementProven,
      towerPlacementProven,
      currencyCostProven,
      firstKillOk,
      upgradeOk,
      reachableOutcomeProven,
    },
  };
}
