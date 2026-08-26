/**
 * The four remaining rich starter kits: twin-stick-shooter, tower-defense,
 * sokoban and idle-incremental.
 *
 * Each is derived from its committed, proof-validated counterpart under
 * `proofs/` (which is read-only reference material and is not edited), and
 * adapted the same way `chasePlatformer.ts` is: art comes from semantic
 * roles, the `background` role is honoured when the project has one, and
 * every written path stays inside `content/`, `resources/` or
 * `src/game-specific/`.
 *
 * Kept in one module rather than four near-identical files: what differs
 * between them is the shell source and the manifest, and putting those side
 * by side makes the shared shape obvious.
 */

import { PRESENTATION_MODULE } from './presentation.ts';

function manifest(gameId: string, displayName: string, packs: readonly { packId: string; config: Record<string, unknown> }[]): string {
  return (
    JSON.stringify(
      {
        id: gameId,
        displayName,
        version: '0.1.0',
        schemaVersion: 1,
        viewport: { width: 960, height: 540 },
        bindings: {},
        systemPacks: packs,
        defaultSettings: { masterVolume: 0.7 },
      },
      null,
      2,
    ) + '\n'
  );
}

function tiledLevel(entities: readonly Record<string, unknown>[], solids: readonly Record<string, unknown>[] = []): string {
  return (
    JSON.stringify(
      {
        type: 'map',
        orientation: 'orthogonal',
        infinite: false,
        width: 30,
        height: 17,
        tilewidth: 32,
        tileheight: 32,
        layers: [
          { type: 'tilelayer', name: 'Background', width: 30, height: 17 },
          { type: 'objectgroup', name: 'Solids', objects: solids },
          { type: 'objectgroup', name: 'Entities', objects: entities },
        ],
      },
      null,
      2,
    ) + '\n'
  );
}

/**
 * `content/tuning.json`.
 *
 * The tuning schema requires every player field to be positive, so a kit that
 * does not consume one (a grid puzzle has no gravity) still writes the
 * generator's own default rather than a zero. Writing 0 to mean "unused" is
 * what the schema is there to catch, and it catches it at boot - the game
 * would not start at all.
 */
function tuning(player: Partial<{ moveSpeed: number; jumpVelocity: number; gravity: number }>): string {
  return (
    JSON.stringify(
      {
        schemaVersion: 1,
        player: {
          moveSpeed: player.moveSpeed ?? 220,
          jumpVelocity: player.jumpVelocity ?? 430,
          gravity: player.gravity ?? 1100,
        },
      },
      null,
      2,
    ) + '\n'
  );
}

// ---------------------------------------------------------------------------
// Twin-stick shooter
// ---------------------------------------------------------------------------

