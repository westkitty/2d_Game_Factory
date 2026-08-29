import Phaser from 'phaser';
import {
  aimFromPointer,
  WEAPONS_CAPABILITY_ID,
  type InstalledSystemPack,
  type NormalizedLevel,
  type NormalizedLevelObject,
  type WeaponsService,
} from '@sw2d/contracts';
import { createProjectileRuntime, topDownController, type SceneContext, type ScenePackDefinition } from '@sw2d/runtime';
import { CAPABILITY_IDS, type ArcadeService, type CombatService, type EntityRegistry } from '@sw2d/packs';

/**
 * Proof - twin-stick-shooter. Phase 3 upgrade: the raw ProjectilePool +
 * hand-wired overlap are replaced by the reusable `sw2d.weapons` model
 * (`content/weapons.json` -> `WeaponsService`) and the shared
 * `createProjectileRuntime` bridge, which resolves hits through
 * `combat.health`. Movement stays independent from aim; digital AIM_* stays
 * authoritative with the spatial pointer as an optional fallback (ADR-0018).
 * Enemy death is an ordinary `combat:entityDied` reaction, not projectile
 * bookkeeping.
 */

const LEVEL_DOCUMENT = 'levels/main';
const TUNING_DOCUMENT = 'tuning';
const PLAYER_ID = 'player';
const PLAYER_MAX_HEALTH = 30;
const PLAYER_CONTACT_DAMAGE = 10;
const HIT_INVULN_MS = 500;

interface PlayerTuning {
  readonly moveSpeed: number;
}

