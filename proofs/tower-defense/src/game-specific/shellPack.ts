import type Phaser from 'phaser';
import type { InstalledSystemPack } from '@sw2d/contracts';
import { gridController, ProjectilePool, type SceneContext, type ScenePackDefinition } from '@sw2d/runtime';
import { CAPABILITY_IDS, type AutoCombatService, type CombatService, type ConstructionService, type DefenseService, type FarmingService, type ItemsService, type TerritoryService } from '@sw2d/packs';

/**
 * Proof C - tower-defense (Phase 10 deep proof, see ../PROOF_CONTRACT.md).
 *
 * Placement uses `gridController` - a keyboard-driven cursor moved onto a
 * designated placement cell, then CONFIRM - the "keyboard/grid-selected
 * placement is acceptable" path the preset's own knownLimitations reserve
 * while spatial pointer/hover targeting stays deferred. Upgrade uses the
 * same cursor: SECONDARY_ACTION while parked on the tower's own cell.
 *
 * The route itself is hand-authored TypeScript, not a Tiled object: there is
 * no "Waypoint"/"Route" class in the nineteen-class catalog (ADR-0014), the
 * same conclusion the smoke-validated demo already reached.
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

const TOWER_FIRE_COOLDOWN_MS = 300;
const BASE_PROJECTILE_DAMAGE = 10;
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

function sameCell(a: Cell, b: Cell): boolean {
  return a.col === b.col && a.row === b.row;
}

function isPlacementCell(cell: Cell): boolean {
  return PLACEMENT_CELLS.some((p) => sameCell(p, cell));
}

export const GAME_SPECIFIC_PACK: ScenePackDefinition = {
  id: 'game.grid-shell',
  version: '0.1.0',
  provides: [],
  dependencies: [CAPABILITY_IDS.defense, CAPABILITY_IDS.territory, CAPABILITY_IDS.combat, CAPABILITY_IDS.autoCombat, CAPABILITY_IDS.farming, CAPABILITY_IDS.items, CAPABILITY_IDS.construction],

  install(context: SceneContext): InstalledSystemPack {
    const scene = context.scene;
    const defense = context.capabilities.require<DefenseService>(CAPABILITY_IDS.defense);
    const territory = context.capabilities.require<TerritoryService>(CAPABILITY_IDS.territory);
    const combat = context.capabilities.require<CombatService>(CAPABILITY_IDS.combat);
    const autoCombat = context.capabilities.require<AutoCombatService>(CAPABILITY_IDS.autoCombat);
    autoCombat.deploy('red-duelist', 'red-slot');
    autoCombat.deploy('blue-guard', 'blue-slot');
    autoCombat.start();
    const farming = context.capabilities.require<FarmingService>(CAPABILITY_IDS.farming);
    const items = context.capabilities.require<ItemsService>(CAPABILITY_IDS.items);
    items.grant('turnip-seed'); farming.till('proof-plot'); farming.plant('proof-plot', 'turnip'); farming.water('proof-plot');
    const construction = context.capabilities.require<ConstructionService>(CAPABILITY_IDS.construction);
    const constructionSite = construction.place('hut', { x: 32, y: 452 });
    if (constructionSite.ok && constructionSite.siteId) construction.assign(constructionSite.siteId, 'proof-worker');

    let cursor: Cell = { ...CURSOR_START };
    const cursorSprite = scene.add.sprite(...(Object.values(toPixel(cursor)) as [number, number]), context.assets.resolve('checkpoint'));

    for (const cell of PLACEMENT_CELLS) {
      const pos = toPixel(cell);
      scene.add.sprite(pos.x, pos.y, context.assets.resolve('platform')).setAlpha(0.3);
    }

    let towerPlaced = false;
    let towerUpgraded = false;
    let towerCell: Cell | null = null;
    let towerId: string | null = null;
    let towerPos: { x: number; y: number } | null = null;
    let towerSprite: Phaser.GameObjects.Sprite | null = null;
    let towerDamage = BASE_PROJECTILE_DAMAGE;
    let towerCooldownRemainingMs = 0;
    let placementRejections = 0;
    let upgradeRejections = 0;

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
    let territoryMode: 'empty' | 'red' | 'contested' = 'empty';

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
      const position = toPixel(cursor);
      // Preview and commit use the same Phase-21 placement rule. A change
      // between cursor hover and CONFIRM cannot buy an illegal tower.
      const placed = defense.place('needle-tower', position.x, position.y);
      if (!placed.ok || !placed.instanceId) {
        placementRejections += 1;
        return;
      }
      towerCell = { ...cursor };
      towerId = placed.instanceId;
      towerPos = position;
      towerSprite = scene.add.sprite(towerPos.x, towerPos.y, context.assets.resolve('platform'));
      towerSprite.setTint(0x4a90d9);
      towerPlaced = true;
    }

    function tryUpgradeTower(): void {
      if (!towerPlaced || !towerCell) {
        upgradeRejections += 1;
        return;
      }
      if (towerUpgraded || !sameCell(cursor, towerCell) || !towerId) {
        upgradeRejections += 1;
        return;
      }
      const upgraded = defense.upgrade(towerId);
      if (!upgraded.ok) {
        upgradeRejections += 1;
        return;
      }
      towerDamage = BASE_PROJECTILE_DAMAGE * (defense.tower(towerId)?.damageMultiplier ?? 1);
      towerUpgraded = true;
      towerSprite?.setTint(0xf0c274);
    }

    function moveEnemies(deltaMs: number): void {
      const step = (ENEMY_SPEED * deltaMs) / 1000;
      for (const enemy of enemies) {
        if (enemy.defeated || enemy.breached) continue;
        const target = ROUTE[enemy.routeIndex + 1];
        if (!target) {
          enemy.breached = true;
          breachedTotal += 1;
          lives = defense.breach('main')?.health ?? Math.max(0, lives - 1);
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

      // `sw2d.defense` owns policy and stable tie-breaking. The proof shell
      // receives a selected id, then only renders the projectile/collision.
      const selectedId = towerId ? defense.tower(towerId)?.targetId : null;
      const closest = selectedId ? enemies.find((enemy) => enemy.id === selectedId && !enemy.defeated && !enemy.breached) ?? null : null;
      if (!closest) return;

      const dx = closest.sprite.x - towerPos.x;
      const dy = closest.sprite.y - towerPos.y;
      const dist = Math.hypot(dx, dy) || 1;
      const projectile = pool.spawn(towerPos.x, towerPos.y, (dx / dist) * PROJECTILE_SPEED, (dy / dist) * PROJECTILE_SPEED);
      towerCooldownRemainingMs = TOWER_FIRE_COOLDOWN_MS;

      const target = closest;
      const damageAtFireTime = towerDamage;
      scene.physics.add.overlap(projectile, target.sprite, () => {
        if (target.defeated || !combat.has(target.id)) return;
        const health = combat.damage(target.id, damageAtFireTime, elapsedMs);
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
      currency: defense.funds(),
      towerPlaced,
      towerUpgraded,
      towerDamage,
      placementRejections,
      upgradeRejections,
      spawnedTotal,
      defeatedTotal,
      breachedTotal,
      lives,
      outcome,
      territory: {
        mode: territoryMode,
        owner: territory.zone('relay')?.owner ?? null,
        progress: territory.zone('relay')?.progress ?? 0,
        contested: territory.zone('relay')?.contested ?? false,
        redScore: territory.score('red'),
      },
      autoCombat: { phase: autoCombat.phase(), winner: autoCombat.winner(), units: autoCombat.units() },
      farming: { calendar: farming.calendar(), plot: farming.plots()[0], seeds: items.count('turnip-seed'), turnips: items.count('turnip') },
      construction: { resources: construction.resources(), sites: construction.sites() },
    }));

    let disposed = false;

    return {
      id: GAME_SPECIFIC_PACK.id,

      update(deltaMs: number): void {
        if (disposed) return;
        elapsedMs += deltaMs;
        // One proof day per second: the live service remains authoritative and
        // water is intentionally re-applied before each required growth day.
        if (Math.floor((elapsedMs - deltaMs) / 1000) !== Math.floor(elapsedMs / 1000)) { farming.water('proof-plot'); farming.advanceDays(1); if (farming.plots()[0]?.phase === 'harvestable') farming.harvest('proof-plot'); }

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
        if (context.input.consumePress('SECONDARY_ACTION')) tryUpgradeTower();
        // Backspace cycles the proof's two teams into the capture zone. It is
        // semantic CANCEL, not a raw-key special case; the scene owns no input
        // vocabulary of its own. This exposes enter → capture → contest.
        if (context.input.consumePress('CANCEL')) {
          territoryMode = territoryMode === 'empty' ? 'red' : territoryMode === 'red' ? 'contested' : 'empty';
        }

        moveEnemies(deltaMs);
        defense.setTargets(
          enemies
            .filter((enemy) => !enemy.defeated && !enemy.breached && combat.has(enemy.id))
            .map((enemy) => ({
              id: enemy.id,
              x: enemy.sprite.x,
              y: enemy.sprite.y,
              health: combat.get(enemy.id).current,
              maxHealth: combat.get(enemy.id).max,
              routeProgress: enemy.routeIndex,
            })),
        );
        territory.setOccupants(
          territoryMode === 'red'
            ? [{ id: 'red-scout', teamId: 'red', x: 880, y: 96 }]
            : territoryMode === 'contested'
              ? [{ id: 'red-scout', teamId: 'red', x: 880, y: 96 }, { id: 'blue-scout', teamId: 'blue', x: 880, y: 96 }]
              : [],
        );
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