const TWIN_STICK_SHELL = `import Phaser from 'phaser';
import type { InstalledSystemPack, NormalizedLevel, NormalizedLevelObject } from '@sw2d/contracts';
import { ProjectilePool, topDownController, type SceneContext, type ScenePackDefinition } from '@sw2d/runtime';
import { CAPABILITY_IDS, type ArcadeService, type CombatService, type EntityRegistry } from '@sw2d/packs';
import { ActorPresentation, addBackground } from './presentation.ts';

/**
 * Twin-stick shooter shell.
 *
 * Enemies are stationary turret-archetype contact hazards, not a chase AI:
 * this preset declares no \`sw2d.ai\` pack and inventing one here would be a
 * speculative shared capability. Wave sequencing is bounded game-specific
 * policy. All art resolves through semantic roles, so swapping the imported
 * player image never touches this file.
 */

const LEVEL_DOCUMENT = 'levels/main';
const TUNING_DOCUMENT = 'tuning';
const PLAYER_ID = 'player';
const PLAYER_MAX_HEALTH = 30;
const PLAYER_CONTACT_DAMAGE = 10;
const PROJECTILE_DAMAGE = 10;
const PROJECTILE_SPEED = 420;
const HIT_INVULN_MS = 500;
const PLAYER_DISPLAY_HEIGHT = 42;

interface EnemyRecord {
  readonly id: string;
  readonly wave: number;
  readonly sprite: Phaser.Physics.Arcade.Sprite;
  alive: boolean;
}

export const GAME_SPECIFIC_PACK: ScenePackDefinition = {
  id: 'game.top-down-shell',
  version: '0.1.0',
  provides: [],
  dependencies: [CAPABILITY_IDS.combat, CAPABILITY_IDS.entities, CAPABILITY_IDS.arcade],

  install(context: SceneContext): InstalledSystemPack {
    const scene = context.scene;
    const tuningDoc = context.content.data[TUNING_DOCUMENT]?.value as { player?: { moveSpeed?: number } } | undefined;
    const moveSpeed = tuningDoc?.player?.moveSpeed ?? 220;
    const level = context.content.data[LEVEL_DOCUMENT]?.value as NormalizedLevel | undefined;
    const combat = context.capabilities.require<CombatService>(CAPABILITY_IDS.combat);
    const registry = context.capabilities.require<EntityRegistry<SceneContext>>(CAPABILITY_IDS.entities);
    const arcade = context.capabilities.require<ArcadeService>(CAPABILITY_IDS.arcade);
    const { width, height } = context.definition.viewport;

    const background = addBackground(scene, context.assets.has('background') ? context.assets.resolve('background') : null, width, height);

    const spawn = level?.objects.find((object) => object.class === 'PlayerSpawn');
    const player = scene.physics.add.sprite(spawn?.x ?? width * 0.3, spawn?.y ?? height * 0.5, context.assets.resolve('player'));
    player.setScale(PLAYER_DISPLAY_HEIGHT / player.height);
    player.setCollideWorldBounds(true);
    player.body.setAllowGravity(false);
    combat.register(PLAYER_ID, PLAYER_MAX_HEALTH);
    // No shadow and no idle bob in a top-down view: both read as a side-on
    // ground plane that does not exist here.
    const presentation = new ActorPresentation(player, { idleBob: false, lean: false, squash: true, shadow: false });

    const enemies = new Map<string, EnemyRecord>();
    const spriteToEnemyId = new Map<Phaser.Physics.Arcade.Sprite, string>();
    const enemyGroup = scene.physics.add.group();
    let wave: 1 | 2 = 1;
    let wave1Cleared = false;
    let wave2Cleared = false;

    registry.register('Enemy', (object: NormalizedLevelObject) => {
      const enemyId = String(object.properties.enemyId ?? \`enemy-\${object.id}\`);
      const enemyWave = Number(object.properties.wave ?? 1) as 1 | 2;
      const maxHealth = Number(object.properties.health ?? 20);
      const sprite = scene.physics.add.sprite(object.x, object.y, context.assets.resolve('enemy'));
      sprite.setDisplaySize(object.width || 26, object.height || 26);
      sprite.body.setAllowGravity(false);
      sprite.setImmovable(true);
      combat.register(enemyId, maxHealth);
      enemyGroup.add(sprite);
      spriteToEnemyId.set(sprite, enemyId);
      const record: EnemyRecord = { id: enemyId, wave: enemyWave, sprite, alive: true };
      enemies.set(enemyId, record);
      if (enemyWave !== 1) {
        sprite.setVisible(false);
        sprite.body.enable = false;
      }
      return record;
    });

    for (const object of level?.objects ?? []) {
      if (object.class === 'PlayerSpawn') continue;
      registry.dispatch(object, context);
    }

    const pool = new ProjectilePool({
      scene,
      textureKey: context.assets.resolve('pickup'),
      displaySize: 8,
      lifetimeMs: 1500,
      worldWidth: width,
      worldHeight: height,
    });

    let nowMs = 0;

    function activateWave(target: 1 | 2): void {
      for (const record of enemies.values()) {
        if (record.wave !== target) continue;
        record.sprite.setVisible(true);
        (record.sprite.body as Phaser.Physics.Arcade.Body).enable = true;
      }
    }

    function checkWaveCompletion(): void {
      if (wave === 1 && !wave1Cleared) {
        if ([...enemies.values()].filter((e) => e.wave === 1).every((e) => !e.alive)) {
          wave1Cleared = true;
          wave = 2;
          activateWave(2);
        }
      } else if (wave === 2 && !wave2Cleared) {
        if ([...enemies.values()].filter((e) => e.wave === 2).every((e) => !e.alive)) wave2Cleared = true;
      }
    }

    function killEnemy(record: EnemyRecord): void {
      record.alive = false;
      arcade.addScore(10);
      combat.remove(record.id);
      spriteToEnemyId.delete(record.sprite);
      enemyGroup.remove(record.sprite, true, true);
      checkWaveCompletion();
    }

    scene.physics.add.overlap(player, enemyGroup, (_playerObj, enemyObj) => {
      const sprite = enemyObj as Phaser.Physics.Arcade.Sprite;
      const enemyId = spriteToEnemyId.get(sprite);
      const record = enemyId ? enemies.get(enemyId) : undefined;
      if (!record || !record.alive) return;
      const before = combat.get(PLAYER_ID).current;
      const after = combat.damage(PLAYER_ID, PLAYER_CONTACT_DAMAGE, nowMs);
      if (after.current === before) return;
      presentation.flash();
      if (after.current > 0) combat.setInvulnerableFor(PLAYER_ID, HIT_INVULN_MS, nowMs);
    });

    const debugHandle = context.debug.contribute('game.top-down-shell', () => ({
      x: Math.round(player.x),
      y: Math.round(player.y),
      playerTextureKey: player.texture.key,
      playerTextureWidth: player.texture.getSourceImage().width,
      backgroundTextureKey: background ? background.texture.key : null,
      playerHealth: combat.get(PLAYER_ID),
      wave,
      wave1Cleared,
      wave2Cleared,
      score: arcade.score(),
      projectilesLive: pool.liveCount,
      projectilesSpawned: pool.spawnedTotal,
      enemies: Object.fromEntries(
        [...enemies.values()].map((record) => [record.id, { alive: record.alive, health: combat.has(record.id) ? combat.get(record.id).current : 0 }]),
      ),
    }));

    let disposed = false;

    return {
      id: GAME_SPECIFIC_PACK.id,

      update(deltaMs: number): void {
        if (disposed) return;
        nowMs += deltaMs;
        const intent = topDownController.read(context.input);
        player.setVelocity(intent.moveX * moveSpeed, intent.moveY * moveSpeed);

        if (intent.primaryPressed && intent.aimMagnitude > 0) {
          const projectile = pool.spawn(player.x, player.y, intent.aimX * PROJECTILE_SPEED, intent.aimY * PROJECTILE_SPEED);
          presentation.squash(0.12);
          scene.physics.add.overlap(projectile, enemyGroup, (_proj, enemyObj) => {
            const sprite = enemyObj as Phaser.Physics.Arcade.Sprite;
            const enemyId = spriteToEnemyId.get(sprite);
            const record = enemyId ? enemies.get(enemyId) : undefined;
            if (!record || !record.alive) return;
            pool.remove(projectile);
            const result = combat.damage(record.id, PROJECTILE_DAMAGE, nowMs);
            if (result.current <= 0) killEnemy(record);
          });
        }

        pool.update(deltaMs);
        presentation.update(deltaMs, true);
      },

      dispose(): void {
        if (disposed) return;
        disposed = true;
        debugHandle.dispose();
        presentation.dispose();
        pool.dispose();
        combat.remove(PLAYER_ID);
        for (const record of enemies.values()) {
          if (combat.has(record.id)) combat.remove(record.id);
          try {
            record.sprite.destroy();
          } catch {
            /* scene already tearing down */
          }
        }
        try {
          background?.destroy();
          player.destroy();
        } catch {
          /* scene already tearing down */
        }
      },
    };
  },
};
`;

