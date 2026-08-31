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
  readonly territory: { readonly mode: 'empty' | 'red' | 'contested'; readonly owner: string | null; readonly progress: number; readonly contested: boolean; readonly redScore: number };
  readonly autoCombat: { readonly phase: string; readonly winner: string | null; readonly units: readonly unknown[] };
  readonly farming: { readonly seeds: number; readonly turnips: number; readonly plot: { readonly phase: string } };
  readonly construction: { readonly resources: number; readonly sites: readonly { readonly phase: string }[] };
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

  // Semantic CANCEL (Backspace) moves red into the relay. It must capture,
  // accrue score while held, then freeze when blue enters - a majority does
  // not silently win a contested zone.
  await harness.keyTap('Backspace');
  await harness.stepFrames(60);
  const capturedRelay = await state(harness);
  await harness.keyTap('Backspace');
  await harness.stepFrames(12);
  const contestedRelay = await state(harness);
  const territoryProven =
    capturedRelay.territory.owner === 'red' &&
    capturedRelay.territory.redScore > 0 &&
    contestedRelay.territory.contested === true &&
    contestedRelay.territory.owner === 'red';

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

  // The auto-battler runs in this same browser runtime from authored content;
  // do not accept a source-only unit-test result as proof of composition.
  let autoBattle = finalShell;
  for (let i = 0; i < 160 && autoBattle.autoCombat.phase !== 'resolve'; i++) {
    await harness.stepFrames(5);
    autoBattle = await state(harness);
  }
  const autonomousCombatProven = autoBattle.autoCombat.phase === 'resolve' && autoBattle.autoCombat.winner === 'red';
  const farmingProven = autoBattle.farming.seeds === 0 && autoBattle.farming.turnips === 2 && autoBattle.farming.plot.phase === 'tilled';
  const constructionProven = autoBattle.construction.resources === 10 && autoBattle.construction.sites[0]?.phase === 'complete';

  return {
    passed: invalidPlacementRejected && gridCursorMovementProven && towerPlacementProven && currencyCostProven && territoryProven && firstKillOk && upgradeOk && reachableOutcomeProven && autonomousCombatProven && farmingProven && constructionProven,
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
      capturedRelay,
      contestedRelay,
      territoryProven,
      firstKillOk,
      upgradeOk,
      reachableOutcomeProven,
      autoBattle,
      autonomousCombatProven,
      farmingProven,
      constructionProven,
    },
  };
}
