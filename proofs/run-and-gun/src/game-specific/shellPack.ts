import Phaser from 'phaser';
import { WEAPONS_CAPABILITY_ID, type InstalledSystemPack, type NormalizedLevel, type WeaponsService } from '@sw2d/contracts';
import { bindCollectiblePickups, createProjectileRuntime, platformController, type SceneContext, type ScenePackDefinition } from '@sw2d/runtime';
import { CAPABILITY_IDS, type CombatService } from '@sw2d/packs';

/**
 * Generated starter shell: platform controller family.
 *
 * Copied verbatim by `sw2d new` for any preset whose primary controller
 * family is `platform` - this is the "bounded shared template per real
 * controller family" MASTER_PROJECT.md section 8 asks for, the same pattern
 * `starter/src/game-specific/placeholderMoverPack.ts` and `tiledLevelPack.ts`
 * already prove: the runtime is never edited, only this game-specific file
 * reads `platformController` intent and decides how the body moves.
 *
 * Edit this file freely - it lives in `src/game-specific/`, the part of a
 * generated game normal game work touches.
 */

const LEVEL_DOCUMENT = 'levels/main';
const TUNING_DOCUMENT = 'tuning';

/**
 * `content/tuning.json`, read for real.
 *
 * Phase 9 / Gate B found that every generated game validated this document and
 * then never read a single value from it - the numbers below were hard-coded
 * in the update loop instead, so editing `content/tuning.json` changed
 * nothing. That made the generated README's "content/tuning.json (tuning
 * values)" claim untrue. The fallbacks are the same numbers the generator
 * writes, so a game with a hand-trimmed tuning document still runs.
 */
interface PlayerTuning {
  readonly moveSpeed: number;
  readonly jumpVelocity: number;
  readonly gravity: number;
}

function readPlayerTuning(context: SceneContext): PlayerTuning {
  const tuning = context.content.data[TUNING_DOCUMENT]?.value as { player?: Partial<PlayerTuning> } | undefined;
  return {
    moveSpeed: tuning?.player?.moveSpeed ?? 220,
    jumpVelocity: tuning?.player?.jumpVelocity ?? 430,
    gravity: tuning?.player?.gravity ?? 1100,
  };
}