function twinStickEnemy(id: number, name: string, x: number, y: number, wave: number, enemyId: string): Record<string, unknown> {
  return {
    id,
    class: 'Enemy',
    name,
    x,
    y,
    width: 30,
    height: 30,
    properties: [
      { name: 'enemyType', type: 'string', value: 'turret' },
      { name: 'wave', type: 'int', value: wave },
      { name: 'enemyId', type: 'string', value: enemyId },
      { name: 'health', type: 'int', value: 20 },
    ],
  };
}

export function twinStickOverlay(gameId: string, displayName: string): ReadonlyMap<string, string> {
  return new Map<string, string>([
    ['src/game-specific/shellPack.ts', TWIN_STICK_SHELL],
    ['src/game-specific/presentation.ts', PRESENTATION_MODULE],
    [
      'content/game.json',
      manifest(gameId, displayName, [
        { packId: 'sw2d.combat', config: {} },
        { packId: 'sw2d.world-entities', config: {} },
        { packId: 'sw2d.arcade', config: {} },
        { packId: 'game.top-down-shell', config: {} },
      ]),
    ],
    [
      'content/levels/main.json',
      tiledLevel([
        { id: 1, class: 'PlayerSpawn', name: 'Start', x: 120, y: 270, width: 0, height: 0, properties: [] },
        twinStickEnemy(2, 'Wave 1 - A', 400, 180, 1, 'enemy-1a'),
        twinStickEnemy(3, 'Wave 1 - B', 400, 360, 1, 'enemy-1b'),
        twinStickEnemy(4, 'Wave 2 - A', 680, 150, 2, 'enemy-2a'),
        twinStickEnemy(5, 'Wave 2 - B', 760, 270, 2, 'enemy-2b'),
        twinStickEnemy(6, 'Wave 2 - C', 680, 390, 2, 'enemy-2c'),
      ]),
    ],
    ['content/tuning.json', tuning({ moveSpeed: 235 })],
  ]);
}

