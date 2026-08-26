import type Phaser from 'phaser';
import type { InstalledSystemPack } from '@sw2d/contracts';
import { gridController, type SceneContext, type ScenePackDefinition } from '@sw2d/runtime';
import { CAPABILITY_IDS, type CombatService, type ProgressionService } from '@sw2d/packs';
import { ProjectilePool } from './projectilePool.ts';

/**
 * Tower Defense demo (Phase 8 representative demo 9/12).
 *
 * Smoke contract: fixed route, one tower placement through a supported
 * input path, currency cost, one wave, tower damage, reachable outcome.
 * Spatial pointer/hover placement remains deferred (preset
 * knownLimitations); placement uses `gridController` - a keyboard-driven
 * cursor moved onto a designated placement cell, then CONFIRM - which is
 * the "keyboard/grid-selected placement is acceptable" path the Phase 8
 * directive explicitly allows while spatial pointer stays deferred.
 *
 * The route itself is hand-authored TypeScript, not a Tiled object: there
 * is no "Waypoint"/"Route" class in the nineteen-class catalog (ADR-0014),
 * the same conclusion sokoban's grid layout already reached for
 * puzzle-shaped, non-entity level data.
 */

const CELL_SIZE = 64;
const ROUTE_ROW = 4;
const ROUTE_COLS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;
const ROUTE: { x: number; y: number }[] = ROUTE_COLS.map((col) => ({
  x: col * CELL_SIZE + CELL_SIZE / 2,
  y: ROUTE_ROW * CELL_SIZE + CELL_SIZE / 2,
}));

const PLACEMENT_CELLS = [
  { col: 4, row: 3 },
  { col: 6, row: 3 },
  { col: 8, row: 3 },
] as const;

const CURSOR_START = { col: 6, row: 6 };

const TOWER_COST = 40;
const TOWER_RANGE = 150;
const TOWER_FIRE_COOLDOWN_MS = 300;
const PROJECTILE_DAMAGE = 10;
const PROJECTILE_SPEED = 360;

const ENEMY_MAX_HEALTH = 20;
const ENEMY_SPEED = 120; // px/s
const ENEMY_SPAWN_TIMES_MS = [0, 1500];

interface Cell {
  readonly col: number;
  readonly row: number;
}

function toPixel(cell: Cell): { x: number; y: number } {
  return { x: cell.col * CELL_SIZE + CELL_SIZE / 2, y: cell.row * CELL_SIZE + CELL_SIZE / 2 };
}

function isPlacementCell(cell: Cell): boolean {
  return PLACEMENT_CELLS.some((p) => p.col === cell.col && p.row === cell.row);
}

