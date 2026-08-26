import { readShellState } from '../src/snapshot.ts';
import type { Harness } from '../src/harness.ts';
import type { SmokeOutcome } from '../src/smokeRunner.ts';

interface ShellSnap {
  readonly cursor: { readonly col: number; readonly row: number };
  readonly currency: number;
  readonly towerPlaced: boolean;
  readonly placementRejections: number;
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
 * Smoke contract: fixed route, one tower placement via a supported input
 * path, currency cost, one wave, tower damage, reachable outcome.
 */
export async function run(harness: Harness): Promise<SmokeOutcome> {
  await harness.keyTap('Space'); // start run
  await harness.stepFrames(10);

  const spawnShell = await state(harness);

  // CONFIRM off a placement cell: rejected, no currency spent, no tower.
  await harness.keyTap('Space');
  const afterInvalidConfirm = await state(harness);
  const invalidPlacementRejected =
    afterInvalidConfirm.placementRejections > spawnShell.placementRejections && !afterInvalidConfirm.towerPlaced && afterInvalidConfirm.currency === spawnShell.currency;

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
  const currencyCostProven = afterPlacement.currency < afterMove.currency && afterPlacement.currency === afterMove.currency - 40;

  // Run the wave out: poll until the outcome resolves (route length /
  // enemy speed bounds this well under the poll budget).
  let finalShell = afterPlacement;
  for (let i = 0; i < 200 && finalShell.outcome === 'pending'; i++) {
    await harness.stepFrames(5);
    finalShell = await state(harness);
  }

  const waveProven = finalShell.spawnedTotal === 2;
  const towerDamageProven = finalShell.defeatedTotal > 0;
  const reachableOutcomeProven = finalShell.outcome === 'victory' && finalShell.breachedTotal === 0 && finalShell.defeatedTotal === 2;

  return {
    passed:
      invalidPlacementRejected &&
      gridCursorMovementProven &&
      towerPlacementProven &&
      currencyCostProven &&
      waveProven &&
      towerDamageProven &&
      reachableOutcomeProven,
    details: {
      spawnShell,
      afterInvalidConfirm,
      afterMove,
      afterPlacement,
      finalShell,
      invalidPlacementRejected,
      gridCursorMovementProven,
      towerPlacementProven,
      currencyCostProven,
      waveProven,
      towerDamageProven,
      reachableOutcomeProven,
    },
  };
}