// ---------------------------------------------------------------------------
// Tower defense
// ---------------------------------------------------------------------------

const TOWER_DEFENSE_SHELL = `import type Phaser from 'phaser';
import type { InstalledSystemPack } from '@sw2d/contracts';
import { gridController, ProjectilePool, type SceneContext, type ScenePackDefinition } from '@sw2d/runtime';
import { CAPABILITY_IDS, type CombatService, type ProgressionService } from '@sw2d/packs';
import { addBackground } from './presentation.ts';

/**
 * Tower-defense shell.
 *
 * Placement is a keyboard-driven grid cursor plus CONFIRM - the path this
 * preset's own knownLimitations reserve while spatial pointer targeting
 * stays deferred. The creep route is hand-authored here rather than read
 * from the level document because the nineteen-class Tiled catalog
 * (ADR-0014) has no waypoint class, and inventing one would be a content
 * pipeline change rather than normal game work.
 */

const CELL_SIZE = 64;
const ROUTE_ROW = 4;
const ROUTE: { x: number; y: number }[] = Array.from({ length: 13 }, (_unused, col) => ({
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
const UPGRADE_COST = 30;
const TOWER_RANGE = 150;
const TOWER_FIRE_COOLDOWN_MS = 300;
const BASE_PROJECTILE_DAMAGE = 10;
const UPGRADED_PROJECTILE_DAMAGE = 20;
const PROJECTILE_SPEED = 360;
const ENEMY_MAX_HEALTH = 20;
const ENEMY_SPEED = 120;
const ENEMY_SPAWN_TIMES_MS = [0, 1500, 3200];

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

export const GAME_SPECIFIC_PACK: ScenePackDefinition = {
  id: 'game.grid-shell',
  version: '0.1.0',
  provides: [],
  dependencies: [CAPABILITY_IDS.progression, CAPABILITY_IDS.combat],

  install(context: SceneContext): InstalledSystemPack {
    const scene = context.scene;
    const progression = context.capabilities.require<ProgressionService>(CAPABILITY_IDS.progression);
    const combat = context.capabilities.require<CombatService>(CAPABILITY_IDS.combat);
    const { width, height } = context.definition.viewport;

    const background = addBackground(scene, context.assets.has('background') ? context.assets.resolve('background') : null, width, height);

    let cursor: Cell = { ...CURSOR_START };
    const cursorStart = toPixel(cursor);
    const cursorSprite = scene.add.sprite(cursorStart.x, cursorStart.y, context.assets.resolve('checkpoint'));

    for (const cell of ROUTE) scene.add.sprite(cell.x, cell.y, context.assets.resolve('platform')).setAlpha(0.12).setDisplaySize(CELL_SIZE, 10);
    for (const cell of PLACEMENT_CELLS) {
      const pos = toPixel(cell);
      scene.add.sprite(pos.x, pos.y, context.assets.resolve('platform')).setAlpha(0.35).setDisplaySize(CELL_SIZE - 8, CELL_SIZE - 8);
    }

    let towerPlaced = false;
    let towerUpgraded = false;
    let towerCell: Cell | null = null;
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
      worldWidth: width,
      worldHeight: height,
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
      const id = \`enemy-\${nextEnemySeq++}\`;
      const start = ROUTE[0]!;
      const sprite = scene.physics.add.sprite(start.x, start.y, context.assets.resolve('enemy'));
      sprite.setDisplaySize(34, 34);
      sprite.body.setAllowGravity(false);
      combat.register(id, ENEMY_MAX_HEALTH);
      enemies.push({ id, sprite, routeIndex: 0, defeated: false, breached: false });
      spawnedTotal += 1;
    }

    function tryPlaceTower(): void {
      if (towerPlaced || !PLACEMENT_CELLS.some((p) => sameCell(p, cursor)) || progression.currency() < TOWER_COST) {
        placementRejections += 1;
        return;
      }
      progression.addCurrency(-TOWER_COST);
      towerCell = { ...cursor };
      towerPos = toPixel(cursor);
      // The tower uses the \`player\` role, not \`platform\`: it is the thing
      // the user places and owns, so an imported character belongs here. Build
      // pads and the route keep \`platform\`.
      towerSprite = scene.add.sprite(towerPos.x, towerPos.y, context.assets.resolve('player'));
      towerSprite.setScale((CELL_SIZE - 12) / towerSprite.height);
      towerPlaced = true;
    }

    function tryUpgradeTower(): void {
      if (!towerPlaced || !towerCell || towerUpgraded || !sameCell(cursor, towerCell) || progression.currency() < UPGRADE_COST) {
        upgradeRejections += 1;
        return;
      }
      progression.addCurrency(-UPGRADE_COST);
      towerDamage = UPGRADED_PROJECTILE_DAMAGE;
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
      currency: progression.currency(),
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
      cursorTextureKey: cursorSprite.texture.key,
      playerTextureKey: towerSprite ? towerSprite.texture.key : null,
      backgroundTextureKey: background ? background.texture.key : null,
    }));

    let disposed = false;

    return {
      id: GAME_SPECIFIC_PACK.id,

      update(deltaMs: number): void {
        if (disposed) return;
        elapsedMs += deltaMs;

        for (let i = 0; i < ENEMY_SPAWN_TIMES_MS.length; i++) {
          if (elapsedMs >= ENEMY_SPAWN_TIMES_MS[i]! && spawnedTotal === i) spawnEnemy();
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
          background?.destroy();
          cursorSprite.destroy();
          towerSprite?.destroy();
        } catch {
          /* scene already tearing down */
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
`;