export const GAME_SPECIFIC_PACK: ScenePackDefinition = {
  id: 'game.grid-shell',
  version: '0.1.0',
  provides: [],
  dependencies: [CAPABILITY_IDS.progression, CAPABILITY_IDS.combat],

  install(context: SceneContext): InstalledSystemPack {
    const scene = context.scene;
    const progression = context.capabilities.require<ProgressionService>(CAPABILITY_IDS.progression);
    const combat = context.capabilities.require<CombatService>(CAPABILITY_IDS.combat);

    let cursor: Cell = { ...CURSOR_START };
    const cursorSprite = scene.add.sprite(...(Object.values(toPixel(cursor)) as [number, number]), context.assets.resolve('checkpoint'));

    for (const cell of PLACEMENT_CELLS) {
      const pos = toPixel(cell);
      scene.add.sprite(pos.x, pos.y, context.assets.resolve('platform')).setAlpha(0.3);
    }

    let towerPlaced = false;
    let towerPos: { x: number; y: number } | null = null;
    let towerSprite: Phaser.GameObjects.Sprite | null = null;
    let towerCooldownRemainingMs = 0;
    let placementRejections = 0;

    const pool = new ProjectilePool({
      scene,
      textureKey: context.assets.resolve('pickup'),
      displaySize: 8,
      lifetimeMs: 1500,
      worldWidth: context.definition.viewport.width,
      worldHeight: context.definition.viewport.height,
    });

    interface Enemy {
      readonly id: string;
      readonly sprite: Phaser.Physics.Arcade.Sprite;
      routeIndex: number;
      defeated: boolean;
      breached: boolean;
    }

    const enemies: Enemy[] = [];
    let nextEnemySeq = 0;
    let spawnedTotal = 0;
    let defeatedTotal = 0;
    let breachedTotal = 0;
    let lives = ENEMY_SPAWN_TIMES_MS.length;
    let outcome: 'pending' | 'victory' | 'defeat' = 'pending';
    let elapsedMs = 0;

    function spawnEnemy(): void {
      const id = `enemy-${nextEnemySeq++}`;
      const start = ROUTE[0]!;
      const sprite = scene.physics.add.sprite(start.x, start.y, context.assets.resolve('enemy'));
      sprite.body.setAllowGravity(false);
      combat.register(id, ENEMY_MAX_HEALTH);
      enemies.push({ id, sprite, routeIndex: 0, defeated: false, breached: false });
      spawnedTotal += 1;
    }

    function tryPlaceTower(): void {
      if (towerPlaced) return;
      if (!isPlacementCell(cursor)) {
        placementRejections += 1;
        return;
      }
      if (progression.currency() < TOWER_COST) {
        placementRejections += 1;
        return;
      }
      progression.addCurrency(-TOWER_COST);
      towerPos = toPixel(cursor);
      towerSprite = scene.add.sprite(towerPos.x, towerPos.y, context.assets.resolve('platform'));
      towerSprite.setTint(0x4a90d9);
      towerPlaced = true;
    }

    function moveEnemies(deltaMs: number): void {
      const step = (ENEMY_SPEED * deltaMs) / 1000;
      for (const enemy of enemies) {
        if (enemy.defeated || enemy.breached) continue;
        const target = ROUTE[enemy.routeIndex + 1];
        if (!target) {
          enemy.breached = true;
          breachedTotal += 1;
          lives -= 1;
          try {
            enemy.sprite.destroy();
          } catch {
            /* scene already tearing down */
          }
          continue;
        }
        const dx = target.x - enemy.sprite.x;
        const dy = target.y - enemy.sprite.y;
        const dist = Math.hypot(dx, dy);
        if (dist <= step) {
          enemy.sprite.setPosition(target.x, target.y);
          enemy.routeIndex += 1;
        } else {
          enemy.sprite.setPosition(enemy.sprite.x + (dx / dist) * step, enemy.sprite.y + (dy / dist) * step);
        }
      }
    }

    function fireTowerIfReady(deltaMs: number): void {
      if (!towerPlaced || !towerPos) return;
      towerCooldownRemainingMs -= deltaMs;
      if (towerCooldownRemainingMs > 0) return;

      let closest: Enemy | null = null;
      let closestDist = Infinity;
      for (const enemy of enemies) {
        if (enemy.defeated || enemy.breached) continue;
        const dist = Math.hypot(enemy.sprite.x - towerPos.x, enemy.sprite.y - towerPos.y);
        if (dist <= TOWER_RANGE && dist < closestDist) {
          closest = enemy;
          closestDist = dist;
        }
      }
      if (!closest) return;

      const dx = closest.sprite.x - towerPos.x;
      const dy = closest.sprite.y - towerPos.y;
      const dist = Math.hypot(dx, dy) || 1;
      const projectile = pool.spawn(towerPos.x, towerPos.y, (dx / dist) * PROJECTILE_SPEED, (dy / dist) * PROJECTILE_SPEED);
      towerCooldownRemainingMs = TOWER_FIRE_COOLDOWN_MS;

      const target = closest;
      scene.physics.add.overlap(projectile, target.sprite, () => {
        if (target.defeated || !combat.has(target.id)) return;
        const health = combat.damage(target.id, PROJECTILE_DAMAGE, elapsedMs);
        pool.remove(projectile);
        if (health.current <= 0) {
          target.defeated = true;
          defeatedTotal += 1;
          combat.remove(target.id);
          try {
            target.sprite.destroy();
          } catch {
            /* scene already tearing down */
          }
        }
      });
    }

    function updateOutcome(): void {
      if (outcome !== 'pending') return;
      if (lives <= 0) {
        outcome = 'defeat';
        return;
      }
      if (spawnedTotal === ENEMY_SPAWN_TIMES_MS.length && defeatedTotal + breachedTotal === ENEMY_SPAWN_TIMES_MS.length) {
        outcome = breachedTotal > 0 ? 'defeat' : 'victory';
      }
    }

    const debugHandle = context.debug.contribute('game.grid-shell', () => ({
      cursor,
      currency: progression.currency(),
      towerPlaced,
      placementRejections,
      spawnedTotal,
      defeatedTotal,
      breachedTotal,
      lives,
      outcome,
    }));

    let disposed = false;

    return {
      id: GAME_SPECIFIC_PACK.id,

      update(deltaMs: number): void {
        if (disposed) return;
        elapsedMs += deltaMs;

        for (let i = 0; i < ENEMY_SPAWN_TIMES_MS.length; i++) {
          if (elapsedMs >= ENEMY_SPAWN_TIMES_MS[i]! && spawnedTotal === i) {
            spawnEnemy();
          }
        }

        const intent = gridController.read(context.input);
        if (intent.step === 'up') cursor = { col: cursor.col, row: cursor.row - 1 };
        else if (intent.step === 'down') cursor = { col: cursor.col, row: cursor.row + 1 };
        else if (intent.step === 'left') cursor = { col: cursor.col - 1, row: cursor.row };
        else if (intent.step === 'right') cursor = { col: cursor.col + 1, row: cursor.row };
        if (intent.step) {
          const pos = toPixel(cursor);
          cursorSprite.setPosition(pos.x, pos.y);
        }
        if (intent.confirmPressed) tryPlaceTower();

        moveEnemies(deltaMs);
        fireTowerIfReady(deltaMs);
        pool.update(deltaMs);
        updateOutcome();
      },

      dispose(): void {
        if (disposed) return;
        disposed = true;
        debugHandle.dispose();
        pool.dispose();
        try {
          cursorSprite.destroy();
        } catch {
          /* scene already tearing down */
        }
        if (towerSprite) {
          try {
            towerSprite.destroy();
          } catch {
            /* scene already tearing down */
          }
        }
        for (const enemy of enemies) {
          try {
            enemy.sprite.destroy();
          } catch {
            /* scene already tearing down */
          }
        }
      },
    };
  },
};
