import type { InstalledSystemPack, NormalizedLevel, PuzzleRulesService } from '@sw2d/contracts';
import { PUZZLE_RULES_CAPABILITY_ID } from '@sw2d/contracts';
import { bindStarterNavigation, bindStarterPuzzle, bindStarterStrategy, gridController, type SceneContext, type ScenePackDefinition } from '@sw2d/runtime';
import { NAV_STARTER, STRATEGY_STARTER } from './packConfig.ts';

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
 *
 * When `STRATEGY_STARTER` is tactics (Category-C Wave 18) the dummy
 * wanderer is replaced by a select-then-step occupation of a FLAG cell
 * on `sw2d.strategy`. Attack-range stays leftover.
 *
 * When `NAV_STARTER` is maze or lane (Category-C Wave 19) the dummy
 * wanderer is replaced by walkable occupancy or autonomous route-follow
 * on `sw2d.navigation`. Fog-of-war, spawn scheduling and combat stay leftover.
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
    const turns = bindStarterStrategy(context, { mode: STRATEGY_STARTER });
    const route = bindStarterNavigation(context, { mode: NAV_STARTER });

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
    if (board.active || turns.active || route.active) actor.setVisible(false);

    const debugHandle = context.debug.contribute('game.grid-shell', () => ({
      col,
      row,
      ...(puzzle ? { puzzle: puzzle.snapshot(), solved: puzzle.isSolved() } : {}),
      ...(board.active ? { puzzleBoard: board.snapshot() } : {}),
      ...(turns.active ? { strategy: turns.snapshot() } : {}),
      ...(route.active ? { navigation: route.snapshot() } : {}),
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

        if (turns.active) {
          if (intent.step) turns.step(intent.step);
          if (context.input.justPressed('PRIMARY_ACTION')) turns.act();
          if (intent.confirmPressed) turns.confirm();
          turns.tick(deltaMs);
          return;
        }

        if (route.active) {
          if (intent.step) route.step(intent.step);
          if (context.input.justPressed('PRIMARY_ACTION')) route.act();
          route.tick(deltaMs);
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
        turns.dispose();
        route.dispose();
        try {
          actor.destroy();
        } catch {
          /* scene already tearing down */
        }
      },
    };
  },
};