export function towerDefenseOverlay(gameId: string, displayName: string): ReadonlyMap<string, string> {
  return new Map<string, string>([
    ['src/game-specific/shellPack.ts', TOWER_DEFENSE_SHELL],
    ['src/game-specific/presentation.ts', PRESENTATION_MODULE],
    [
      'content/game.json',
      manifest(gameId, displayName, [
        { packId: 'sw2d.world', config: {} },
        { packId: 'sw2d.world-entities', config: {} },
        { packId: 'sw2d.progression', config: { startingCurrency: 100 } },
        { packId: 'sw2d.combat', config: {} },
        { packId: 'game.grid-shell', config: {} },
      ]),
    ],
    [
      'content/levels/main.json',
      tiledLevel([
        { id: 1, class: 'PlayerSpawn', name: 'Command Post', x: 60, y: 440, width: 0, height: 0, properties: [] },
        {
          id: 2,
          class: 'Objective',
          name: 'Hold the line',
          x: 830,
          y: 250,
          width: 40,
          height: 40,
          properties: [{ name: 'objectiveId', type: 'string', value: 'hold-the-line' }],
        },
      ]),
    ],
    ['content/tuning.json', tuning({ moveSpeed: 220 })],
  ]);
}

// ---------------------------------------------------------------------------
// Sokoban
// ---------------------------------------------------------------------------

const SOKOBAN_PACK_CONFIG = `/**
 * Config for packs that declare \`configSource: 'code'\` - config that carries
 * functions, which content/game.json cannot express.
 *
 * This is the real puzzle state. The board is a small hand-authored constant
 * table closed over by both functions; \`sw2d.puzzle\` itself stays generic
 * over an opaque state type. Edit the board freely - this file is normal
 * game work.
 */

export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface SokobanState {
  readonly player: Point;
  readonly boxes: readonly Point[];
}

/** 7x6 board, \`(0,0)\` top-left. \`#\` = wall; everything else is walkable floor. */
const WALL_CELLS: readonly (readonly [number, number])[] = [
  [0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [5, 0], [6, 0],
  [0, 1], [6, 1],
  [0, 2], [3, 2], [6, 2],
  [0, 3], [6, 3],
  [0, 4], [6, 4],
  [0, 5], [1, 5], [2, 5], [3, 5], [4, 5], [5, 5], [6, 5],
];

const WALLS: ReadonlySet<string> = new Set(WALL_CELLS.map(([x, y]) => \`\${x},\${y}\`));

export const GOALS: readonly Point[] = [
  { x: 5, y: 1 },
  { x: 5, y: 4 },
];
export const PLAYER_START: Point = { x: 1, y: 2 };
export const BOX_STARTS: readonly Point[] = [
  { x: 2, y: 1 },
  { x: 2, y: 4 },
];

export function isWall(point: Point): boolean {
  return WALLS.has(\`\${point.x},\${point.y}\`);
}

export function pointsEqual(a: Point, b: Point): boolean {
  return a.x === b.x && a.y === b.y;
}

export function boardCells(): readonly Point[] {
  const cells: Point[] = [];
  for (let y = 0; y < 6; y++) for (let x = 0; x < 7; x++) cells.push({ x, y });
  return cells;
}

function createInitialState(): SokobanState {
  return { player: { ...PLAYER_START }, boxes: BOX_STARTS.map((box) => ({ ...box })) };
}

function isSolved(state: SokobanState): boolean {
  return GOALS.every((goal) => state.boxes.some((box) => pointsEqual(box, goal)));
}

export const PACK_CONFIG: Readonly<Record<string, unknown>> = {
  'sw2d.puzzle': { createInitialState, isSolved },
};
`;

