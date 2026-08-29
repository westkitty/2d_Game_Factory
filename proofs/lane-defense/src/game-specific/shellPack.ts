import type Phaser from 'phaser';
import {
  NAV_CAPABILITY_ID,
  createRouteFollower,
  type InstalledSystemPack,
  type NavGrid,
  type NavService,
  type RouteFollower,
} from '@sw2d/contracts';
import { gridController, type SceneContext, type ScenePackDefinition } from '@sw2d/runtime';

/**
 * Phase 5 proof - lane-defense. Enemies follow deterministic routes from
 * `sw2d.navigation` toward the base; placing a blocker re-routes every living
 * enemy through `RouteFollower`, and a placement that would leave any enemy
 * with no route at all is rejected - a dynamic block can never permanently
 * invalidate the lane. No hand-rolled pathfinding.
 */

const COLS = 12;
const ROWS = 3;
const CELL = 50;
const ENEMY_SPEED = 140; // px/s
const BASE_CELL = { col: 11, row: 1 };
const SPAWN_ROWS = [0, 1, 2];

interface Enemy {
  readonly id: string;
  readonly sprite: Phaser.GameObjects.Sprite;
  readonly follower: RouteFollower;
  x: number;
  y: number;
  reached: boolean;
}

export const GAME_SPECIFIC_PACK: ScenePackDefinition = {
  id: 'game.grid-shell',
  version: '0.1.0',
  provides: [],
  dependencies: [],

  install(context: SceneContext): InstalledSystemPack {
    const scene = context.scene;
    const nav = context.capabilities.require<NavService>(NAV_CAPABILITY_ID);
    const grid: NavGrid = nav.defineGrid('lane', { cols: COLS, rows: ROWS, cellSize: CELL });

    const baseWorld = grid.cellToWorld(BASE_CELL.col, BASE_CELL.row);
    scene.add.rectangle(baseWorld[0], baseWorld[1], CELL - 6, CELL - 6, 0x4f9ee0);

    let cursor = { col: 4, row: 1 };
    const cursorSprite = scene.add.sprite(...(grid.cellToWorld(cursor.col, cursor.row) as [number, number]), context.assets.resolve('checkpoint')).setAlpha(0.6);

    const enemies: Enemy[] = [];
    for (const row of SPAWN_ROWS) {
      const [x, y] = grid.cellToWorld(0, row);
      const follower = createRouteFollower();
      follower.setDestination(grid, x, y, BASE_CELL.col, BASE_CELL.row);
      const sprite = scene.add.sprite(x, y, context.assets.resolve('enemy'));
      enemies.push({ id: `lane-${row}`, sprite, follower, x, y, reached: false });
    }

    let enemiesRepathed = 0;
    let blockersPlaced = 0;
    let blockRejected = 0;
    let reachedBase = 0;
    const blockerSprites: Phaser.GameObjects.Rectangle[] = [];

    function everyLivingEnemyStillHasARoute(): boolean {
      return enemies.every((e) => {
        if (e.reached) return true;
        const from = grid.worldToCell(e.x, e.y);
        return grid.findPath(from, BASE_CELL) !== null;
      });
    }

    function tryPlaceBlocker(): void {
      if (!grid.isWalkable(cursor.col, cursor.row)) return;
      if (cursor.col === BASE_CELL.col && cursor.row === BASE_CELL.row) return;
      grid.setWalkable(cursor.col, cursor.row, false);
      if (!everyLivingEnemyStillHasARoute()) {
        grid.setWalkable(cursor.col, cursor.row, true); // roll back
        blockRejected += 1;
        return;
      }
      blockersPlaced += 1;
      const [x, y] = grid.cellToWorld(cursor.col, cursor.row);
      blockerSprites.push(scene.add.rectangle(x, y, CELL - 8, CELL - 8, 0x39415a));
      for (const e of enemies) {
        if (e.reached) continue;
        if (e.follower.setDestination(grid, e.x, e.y, BASE_CELL.col, BASE_CELL.row)) enemiesRepathed += 1;
      }
    }

    const debugHandle = context.debug.contribute('game.grid-shell', () => ({
      enemiesActive: enemies.filter((e) => !e.reached).length,
      enemiesRepathed,
      blockersPlaced,
      blockRejected,
      reachedBase,
      cursorCol: cursor.col,
      cursorRow: cursor.row,
      enemyCols: enemies.map((e) => grid.worldToCell(e.x, e.y).col),
    }));

    let disposed = false;
    return {
      id: GAME_SPECIFIC_PACK.id,

      update(deltaMs: number): void {
        if (disposed) return;
        const intent = gridController.read(context.input);
        if (intent.step === 'up') cursor = { ...cursor, row: Math.max(0, cursor.row - 1) };
        if (intent.step === 'down') cursor = { ...cursor, row: Math.min(ROWS - 1, cursor.row + 1) };
        if (intent.step === 'left') cursor = { ...cursor, col: Math.max(0, cursor.col - 1) };
        if (intent.step === 'right') cursor = { ...cursor, col: Math.min(COLS - 1, cursor.col + 1) };
        if (intent.step) cursorSprite.setPosition(...(grid.cellToWorld(cursor.col, cursor.row) as [number, number]));
        if (intent.confirmPressed) tryPlaceBlocker();

        const step = (ENEMY_SPEED * deltaMs) / 1000;
        for (const e of enemies) {
          if (e.reached) continue;
          const r = e.follower.step(e.x, e.y, step);
          e.x = r.x;
          e.y = r.y;
          e.sprite.setPosition(r.x, r.y);
          if (r.arrived) {
            e.reached = true;
            reachedBase += 1;
            try {
              e.sprite.destroy();
            } catch {
              /* tearing down */
            }
          }
        }
      },

      dispose(): void {
        if (disposed) return;
        disposed = true;
        debugHandle.dispose();
        nav.remove('lane');
        for (const e of enemies) {
          try {
            e.sprite.destroy();
          } catch {
            /* tearing down */
          }
        }
        for (const b of blockerSprites) {
          try {
            b.destroy();
          } catch {
            /* tearing down */
          }
        }
      },
    };
  },
};
