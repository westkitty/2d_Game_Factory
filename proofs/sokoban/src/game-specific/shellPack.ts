import type { InstalledSystemPack } from '@sw2d/contracts';
import { gridController, type SceneContext, type ScenePackDefinition } from '@sw2d/runtime';
import { CAPABILITY_IDS, type PuzzleService } from '@sw2d/packs';
import { GOAL, isWall, pointsEqual, type Point, type SokobanState } from './packConfig.ts';

/**
 * Proof D - sokoban (Phase 10 deep proof, see ../PROOF_CONTRACT.md).
 *
 * `puzzle.current()` (from the real `sw2d.puzzle` pack, installed via
 * ../packConfig.ts's `configSource: 'code'` seam) is the ONLY board state -
 * this file holds no parallel player/box variables or undo stack of its
 * own, unlike the Phase 8 demo this proof supersedes for the generated
 * composition path.
 */

const CELL_SIZE = 64;
const DIRS: Readonly<Record<'up' | 'down' | 'left' | 'right', Point>> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

/** Standard Sokoban rule: step into empty floor moves the player; step into the box pushes it one further cell if that cell is clear. Returns null for a rejected move - the caller must not touch history for those. */
function attemptMove(state: SokobanState, delta: Point): SokobanState | null {
  const target: Point = { x: state.player.x + delta.x, y: state.player.y + delta.y };
  if (isWall(target)) return null;
  if (pointsEqual(target, state.box)) {
    const beyond: Point = { x: target.x + delta.x, y: target.y + delta.y };
    if (isWall(beyond)) return null;
    return { player: target, box: beyond };
  }
  return { player: target, box: state.box };
}

export const GAME_SPECIFIC_PACK: ScenePackDefinition = {
  id: 'game.grid-shell',
  version: '0.1.0',
  provides: [],
  dependencies: [CAPABILITY_IDS.puzzle],

  install(context: SceneContext): InstalledSystemPack {
    const scene = context.scene;
    const puzzle = context.capabilities.require<PuzzleService<SokobanState>>(CAPABILITY_IDS.puzzle);
    const playerKey = context.assets.resolve('player');
    const boxKey = context.assets.resolve('platform');
    const goalKey = context.assets.resolve('checkpoint');

    let rejectedMoves = 0;

    const toPixel = (point: Point): [number, number] => [point.x * CELL_SIZE + CELL_SIZE / 2, point.y * CELL_SIZE + CELL_SIZE / 2];

    const goalSprite = scene.add.sprite(...toPixel(GOAL), goalKey).setAlpha(0.5);
    const boxSprite = scene.add.sprite(...toPixel(puzzle.current().box), boxKey);
    const playerSprite = scene.add.sprite(...toPixel(puzzle.current().player), playerKey);

    function syncSprites(): void {
      const state = puzzle.current();
      playerSprite.setPosition(...toPixel(state.player));
      boxSprite.setPosition(...toPixel(state.box));
    }

    const debugHandle = context.debug.contribute('game.grid-shell', () => {
      const state = puzzle.current();
      return {
        state,
        solved: puzzle.isSolved(),
        visibleComplete: pointsEqual(state.box, GOAL),
        rejectedMoves,
      };
    });

    let disposed = false;

    return {
      id: GAME_SPECIFIC_PACK.id,

      update(): void {
        if (disposed) return;
        const intent = gridController.read(context.input);
        if (intent.step) {
          const next = attemptMove(puzzle.current(), DIRS[intent.step]);
          if (next) puzzle.apply(() => next);
          else rejectedMoves += 1;
        }
        if (context.input.consumePress('CANCEL')) puzzle.undo();
        if (context.input.consumePress('SECONDARY_ACTION')) puzzle.reset();
        syncSprites();
      },

      dispose(): void {
        if (disposed) return;
        disposed = true;
        debugHandle.dispose();
        try {
          playerSprite.destroy();
          boxSprite.destroy();
          goalSprite.destroy();
        } catch {
          /* scene already tearing down */
        }
      },
    };
  },
};