const SOKOBAN_SHELL = `import type Phaser from 'phaser';
import type { InstalledSystemPack } from '@sw2d/contracts';
import { gridController, type SceneContext, type ScenePackDefinition } from '@sw2d/runtime';
import { CAPABILITY_IDS, type PuzzleService } from '@sw2d/packs';
import { GOALS, boardCells, isWall, pointsEqual, type Point, type SokobanState } from './packConfig.ts';
import { addBackground } from './presentation.ts';

/**
 * Sokoban shell.
 *
 * \`puzzle.current()\` from the real \`sw2d.puzzle\` pack is the ONLY board
 * state - this file keeps no parallel player/box variables and no undo stack
 * of its own, so undo and reset are the pack's, not a second implementation
 * that could disagree with it.
 */

const CELL_SIZE = 72;
const BOARD_ORIGIN_X = 240;
const BOARD_ORIGIN_Y = 90;

const DIRS: Readonly<Record<'up' | 'down' | 'left' | 'right', Point>> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

/** Standard rule: stepping into floor moves the player; stepping into a box pushes it one cell further if that cell is clear of walls and other boxes. Returns null for a rejected move so the caller never touches history for one. */
function attemptMove(state: SokobanState, delta: Point): SokobanState | null {
  const target: Point = { x: state.player.x + delta.x, y: state.player.y + delta.y };
  if (isWall(target)) return null;
  const boxIndex = state.boxes.findIndex((box) => pointsEqual(box, target));
  if (boxIndex === -1) return { player: target, boxes: state.boxes };
  const beyond: Point = { x: target.x + delta.x, y: target.y + delta.y };
  if (isWall(beyond)) return null;
  if (state.boxes.some((box) => pointsEqual(box, beyond))) return null;
  return { player: target, boxes: state.boxes.map((box, index) => (index === boxIndex ? beyond : box)) };
}

export const GAME_SPECIFIC_PACK: ScenePackDefinition = {
  id: 'game.grid-shell',
  version: '0.1.0',
  provides: [],
  dependencies: [CAPABILITY_IDS.puzzle],

  install(context: SceneContext): InstalledSystemPack {
    const scene = context.scene;
    const puzzle = context.capabilities.require<PuzzleService<SokobanState>>(CAPABILITY_IDS.puzzle);
    const { width, height } = context.definition.viewport;
    const background = addBackground(scene, context.assets.has('background') ? context.assets.resolve('background') : null, width, height);

    const floorKey = context.assets.resolve('platform');
    const goalKey = context.assets.resolve('checkpoint');
    const boxKey = context.assets.resolve('pickup');
    const playerKey = context.assets.resolve('player');

    const toPixel = (point: Point): [number, number] => [
      BOARD_ORIGIN_X + point.x * CELL_SIZE + CELL_SIZE / 2,
      BOARD_ORIGIN_Y + point.y * CELL_SIZE + CELL_SIZE / 2,
    ];

    const decorations: Phaser.GameObjects.Sprite[] = [];
    for (const cell of boardCells()) {
      if (isWall(cell)) continue;
      const sprite = scene.add.sprite(...toPixel(cell), floorKey).setAlpha(0.18).setDisplaySize(CELL_SIZE - 6, CELL_SIZE - 6);
      decorations.push(sprite);
    }
    for (const goal of GOALS) {
      decorations.push(scene.add.sprite(...toPixel(goal), goalKey).setAlpha(0.6).setDisplaySize(CELL_SIZE - 22, CELL_SIZE - 22));
    }

    const boxSprites = puzzle
      .current()
      .boxes.map((box) => scene.add.sprite(...toPixel(box), boxKey).setDisplaySize(CELL_SIZE - 16, CELL_SIZE - 16));

    const playerSprite = scene.add.sprite(...toPixel(puzzle.current().player), playerKey);
    playerSprite.setScale((CELL_SIZE - 18) / playerSprite.height);

    let rejectedMoves = 0;

    function syncSprites(): void {
      const state = puzzle.current();
      playerSprite.setPosition(...toPixel(state.player));
      state.boxes.forEach((box, index) => boxSprites[index]?.setPosition(...toPixel(box)));
      state.boxes.forEach((box, index) => {
        const onGoal = GOALS.some((goal) => pointsEqual(goal, box));
        boxSprites[index]?.setAlpha(onGoal ? 1 : 0.82);
      });
    }
    syncSprites();

    const debugHandle = context.debug.contribute('game.grid-shell', () => {
      const state = puzzle.current();
      return {
        state,
        solved: puzzle.isSolved(),
        rejectedMoves,
        playerTextureKey: playerSprite.texture.key,
        backgroundTextureKey: background ? background.texture.key : null,
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
          background?.destroy();
          playerSprite.destroy();
          for (const sprite of boxSprites) sprite.destroy();
          for (const sprite of decorations) sprite.destroy();
        } catch {
          /* scene already tearing down */
        }
      },
    };
  },
};
`;

