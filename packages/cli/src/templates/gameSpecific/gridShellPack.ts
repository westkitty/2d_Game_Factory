import type { InstalledSystemPack, NormalizedLevel, PuzzleRulesService } from '@sw2d/contracts';
import { PUZZLE_RULES_CAPABILITY_ID } from '@sw2d/contracts';
import { bindStarterPuzzle, gridController, type SceneContext, type ScenePackDefinition } from '@sw2d/runtime';

/**
 * Generated starter shell: grid controller family.
 *
 * One discrete cell per physical press, no physics body - `gridController`
 * already guarantees at most one `step` per frame. See
 * platformShellPack.ts's file comment for the template pattern.
 *
 * If the preset installs `sw2d.puzzle-rules` (capability program Phase 6),
 * this shell drives the reusable puzzle service instead of free-roaming the
 * actor. Sokoban stays a player-cell `move` / undo / reset loop. Match and
 * falling-block (Category-C Wave 9) bind `bindStarterPuzzle` so swap /
 * gravity / line-clear come from `content/puzzles.json` - no game-specific
 * rule code here.
 */

const LEVEL_DOCUMENT = 'levels/main';
const CELL_SIZE = 32;

export const GAME_SPECIFIC_PACK: ScenePackDefinition = {
  id: 'game.grid-shell',
  version: '0.1.0',
  provides: [],
  dependencies: [],

  install(context: SceneContext): InstalledSystemPack {
    const scene = context.scene;
    const level = context.content.data[LEVEL_DOCUMENT]?.value as NormalizedLevel | undefined;
    const playerKey = context.assets.resolve('player');
    const { width, height } = context.definition.viewport;

    const puzzle = context.capabilities.get<PuzzleRulesService>(PUZZLE_RULES_CAPABILITY_ID);
    const board = bindStarterPuzzle(context);

    const spawn = level?.objects.find((object) => object.class === 'PlayerSpawn');
    let col = Math.round((spawn?.x ?? width * 0.5) / CELL_SIZE);
    let row = Math.round((spawn?.y ?? height * 0.5) / CELL_SIZE);
    const minCol = 0;
    const minRow = 0;
    const maxCol = Math.floor(width / CELL_SIZE) - 1;
    const maxRow = Math.floor(height / CELL_SIZE) - 1;

    // With a puzzle loaded, the actor tracks the puzzle's own player cell.
    const puzzlePlayerCell = (): { col: number; row: number } => {
      const snap = puzzle?.snapshot() as { playerCol?: number; playerRow?: number } | undefined;
      return { col: snap?.playerCol ?? col, row: snap?.playerRow ?? row };
    };
    if (puzzle && !board.active) {
      const cell = puzzlePlayerCell();
      col = cell.col;
      row = cell.row;
    }

    const actor = scene.add.sprite(col * CELL_SIZE, row * CELL_SIZE, playerKey);
    if (board.active) actor.setVisible(false);

    const debugHandle = context.debug.contribute('game.grid-shell', () => ({
      col,
      row,
      ...(puzzle ? { puzzle: puzzle.snapshot(), solved: puzzle.isSolved() } : {}),
      ...(board.active ? { puzzleBoard: board.snapshot() } : {}),
    }));

    let disposed = false;

    return {
      id: GAME_SPECIFIC_PACK.id,

      update(deltaMs: number): void {
        if (disposed) return;
        const intent = gridController.read(context.input);

        if (board.active) {
          if (intent.step) board.step(intent.step);
          if (intent.confirmPressed) board.confirm();
          if (intent.cancelPressed) board.cancel();
          if (context.input.consumePress('SECONDARY_ACTION')) board.secondary();
          board.tick(deltaMs);
          return;
        }

        if (puzzle) {
          if (intent.step) puzzle.apply({ kind: 'move', dir: intent.step });
          if (context.input.consumePress('CANCEL')) puzzle.undo();
          if (context.input.consumePress('SECONDARY_ACTION')) puzzle.reset();
          const cell = puzzlePlayerCell();
          col = cell.col;
          row = cell.row;
          actor.setPosition(col * CELL_SIZE, row * CELL_SIZE);
          return;
        }

        if (intent.step === 'up' && row > minRow) row -= 1;
        else if (intent.step === 'down' && row < maxRow) row += 1;
        else if (intent.step === 'left' && col > minCol) col -= 1;
        else if (intent.step === 'right' && col < maxCol) col += 1;
        actor.setPosition(col * CELL_SIZE, row * CELL_SIZE);
      },

      dispose(): void {
        if (disposed) return;
        disposed = true;
        debugHandle.dispose();
        board.dispose();
        try {
          actor.destroy();
        } catch {
          /* scene already tearing down */
        }
      },
    };
  },
};
