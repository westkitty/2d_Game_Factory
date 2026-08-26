import type { InstalledSystemPack } from '@sw2d/contracts';
import { gridController, type SceneContext, type ScenePackDefinition } from '@sw2d/runtime';

/**
 * Sokoban demo (Phase 8 representative demo 8/12).
 *
 * Smoke contract: grid movement, box push, invalid push rejection, solved
 * condition, reset, exact undo.
 *
 * `sw2d.puzzle`'s config (LIMITATIONS.puzzleConfigIsCode) is TypeScript
 * functions (createInitialState/isSolved), not JSON-serializable data - so
 * it cannot be configured through content/game.json's declarative
 * systemPacks the way every other pack here is (this is a real Phase 8
 * finding, recorded in docs/architecture/PHASE8_OPUS_GATE_B_HANDOFF.md).
 * This demo therefore implements grid/push/undo/solved state directly, in
 * the exact shape PuzzleService already defines (current/apply/undo/reset/
 * isSolved) so the equivalence is inspectable, without going through the
 * capability registry. content/game.json for this demo does not select
 * `sw2d.puzzle` for that reason - only this shell pack.
 *
 * The puzzle itself is a fixed, hand-authored 6x3 grid - Tiled has no
 * "Box"/"Goal"/"Wall" object class (the object-class catalog stays at
 * nineteen, ADR-0014), so grid puzzle layouts are game-specific TypeScript,
 * the same conclusion puzzle-platformer's own limitation already states.
 */

interface Cell {
  readonly col: number;
  readonly row: number;
}

interface GridState {
  readonly player: Cell;
  readonly box: Cell;
}

const GOAL: Cell = { col: 4, row: 1 };
const WALLS = new Set(['0,0', '1,0', '2,0', '3,0', '4,0', '5,0', '0,1', '5,1', '0,2', '1,2', '2,2', '3,2', '4,2', '5,2']);
const CELL_SIZE = 64;
const INITIAL_STATE: GridState = { player: { col: 1, row: 1 }, box: { col: 2, row: 1 } };

function key(cell: Cell): string {
  return `${cell.col},${cell.row}`;
}

function isWall(cell: Cell): boolean {
  return WALLS.has(key(cell));
}

function step(cell: Cell, dCol: number, dRow: number): Cell {
  return { col: cell.col + dCol, row: cell.row + dRow };
}

function isSolved(state: GridState): boolean {
  return state.box.col === GOAL.col && state.box.row === GOAL.row;
}

function toPixel(cell: Cell): { x: number; y: number } {
  return { x: cell.col * CELL_SIZE + CELL_SIZE / 2, y: cell.row * CELL_SIZE + CELL_SIZE / 2 };
}

export const GAME_SPECIFIC_PACK: ScenePackDefinition = {
  id: 'game.grid-shell',
  version: '0.1.0',
  provides: [],
  dependencies: [],

  install(context: SceneContext): InstalledSystemPack {
    const scene = context.scene;

    let current: GridState = INITIAL_STATE;
    const history: GridState[] = [];
    let rejectedPushes = 0;

    const playerSprite = scene.add.sprite(0, 0, context.assets.resolve('player'));
    const boxSprite = scene.add.sprite(0, 0, context.assets.resolve('platform'));
    const goalSprite = scene.add.sprite(...(Object.values(toPixel(GOAL)) as [number, number]), context.assets.resolve('checkpoint'));

    function render(): void {
      const playerPos = toPixel(current.player);
      const boxPos = toPixel(current.box);
      playerSprite.setPosition(playerPos.x, playerPos.y);
      boxSprite.setPosition(boxPos.x, boxPos.y);
    }
    render();

    /** Same shape as PuzzleService.apply(): pure transform, only committed if it returns a different, legal state. */
    function tryMove(dCol: number, dRow: number): void {
      const nextPlayer = step(current.player, dCol, dRow);
      if (isWall(nextPlayer)) return; // walking into a wall: not a push, just a no-op

      if (nextPlayer.col === current.box.col && nextPlayer.row === current.box.row) {
        const nextBox = step(current.box, dCol, dRow);
        if (isWall(nextBox)) {
          rejectedPushes += 1;
          return; // invalid push: box can't move there, so the player doesn't either
        }
        history.push(current);
        current = { player: nextPlayer, box: nextBox };
        render();
        return;
      }

      history.push(current);
      current = { player: nextPlayer, box: current.box };
      render();
    }

    function undo(): void {
      const previous = history.pop();
      if (!previous) return;
      current = previous;
      render();
    }

    function reset(): void {
      current = INITIAL_STATE;
      history.length = 0;
      render();
    }

    const debugHandle = context.debug.contribute('game.grid-shell', () => ({
      player: current.player,
      box: current.box,
      solved: isSolved(current),
      rejectedPushes,
      historyLength: history.length,
    }));

    let disposed = false;

    return {
      id: GAME_SPECIFIC_PACK.id,

      update(): void {
        if (disposed) return;
        const intent = gridController.read(context.input);
        if (intent.step === 'up') tryMove(0, -1);
        else if (intent.step === 'down') tryMove(0, 1);
        else if (intent.step === 'left') tryMove(-1, 0);
        else if (intent.step === 'right') tryMove(1, 0);
        else if (intent.confirmPressed) reset();
        else if (intent.cancelPressed) undo();
      },

      dispose(): void {
        if (disposed) return;
        disposed = true;
        debugHandle.dispose();
        try {
          playerSprite.destroy();
        } catch {
          /* scene already tearing down */
        }
        try {
          boxSprite.destroy();
        } catch {
          /* scene already tearing down */
        }
        try {
          goalSprite.destroy();
        } catch {
          /* scene already tearing down */
        }
      },
    };
  },
};