export function sokobanOverlay(gameId: string, displayName: string): ReadonlyMap<string, string> {
  return new Map<string, string>([
    ['src/game-specific/shellPack.ts', SOKOBAN_SHELL],
    ['src/game-specific/packConfig.ts', SOKOBAN_PACK_CONFIG],
    ['src/game-specific/presentation.ts', PRESENTATION_MODULE],
    [
      'content/game.json',
      manifest(gameId, displayName, [
        { packId: 'sw2d.puzzle', config: {} },
        { packId: 'game.grid-shell', config: {} },
      ]),
    ],
    [
      'content/levels/main.json',
      tiledLevel([
        { id: 1, class: 'PlayerSpawn', name: 'Start', x: 300, y: 250, width: 0, height: 0, properties: [] },
      ]),
    ],
    ['content/tuning.json', tuning({})],
  ]);
}

// ---------------------------------------------------------------------------
// Idle incremental
// ---------------------------------------------------------------------------

const IDLE_SHELL = `import type { InstalledSystemPack, VersionedRecord } from '@sw2d/contracts';
import { accentStyle, mutedStyle, uiSimulationController, type SceneContext, type ScenePackDefinition } from '@sw2d/runtime';
import { CAPABILITY_IDS, type ProgressionService, type SimulationService } from '@sw2d/packs';
import { addBackground } from './presentation.ts';

/**
 * Idle-incremental shell.
 *
 * A text-first ui-simulation scene, matching the preset's single
 * \`ui-simulation\` controller family - there is no avatar to move. Imported
 * art still has a job: the \`background\` role becomes the scene backdrop and
 * the \`player\` role becomes the emblem beside the readout, so an asset-driven
 * project looks like itself rather than like every other idle game.
 *
 * Persistence uses \`context.saves\`, a real existing runtime capability, not
 * a bespoke storage layer.
 */

const SAVE_SLOT = 'idle-progress';
const SAVE_SCHEMA_VERSION = 1;
const PRODUCTION_RATE_PER_SEC = 2;
const JOB_ID = 'gather';
const JOB_DURATION_MS = 500;
const JOB_BONUS = 10;
const UPGRADE_COST = 20;
const UPGRADE_MULTIPLIER = 2;
const EMBLEM_HEIGHT = 96;

interface SaveData extends VersionedRecord {
  readonly gold: number;
  readonly currency: number;
  readonly rateMultiplier: number;
  readonly jobsCompleted: number;
}

function createDefault(): SaveData {
  return { schemaVersion: SAVE_SCHEMA_VERSION, gold: 0, currency: 0, rateMultiplier: 1, jobsCompleted: 0 };
}

export const GAME_SPECIFIC_PACK: ScenePackDefinition = {
  id: 'game.ui-simulation-shell',
  version: '0.1.0',
  provides: [],
  dependencies: [CAPABILITY_IDS.simulation, CAPABILITY_IDS.progression],

  install(context: SceneContext): InstalledSystemPack {
    const scene = context.scene;
    const { width, height } = context.definition.viewport;
    const simulation = context.capabilities.require<SimulationService>(CAPABILITY_IDS.simulation);
    const progression = context.capabilities.require<ProgressionService>(CAPABILITY_IDS.progression);

    const background = addBackground(scene, context.assets.has('background') ? context.assets.resolve('background') : null, width, height);

    const emblem = scene.add.sprite(width * 0.5, height * 0.26, context.assets.resolve('player'));
    emblem.setScale(EMBLEM_HEIGHT / emblem.height);

    const loadResult = context.saves.load<SaveData>(SAVE_SLOT, { currentVersion: SAVE_SCHEMA_VERSION, createDefault });
    const restored = loadResult.value;
    if (restored.gold > 0) simulation.addResource('gold', restored.gold);
    if (restored.currency > 0) progression.addCurrency(restored.currency);
    let rateMultiplier = restored.rateMultiplier;
    let jobsCompleted = restored.jobsCompleted;
    let lastSaveOutcome = loadResult.outcome;

    const label = scene.add.text(width * 0.5, height * 0.52, '', mutedStyle(20)).setOrigin(0.5).setScrollFactor(0);
    const hint = scene.add
      .text(width * 0.5, height * 0.68, 'PRIMARY: gather | SECONDARY: upgrade | CONFIRM: save', accentStyle(14))
      .setOrigin(0.5)
      .setScrollFactor(0);

    function render(): void {
      label.setText(\`Gold: \${simulation.resource('gold').toFixed(1)}  |  Currency: \${progression.currency()}  |  Rate x\${rateMultiplier}\`);
    }
    render();

    let jobActive = false;
    let elapsedMs = 0;

    function tryQueueJob(): void {
      if (jobActive) return;
      simulation.queueJob(JOB_ID, JOB_DURATION_MS);
      jobActive = true;
    }

    function tryBuyUpgrade(): void {
      // One upgrade tier. A deeper tree is exactly the large economy
      // balancing this preset's knownLimitations defer.
      if (rateMultiplier > 1 || progression.currency() < UPGRADE_COST) return;
      progression.addCurrency(-UPGRADE_COST);
      rateMultiplier = UPGRADE_MULTIPLIER;
    }

    function saveProgress(): void {
      context.saves.save<SaveData>(SAVE_SLOT, {
        schemaVersion: SAVE_SCHEMA_VERSION,
        gold: simulation.resource('gold'),
        currency: progression.currency(),
        rateMultiplier,
        jobsCompleted,
      });
      lastSaveOutcome = 'loaded';
    }

    const debugHandle = context.debug.contribute('game.ui-simulation-shell', () => ({
      gold: simulation.resource('gold'),
      currency: progression.currency(),
      rateMultiplier,
      jobsCompleted,
      jobPending: jobActive,
      loadOutcome: loadResult.outcome,
      lastSaveOutcome,
      playerTextureKey: emblem.texture.key,
      playerTextureWidth: emblem.texture.getSourceImage().width,
      backgroundTextureKey: background ? background.texture.key : null,
    }));

    let disposed = false;

    return {
      id: GAME_SPECIFIC_PACK.id,

      update(deltaMs: number): void {
        if (disposed) return;
        elapsedMs += deltaMs;

        // Deterministic passive production: a pure function of elapsed
        // simulated time and the current multiplier. No RNG.
        simulation.addResource('gold', (PRODUCTION_RATE_PER_SEC * rateMultiplier * deltaMs) / 1000);

        if (jobActive && simulation.isJobComplete(JOB_ID)) {
          simulation.cancelJob(JOB_ID);
          simulation.addResource('gold', JOB_BONUS);
          progression.addCurrency(JOB_BONUS);
          jobsCompleted += 1;
          jobActive = false;
        }

        const intent = uiSimulationController.read(context.input);
        if (context.input.justPressed('PRIMARY_ACTION')) tryQueueJob();
        if (context.input.justPressed('SECONDARY_ACTION')) tryBuyUpgrade();
        if (intent.confirmPressed) saveProgress();

        emblem.setY(height * 0.26 + Math.sin(elapsedMs / 900) * 4);
        render();
      },

      dispose(): void {
        if (disposed) return;
        disposed = true;
        debugHandle.dispose();
        try {
          background?.destroy();
          emblem.destroy();
          label.destroy();
          hint.destroy();
        } catch {
          /* scene already tearing down */
        }
      },
    };
  },
};
`;

export function idleIncrementalOverlay(gameId: string, displayName: string): ReadonlyMap<string, string> {
  return new Map<string, string>([
    ['src/game-specific/shellPack.ts', IDLE_SHELL],
    ['src/game-specific/presentation.ts', PRESENTATION_MODULE],
    [
      'content/game.json',
      manifest(gameId, displayName, [
        { packId: 'sw2d.simulation', config: {} },
        { packId: 'sw2d.progression', config: {} },
        { packId: 'game.ui-simulation-shell', config: {} },
      ]),
    ],
    [
      'content/levels/main.json',
      tiledLevel([{ id: 1, class: 'PlayerSpawn', name: 'Start', x: 480, y: 270, width: 0, height: 0, properties: [] }]),
    ],
    ['content/tuning.json', tuning({})],
  ]);
}