export const GAME_SPECIFIC_PACK: ScenePackDefinition = {
  id: 'game.platform-shell',
  version: '0.1.0',
  provides: [],
  dependencies: [],

  install(context: SceneContext): InstalledSystemPack {
    const scene = context.scene;
    const tuning = readPlayerTuning(context);
    const level = context.content.data[LEVEL_DOCUMENT]?.value as NormalizedLevel | undefined;
    const platformKey = context.assets.resolve('platform');
    const playerKey = context.assets.resolve('player');

    const ground = scene.physics.add.staticGroup();
    for (const solid of level?.solids ?? []) {
      const body = ground.create(solid.x + solid.width / 2, solid.y + solid.height / 2, platformKey) as Phaser.Physics.Arcade.Sprite;
      body.setDisplaySize(solid.width, solid.height);
      body.refreshBody();
    }

    const spawn = level?.objects.find((object) => object.class === 'PlayerSpawn');
    const { width, height } = context.definition.viewport;
    const spawnX = spawn?.x ?? width * 0.5;
    const spawnY = spawn?.y ?? height * 0.4;

    const player = scene.physics.add.sprite(spawnX, spawnY, playerKey);
    player.setCollideWorldBounds(true);
    player.body.setAllowGravity(true);
    player.setGravityY(tuning.gravity);
    scene.physics.add.collider(player, ground);

    // Data-driven item pickups (capability program Phase 2). Inert unless the
    // game installs sw2d.items; then every Collectible whose itemId names a
    // catalog entry grants that item and applies its effects through the
    // reusable service - no per-pickup code here.
    const pickups = bindCollectiblePickups(context, player, level);
    let nowMs = 0;
    let facing = 1;

    // Phase 3 proof: the reusable weapon model + shared projectile runtime,
    // resolving hits through combat.health. Enemies are stationary Solid-row
    // targets declared as Enemy level objects; death is a combat:entityDied
    // reaction, not projectile bookkeeping.
    const PLAYER_ID = 'player';
    const combat = context.capabilities.require<CombatService>(CAPABILITY_IDS.combat);
    const weapons = context.capabilities.require<WeaponsService>(WEAPONS_CAPABILITY_ID);
    combat.register(PLAYER_ID, 30);
    weapons.equip(PLAYER_ID, weapons.definitionIds()[0]!);

    const enemyAlive = new Map<string, boolean>();
    const spriteToEnemy = new Map<Phaser.GameObjects.GameObject, string>();
    const enemyGroup = scene.physics.add.group();
    for (const object of level?.objects ?? []) {
      if (object.class !== 'Enemy') continue;
      const enemyId = String(object.properties['enemyId'] ?? object.name ?? `enemy-${object.id}`);
      const enemySprite = scene.physics.add.sprite(object.x, object.y, context.assets.resolve('enemy'));
      enemySprite.setDisplaySize(object.width || 24, object.height || 24);
      (enemySprite.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);
      enemySprite.setImmovable(true);
      combat.register(enemyId, Number(object.properties['health'] ?? 20));
      enemyGroup.add(enemySprite);
      spriteToEnemy.set(enemySprite, enemyId);
      enemyAlive.set(enemyId, true);
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
        const id = spriteToEnemy.get(obj);
        return id && enemyAlive.get(id) ? { entityId: id, team: 'enemy' } : null;
      },
    });

    const onDeath = context.events.on('combat:entityDied', ({ entityId }) => {
      if (!enemyAlive.get(entityId)) return;
      enemyAlive.set(entityId, false);
      for (const [sprite, id] of spriteToEnemy) {
        if (id === entityId) {
          spriteToEnemy.delete(sprite);
          enemyGroup.remove(sprite as Phaser.GameObjects.GameObject, true, true);
          break;
        }
      }
    });

    const debugHandle = context.debug.contribute('game.platform-shell', () => ({
      x: Math.round(player.x),
      y: Math.round(player.y),
      vx: Math.round(player.body.velocity.x),
      vy: Math.round(player.body.velocity.y),
      onGround: player.body.blocked.down,
      items: pickups.inventory(),
      pickupsRemaining: pickups.remaining(),
      weaponId: weapons.ownerState(PLAYER_ID).weaponId,
      enemiesAlive: [...enemyAlive.values()].filter(Boolean).length,
      enemyHealth: Object.fromEntries([...enemyAlive.keys()].map((id) => [id, combat.has(id) ? combat.get(id).current : 0])),
      projectilesLive: projectiles.liveCount,
      projectilesSpawned: projectiles.spawnedTotal,
      projectilesExpired: projectiles.expiredTotal,
      hitsResolved: projectiles.hitsResolved,
      overlapFires: projectiles.overlapFires,
    }));

    let disposed = false;

    return {
      id: GAME_SPECIFIC_PACK.id,

      update(deltaMs: number): void {
        if (disposed) return;
        nowMs += deltaMs;
        const intent = platformController.read(context.input);
        player.setVelocityX(intent.moveAxis * tuning.moveSpeed);
        if (intent.moveAxis !== 0) {
          player.setFlipX(intent.moveAxis < 0);
          facing = intent.moveAxis < 0 ? -1 : 1;
        }
        projectiles.update(deltaMs, nowMs);
        if (intent.primaryPressed) {
          projectiles.fire({ ownerId: PLAYER_ID, originX: player.x, originY: player.y, dirX: facing, dirY: 0, nowMs });
        }
        if (intent.jumpPressed && player.body.blocked.down) {
          player.setVelocityY(-tuning.jumpVelocity);
          context.audio.playCue('ui.confirm');
        }
      },

      dispose(): void {
        if (disposed) return;
        disposed = true;
        debugHandle.dispose();
        pickups.dispose();
        onDeath.dispose();
        projectiles.dispose();
        combat.remove(PLAYER_ID);
        for (const id of enemyAlive.keys()) if (combat.has(id)) combat.remove(id);
        // A restart's batched stop+start can already have torn down this
        // scene's physics world by the time this runs - see
        // placeholderMoverPack.ts's own comment for the full story. Each
        // step is independently guarded for the same reason.
        try {
          player.destroy();
        } catch {
          /* scene already tearing down */
        }
        try {
          ground.clear(true, true);
          ground.destroy(true);
        } catch {
          /* scene already tearing down */
        }
      },
    };
  },
};
