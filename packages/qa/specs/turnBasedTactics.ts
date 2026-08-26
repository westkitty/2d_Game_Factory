import { readShellState } from '../src/snapshot.ts';
import type { Harness } from '../src/harness.ts';
import type { SmokeOutcome } from '../src/smokeRunner.ts';

interface Cell {
  readonly col: number;
  readonly row: number;
}

interface UnitSnap {
  readonly id: string;
  readonly team: string;
  readonly cell: Cell;
  readonly alive: boolean;
  readonly health: number;
}

interface ShellSnap {
  readonly cursor: Cell;
  readonly teams: readonly string[];
  readonly activeTeam: string | null;
  readonly turnNumber: number;
  readonly selected: string | null;
  readonly units: readonly UnitSnap[];
  readonly moveRejections: number;
  readonly attackRejections: number;
}

function state(harness: Harness): Promise<ShellSnap> {
  return readShellState(harness, 'game.grid-shell');
}

function unit(shell: ShellSnap, id: string): UnitSnap {
  return shell.units.find((u) => u.id === id)!;
}

const UNIT_MAX_HEALTH_MINUS_DAMAGE = 30 - 15;

/**
 * Smoke contract: two sides, select unit, legal-range move, attack/damage,
 * turn advance. No general pathfinder required.
 */
export async function run(harness: Harness): Promise<SmokeOutcome> {
  await harness.keyTap('Space'); // start run
  await harness.stepFrames(10);

  const spawnShell = await state(harness);
  const twoSidesProven = spawnShell.teams.length === 2 && spawnShell.teams.includes('A') && spawnShell.teams.includes('B');
  const activeTeamAtStart = spawnShell.activeTeam;

  // Cursor starts on player-1's cell: CONFIRM selects it (active team A).
  await harness.keyTap('Space');
  const afterSelect = await state(harness);
  const selectUnitProven = afterSelect.selected === 'player-1';

  // Legal-range move: player-1 (2,4) -> (3,4), Manhattan distance 1 <= range 2.
  await harness.keyTap('ArrowRight');
  const afterMoveCursor = await state(harness);
  await harness.keyTap('Space');
  const afterMove = await state(harness);
  const legalMoveProven =
    unit(afterMove, 'player-1').cell.col === unit(afterSelect, 'player-1').cell.col + 1 && afterMove.selected === null && afterMove.moveRejections === spawnShell.moveRejections;

  // Re-select player-1 (now adjacent to enemy-1 at (4,4)), move cursor onto
  // enemy-1's cell, and CONFIRM to attack - proves attack/damage.
  await harness.keyTap('Space'); // select player-1 again
  const afterReselect = await state(harness);
  await harness.keyTap('ArrowRight'); // cursor (3,4) -> (4,4), enemy-1's cell
  await harness.keyTap('Space'); // attack
  const afterAttack = await state(harness);
  const attackDamageProven = unit(afterAttack, 'enemy-1').health < unit(afterReselect, 'enemy-1').health && unit(afterAttack, 'enemy-1').health === UNIT_MAX_HEALTH_MINUS_DAMAGE;

  // Turn advance: SECONDARY_ACTION hands the turn to team B.
  await harness.keyTap('KeyK');
  const afterTurnAdvance = await state(harness);
  const turnAdvanceProven = afterTurnAdvance.activeTeam !== activeTeamAtStart && afterTurnAdvance.turnNumber === spawnShell.turnNumber + 1;

  return {
    passed: twoSidesProven && selectUnitProven && legalMoveProven && attackDamageProven && turnAdvanceProven,
    details: {
      spawnShell,
      afterSelect,
      afterMoveCursor,
      afterMove,
      afterReselect,
      afterAttack,
      afterTurnAdvance,
      twoSidesProven,
      selectUnitProven,
      legalMoveProven,
      attackDamageProven,
      turnAdvanceProven,
    },
  };
}
