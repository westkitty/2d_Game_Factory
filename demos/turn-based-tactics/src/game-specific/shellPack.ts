import type Phaser from 'phaser';
import type { InstalledSystemPack } from '@sw2d/contracts';
import { gridController, type SceneContext, type ScenePackDefinition } from '@sw2d/runtime';
import { CAPABILITY_IDS, type CombatService, type StrategyService } from '@sw2d/packs';

/**
 * Turn-Based Tactics demo (Phase 8 representative demo 10/12).
 *
 * Smoke contract: two sides, select unit, legal-range move, attack/damage,
 * turn advance. No general pathfinder required (preset knownLimitations:
 * "movement range, attack range, pathfinding, and turn-action resolution
 * are not reusable systems yet") - legal range here is a plain Manhattan-
 * distance check, no flood fill or A*, matching `sw2d.strategy`'s own
 * documented scope (teams/turn/selection only, MASTER_PROJECT.md §9).
 */

const CELL_SIZE = 64;
const MOVE_RANGE = 2;
const ATTACK_RANGE = 1;
const UNIT_MAX_HEALTH = 30;
const ATTACK_DAMAGE = 15;

interface Cell {
  readonly col: number;
  readonly row: number;
}

function toPixel(cell: Cell): { x: number; y: number } {
  return { x: cell.col * CELL_SIZE + CELL_SIZE / 2, y: cell.row * CELL_SIZE + CELL_SIZE / 2 };
}

function manhattan(a: Cell, b: Cell): number {
  return Math.abs(a.col - b.col) + Math.abs(a.row - b.row);
}

function sameCell(a: Cell, b: Cell): boolean {
  return a.col === b.col && a.row === b.row;
}

interface Unit {
  readonly id: string;
  readonly team: string;
  cell: Cell;
  alive: boolean;
  readonly sprite: Phaser.GameObjects.Sprite;
}

export const GAME_SPECIFIC_PACK: ScenePackDefinition = {
  id: 'game.grid-shell',
  version: '0.1.0',
  provides: [],
  dependencies: [CAPABILITY_IDS.strategy, CAPABILITY_IDS.combat],

  install(context: SceneContext): InstalledSystemPack {
    const scene = context.scene;
    const strategy = context.capabilities.require<StrategyService>(CAPABILITY_IDS.strategy);
    const combat = context.capabilities.require<CombatService>(CAPABILITY_IDS.combat);

    strategy.registerTeam('A');
    strategy.registerTeam('B');
    strategy.advanceTurn(); // activeTeam() -> 'A'

    const units: Unit[] = [
      {
        id: 'player-1',
        team: 'A',
        cell: { col: 2, row: 4 },
        alive: true,
        sprite: scene.add.sprite(...(Object.values(toPixel({ col: 2, row: 4 })) as [number, number]), context.assets.resolve('player')),
      },
      {
        id: 'enemy-1',
        team: 'B',
        cell: { col: 4, row: 4 },
        alive: true,
        sprite: scene.add.sprite(...(Object.values(toPixel({ col: 4, row: 4 })) as [number, number]), context.assets.resolve('enemy')),
      },
    ];
    combat.register('player-1', UNIT_MAX_HEALTH);
    combat.register('enemy-1', UNIT_MAX_HEALTH);

    let cursor: Cell = { ...units[0]!.cell };
    const cursorSprite = scene.add.sprite(...(Object.values(toPixel(cursor)) as [number, number]), context.assets.resolve('checkpoint'));
    cursorSprite.setAlpha(0.6);

    let moveRejections = 0;
    let attackRejections = 0;
    let elapsedMs = 0;

    function unitAt(cell: Cell): Unit | undefined {
      return units.find((u) => u.alive && sameCell(u.cell, cell));
    }

    function trySelectOrAct(): void {
      const selectedId = strategy.selected();
      const occupant = unitAt(cursor);

      if (!selectedId) {
        if (occupant && occupant.team === strategy.activeTeam()) strategy.select(occupant.id);
        return;
      }

      const selectedUnit = units.find((u) => u.id === selectedId)!;

      if (occupant && occupant.id === selectedUnit.id) return; // re-confirming own cell: no-op

      if (occupant) {
        // Attack: only a unit on the opposing team, within attack range.
        if (occupant.team === selectedUnit.team || manhattan(selectedUnit.cell, occupant.cell) > ATTACK_RANGE) {
          attackRejections += 1;
          return;
        }
        const health = combat.damage(occupant.id, ATTACK_DAMAGE, elapsedMs);
        if (health.current <= 0) {
          occupant.alive = false;
          combat.remove(occupant.id);
          try {
            occupant.sprite.destroy();
          } catch {
            /* scene already tearing down */
          }
        }
        return;
      }

      // Move: empty cell within move range.
      if (manhattan(selectedUnit.cell, cursor) > MOVE_RANGE) {
        moveRejections += 1;
        return;
      }
      selectedUnit.cell = { ...cursor };
      const pos = toPixel(selectedUnit.cell);
      selectedUnit.sprite.setPosition(pos.x, pos.y);
      strategy.deselect();
    }

    const debugHandle = context.debug.contribute('game.grid-shell', () => ({
      cursor,
      teams: strategy.teams(),
      activeTeam: strategy.activeTeam(),
      turnNumber: strategy.turnNumber(),
      selected: strategy.selected(),
      units: units.map((u) => ({
        id: u.id,
        team: u.team,
        cell: u.cell,
        alive: u.alive,
        health: combat.has(u.id) ? combat.get(u.id).current : 0,
      })),
      moveRejections,
      attackRejections,
    }));

    let disposed = false;

    return {
      id: GAME_SPECIFIC_PACK.id,

      update(deltaMs: number): void {
        if (disposed) return;
        elapsedMs += deltaMs;

        const intent = gridController.read(context.input);
        if (intent.step === 'up') cursor = { col: cursor.col, row: cursor.row - 1 };
        else if (intent.step === 'down') cursor = { col: cursor.col, row: cursor.row + 1 };
        else if (intent.step === 'left') cursor = { col: cursor.col - 1, row: cursor.row };
        else if (intent.step === 'right') cursor = { col: cursor.col + 1, row: cursor.row };
        if (intent.step) {
          const pos = toPixel(cursor);
          cursorSprite.setPosition(pos.x, pos.y);
        }
        if (intent.confirmPressed) trySelectOrAct();
        if (intent.cancelPressed) strategy.deselect();
        if (context.input.justPressed('SECONDARY_ACTION')) strategy.advanceTurn();
      },

      dispose(): void {
        if (disposed) return;
        disposed = true;
        debugHandle.dispose();
        try {
          cursorSprite.destroy();
        } catch {
          /* scene already tearing down */
        }
        for (const unit of units) {
          try {
            unit.sprite.destroy();
          } catch {
            /* scene already tearing down */
          }
        }
      },
    };
  },
};
