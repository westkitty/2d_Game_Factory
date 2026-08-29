import type { InstalledSystemPack, PuzzleRulesService, PuzzleSnapshot } from '@sw2d/contracts';
import { PUZZLE_RULES_CAPABILITY_ID } from '@sw2d/contracts';
import { gridController, type SceneContext, type ScenePackDefinition } from '@sw2d/runtime';

/**
 * Proof D - sokoban (see ../PROOF_CONTRACT.md).
 *
 * As of the capability program's Phase 6 (ADR-0023) the ENTIRE Sokoban
 * ruleset - board dimensions, walls, box, goal, legal-move/legal-push
 * resolution, solved-detection, undo history, reset - lives in the reusable
 * `sw2d.puzzle-rules` service, fed the validated `content/puzzles.json`
 * document. This file holds no board state, no move rules and no undo stack
 * of its own: it maps a `gridController` step to one bounded `move` op,
 * CANCEL to `undo()`, SECONDARY_ACTION to `reset()`, and renders whatever
 * `puzzle.snapshot()` reports.
 */

const CELL_SIZE = 64;

interface SokobanSnap extends PuzzleSnapshot {
  readonly playerCol: number;
  readonly playerRow: number;
  readonly boxes: ReadonlyArray<readonly [number, number]>;
  readonly goals: ReadonlyArray<readonly [number, number]>;
}

export const GAME_SPECIFIC_PACK: ScenePackDefinition = {
  id: 'game.grid-shell',
  version: '0.1.0',
  provides: [],
  dependencies: [PUZZLE_RULES_CAPABILITY_ID],

  install(context: SceneContext): InstalledSystemPack {
    const scene = context.scene;
    const puzzle = context.capabilities.require<PuzzleRulesService>(PUZZLE_RULES_CAPABILITY_ID);
    const playerKey = context.assets.resolve('player');
    const boxKey = context.assets.resolve('platform');
    const goalKey = context.assets.resolve('checkpoint');

    let rejectedMoves = 0;

    const toPixel = (col: number, row: number): [number, number] => [
      col * CELL_SIZE + CELL_SIZE / 2,
      row * CELL_SIZE + CELL_SIZE / 2,
    ];

    const snap = (): SokobanSnap => puzzle.snapshot() as SokobanSnap;

    const first = snap();
    const goalSprites = first.goals.map((g) => scene.add.sprite(...toPixel(g[0], g[1]), goalKey).setAlpha(0.5));
    const boxSprites = first.boxes.map((b) => scene.add.sprite(...toPixel(b[0], b[1]), boxKey));
    const playerSprite = scene.add.sprite(...toPixel(first.playerCol, first.playerRow), playerKey);

    function syncSprites(): void {
      const s = snap();
      playerSprite.setPosition(...toPixel(s.playerCol, s.playerRow));
      s.boxes.forEach((b, i) => boxSprites[i]?.setPosition(...toPixel(b[0], b[1])));
    }

    const debugHandle = context.debug.contribute('game.grid-shell', () => {
      const s = snap();
      return {
        snapshot: s,
        solved: puzzle.isSolved(),
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
          const before = snap().moves;
          const after = puzzle.apply({ kind: 'move', dir: intent.step });
          if (after.moves === before) rejectedMoves += 1;
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
          for (const s of [...boxSprites, ...goalSprites]) s.destroy();
        } catch {
          /* scene already tearing down */
        }
      },
    };
  },
};