function readPlayerTuning(context: SceneContext): PlayerTuning {
  const tuning = context.content.data[TUNING_DOCUMENT]?.value as { player?: Partial<{ moveSpeed: number }> } | undefined;
  return { moveSpeed: tuning?.player?.moveSpeed ?? 220 };
}

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
  dependencies: [CAPABILITY_IDS.combat, CAPABILITY_IDS.entities, CAPABILITY_IDS.arcade, CAPABILITY_IDS.weapons],

  install(context: SceneContext): InstalledSystemPack {
    const scene = context.scene;
    const tuning = readPlayerTuning(context);
    const level = context.content.data[LEVEL_DOCUMENT]?.value as NormalizedLevel | undefined;
    const combat = context.capabilities.require<CombatService>(CAPABILITY_IDS.combat);
    const registry = context.capabilities.require<EntityRegistry<SceneContext>>(CAPABILITY_IDS.entities);
    const arcade = context.capabilities.require<ArcadeService>(CAPABILITY_IDS.arcade);
    const weapons = context.capabilities.require<WeaponsService>(WEAPONS_CAPABILITY_ID);
    const { width, height } = context.definition.viewport;

    const spawn = level?.objects.find((object) => object.class === 'PlayerSpawn');
    const player = scene.physics.add.sprite(spawn?.x ?? width * 0.3, spawn?.y ?? height * 0.5, context.assets.resolve('player'));
    player.setCollideWorldBounds(true);
    player.body.setAllowGravity(false);
    combat.register(PLAYER_ID, PLAYER_MAX_HEALTH);
    weapons.equip(PLAYER_ID, weapons.definitionIds()[0]!);

    const enemies = new Map<string, EnemyRecord>();
    const spriteToEnemyId = new Map<Phaser.GameObjects.GameObject, string>();
    const enemyGroup = scene.physics.add.group();
    let wave: 1 | 2 = 1;
    let wave1Cleared = false;
    let wave2Cleared = false;

    registry.register('Enemy', (object: NormalizedLevelObject) => {
      const enemyId = String(object.properties.enemyId);
      const enemyWave = Number(object.properties.wave) as 1 | 2;
      const maxHealth = Number(object.properties.health ?? 20);
      const sprite = scene.physics.add.sprite(object.x, object.y, context.assets.resolve('enemy'));
      sprite.setDisplaySize(object.width, object.height);
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

    const projectiles = createProjectileRuntime({
      scene,
      weapons,
      combat,
      worldWidth: width,
      worldHeight: height,
      resolveTexture: () => context.assets.resolve('pickup'),
      targetGroups: [enemyGroup],
      resolveTarget: (obj) => {
        const id = spriteToEnemyId.get(obj);
        return id && enemies.get(id)?.alive ? { entityId: id, team: 'enemy' } : null;
      },
    });

    let nowMs = 0;
    let pointerAimActive = false;
    let lastAimX = 0;
    let lastAimY = 0;

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

    const onDeath = context.events.on('combat:entityDied', ({ entityId }) => {
      const record = enemies.get(entityId);
      if (!record || !record.alive) return;
      record.alive = false;
      arcade.addScore(10);
      combat.remove(record.id);
      spriteToEnemyId.delete(record.sprite);
      enemyGroup.remove(record.sprite, true, true);
      checkWaveCompletion();
    });

    scene.physics.add.overlap(player, enemyGroup, (_playerObj, enemyObj) => {
      const enemyId = spriteToEnemyId.get(enemyObj as Phaser.GameObjects.GameObject);
      const record = enemyId ? enemies.get(enemyId) : undefined;
      if (!record || !record.alive) return;
      const before = combat.get(PLAYER_ID).current;
      const after = combat.damage(PLAYER_ID, PLAYER_CONTACT_DAMAGE, nowMs);
      if (after.current === before) return;
      if (after.current > 0) combat.setInvulnerableFor(PLAYER_ID, HIT_INVULN_MS, nowMs);
    });

    const debugHandle = context.debug.contribute('game.top-down-shell', () => ({
      x: Math.round(player.x),
      y: Math.round(player.y),
      playerHealth: combat.get(PLAYER_ID),
      wave,
      wave1Cleared,
      wave2Cleared,
      score: arcade.score(),
      projectilesLive: projectiles.liveCount,
      projectilesSpawned: projectiles.spawnedTotal,
      projectilesExpired: projectiles.expiredTotal,
      weaponId: weapons.ownerState(PLAYER_ID).weaponId,
      pointerAimActive,
      lastAimX,
      lastAimY,
      enemies: Object.fromEntries(
        [...enemies.values()].map((record) => [
          record.id,
          { alive: record.alive, health: combat.has(record.id) ? combat.get(record.id).current : 0 },
        ]),
      ),
    }));

    let disposed = false;

    return {
      id: GAME_SPECIFIC_PACK.id,

      update(deltaMs: number): void {
        if (disposed) return;
        nowMs += deltaMs;
        const intent = topDownController.read(context.input);
        player.setVelocity(intent.moveX * tuning.moveSpeed, intent.moveY * tuning.moveSpeed);

        let aimX = intent.aimX;
        let aimY = intent.aimY;
        let aimMagnitude = intent.aimMagnitude;
        pointerAimActive = false;
        if (aimMagnitude === 0 && context.spatialPointer.state.active) {
          const [px, py] = context.spatialPointer.worldPoint();
          const derived = aimFromPointer(player.x, player.y, px, py);
          aimX = derived.aimX;
          aimY = derived.aimY;
          aimMagnitude = derived.aimMagnitude;
          pointerAimActive = derived.aimMagnitude > 0;
        }
        if (aimMagnitude > 0) {
          lastAimX = Math.round(aimX * 100) / 100;
          lastAimY = Math.round(aimY * 100) / 100;
        }

        if (intent.primaryPressed && aimMagnitude > 0) {
          projectiles.fire({ ownerId: PLAYER_ID, originX: player.x, originY: player.y, dirX: aimX, dirY: aimY, nowMs });
        }
        projectiles.update(deltaMs, nowMs);
      },

      dispose(): void {
        if (disposed) return;
        disposed = true;
        debugHandle.dispose();
        onDeath.dispose();
        projectiles.dispose();
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
          player.destroy();
        } catch {
          /* scene already tearing down */
        }
      },
    };
  },
};
