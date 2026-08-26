import Phaser from 'phaser';
import type { InstalledSystemPack, NormalizedLevel, NormalizedLevelObject } from '@sw2d/contracts';
import { platformController, type SceneContext, type ScenePackDefinition } from '@sw2d/runtime';
import { CAPABILITY_IDS, type ArcadeService, type CombatService, type EntityRegistry, type WorldService } from '@sw2d/packs';

/**
 * Proof A - chase-platformer (Phase 10 deep proof, see ../PROOF_CONTRACT.md).
 *
 * Coyote time / jump buffer / double jump are bounded, game-specific movement
 * policy (Phase 9 lock) - deliberately not promoted into `platformController`
 * because no second proof consumer exists yet to trigger that promotion.
 * Chase pressure is a millisecond counter, frozen automatically while the
 * scene is paused (Phaser never calls a paused scene's `update()`, same
 * proof-by-absence the Phase 8 demo established) and explicitly frozen
 * during a spawn-grace window after every (re)spawn.
 */

const LEVEL_DOCUMENT = 'levels/main';
const TUNING_DOCUMENT = 'tuning';

const COYOTE_MS = 120;
const JUMP_BUFFER_MS = 150;
const SPAWN_GRACE_MS = 500;
const HIT_INVULN_MS = 800;
const CAUGHT_THRESHOLD_MS = 45_000;
const PLAYER_MAX_HEALTH = 15;

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

type DeathCause = 'hazard' | 'caught' | null;

export const GAME_SPECIFIC_PACK: ScenePackDefinition = {
  id: 'game.platform-shell',
  version: '0.1.0',
  provides: [],
  dependencies: [CAPABILITY_IDS.world, CAPABILITY_IDS.entities, CAPABILITY_IDS.combat, CAPABILITY_IDS.arcade],

  install(context: SceneContext): InstalledSystemPack {
    const scene = context.scene;
    const tuning = readPlayerTuning(context);
    const level = context.content.data[LEVEL_DOCUMENT]?.value as NormalizedLevel;
    const world = context.capabilities.require<WorldService>(CAPABILITY_IDS.world);
    const registry = context.capabilities.require<EntityRegistry<SceneContext>>(CAPABILITY_IDS.entities);
    const combat = context.capabilities.require<CombatService>(CAPABILITY_IDS.combat);
    const arcade = context.capabilities.require<ArcadeService>(CAPABILITY_IDS.arcade);

    const platformKey = context.assets.resolve('platform');
    const playerKey = context.assets.resolve('player');

    const ground = scene.physics.add.staticGroup();
    for (const solid of level.solids) {
      const body = ground.create(solid.x + solid.width / 2, solid.y + solid.height / 2, platformKey) as Phaser.Physics.Arcade.Sprite;
      body.setDisplaySize(solid.width, solid.height);
      body.refreshBody();
    }

    registry.register('PlayerSpawn', (object: NormalizedLevelObject) => ({ x: object.x, y: object.y }));
    const spawnObject = level.objects.find((object) => object.class === 'PlayerSpawn')!;
    const spawn = registry.dispatch(spawnObject, context) as { x: number; y: number };

    const player = scene.physics.add.sprite(spawn.x, spawn.y, playerKey);
    player.setCollideWorldBounds(true);
    player.body.setAllowGravity(true);
    player.setGravityY(tuning.gravity);
    scene.physics.add.collider(player, ground);
    combat.register('player', PLAYER_MAX_HEALTH);

    const quota = level.objects.filter((object) => object.class === 'Collectible').length;
    const checkpointPositions = new Map<string, { x: number; y: number }>();
    const markerSprites: Phaser.GameObjects.Sprite[] = [];

    let collected = 0;
    let deaths = 0;
    let lastDeathCause: DeathCause = null;
    let outcome: 'playing' | 'escaped' = 'playing';
    let nowMs = 0;
    let chasePressure = 0;
    let spawnGraceRemainingMs = SPAWN_GRACE_MS;
    let jumpsUsed = 0;
    let coyoteRemainingMs = 0;
    let jumpBufferRemainingMs = 0;
    let lastJumpKind: 'ground' | 'coyote' | 'double' | 'buffered' | null = null;

    function markerSprite(x: number, y: number, width: number, height: number, key: string): Phaser.GameObjects.Sprite {
      const sprite = scene.add.sprite(x + width / 2, y + height / 2, key);
      if (width > 0 && height > 0) sprite.setDisplaySize(width, height);
      scene.physics.add.existing(sprite, true);
      markerSprites.push(sprite);
      return sprite;
    }

    function respawnAt(x: number, y: number): void {
      player.setVelocity(0, 0);
      player.setPosition(x, y);
      combat.heal('player', combat.get('player').max);
      combat.setInvulnerableFor('player', HIT_INVULN_MS, nowMs);
      jumpsUsed = 0;
      coyoteRemainingMs = 0;
      jumpBufferRemainingMs = 0;
      spawnGraceRemainingMs = SPAWN_GRACE_MS;
      chasePressure = 0;
    }

    function die(cause: 'hazard' | 'caught'): void {
      if (outcome !== 'playing') return;
      deaths += 1;
      lastDeathCause = cause;
      const checkpointId = world.currentCheckpoint();
      const target = (checkpointId ? checkpointPositions.get(checkpointId) : undefined) ?? spawn;
      respawnAt(target.x, target.y);
    }

    registry.register('Checkpoint', (object: NormalizedLevelObject) => {
      const checkpointId = String(object.properties.checkpointId);
      checkpointPositions.set(checkpointId, { x: object.x, y: object.y });
      const sprite = markerSprite(object.x, object.y, object.width, object.height, context.assets.resolve('checkpoint'));
      scene.physics.add.overlap(player, sprite, () => {
        world.activateCheckpoint(checkpointId);
      });
    });

    registry.register('Collectible', (object: NormalizedLevelObject) => {
      const itemId = String(object.properties.itemId);
      const value = Number(object.properties.value ?? 0);
      const sprite = markerSprite(object.x, object.y, object.width, object.height, context.assets.resolve('pickup'));
      scene.physics.add.overlap(player, sprite, () => {
        if (world.hasFlag(`collected.${itemId}`)) return;
        world.setFlag(`collected.${itemId}`, true);
        collected += 1;
        arcade.addScore(value);
        const index = markerSprites.indexOf(sprite);
        if (index !== -1) markerSprites.splice(index, 1);
        sprite.destroy();
      });
    });

    registry.register('Hazard', (object: NormalizedLevelObject) => {
      const damage = Number(object.properties.damage ?? 10);
      const sprite = markerSprite(object.x, object.y, object.width, object.height, context.assets.resolve('hazard'));
      scene.physics.add.overlap(player, sprite, () => {
        if (outcome !== 'playing') return;
        const before = combat.get('player').current;
        const after = combat.damage('player', damage, nowMs);
        if (after.current === before) return; // rejected: still invulnerable from a previous hit - don't re-extend it
        if (after.current <= 0) die('hazard');
        else combat.setInvulnerableFor('player', HIT_INVULN_MS, nowMs);
      });
    });

    registry.register('Exit', (object: NormalizedLevelObject) => {
      const exitId = String(object.properties.exitId);
      const sprite = markerSprite(object.x, object.y, object.width, object.height, context.assets.resolve('exit'));
      scene.physics.add.overlap(player, sprite, () => {
        if (outcome !== 'playing') return;
        if (collected < quota) return;
        outcome = 'escaped';
        world.setFlag(`level.cleared.${exitId}`, true);
      });
    });

    for (const object of level.objects) {
      if (object.class === 'PlayerSpawn') continue;
      registry.dispatch(object, context);
    }

    const debugHandle = context.debug.contribute('game.platform-shell', () => ({
      x: Math.round(player.x),
      y: Math.round(player.y),
      vx: Math.round(player.body.velocity.x),
      vy: Math.round(player.body.velocity.y),
      onGround: player.body.blocked.down,
      jumpsUsed,
      lastJumpKind,
      jumpBufferPending: jumpBufferRemainingMs > 0,
      collected,
      quota,
      checkpoint: world.currentCheckpoint(),
      deaths,
      lastDeathCause,
      health: combat.get('player'),
      chasePressure,
      inSpawnGrace: spawnGraceRemainingMs > 0,
      outcome,
    }));

    let disposed = false;

    return {
      id: GAME_SPECIFIC_PACK.id,

      update(deltaMs: number): void {
        if (disposed) return;
        nowMs += deltaMs;

        const intent = platformController.read(context.input);
        player.setVelocityX(intent.moveAxis * tuning.moveSpeed);
        if (intent.moveAxis !== 0) player.setFlipX(intent.moveAxis < 0);

        const onGroundNow = player.body.blocked.down;
        if (onGroundNow) {
          coyoteRemainingMs = COYOTE_MS;
          jumpsUsed = 0;
          if (jumpBufferRemainingMs > 0) {
            player.setVelocityY(-tuning.jumpVelocity);
            context.audio.playCue('ui.confirm');
            jumpBufferRemainingMs = 0;
            jumpsUsed = 1;
            lastJumpKind = 'buffered';
          }
        } else {
          coyoteRemainingMs = Math.max(0, coyoteRemainingMs - deltaMs);
        }

        if (intent.jumpPressed) {
          if (onGroundNow || coyoteRemainingMs > 0) {
            player.setVelocityY(-tuning.jumpVelocity);
            context.audio.playCue('ui.confirm');
            lastJumpKind = onGroundNow ? 'ground' : 'coyote';
            jumpsUsed = 1;
            coyoteRemainingMs = 0;
          } else if (jumpsUsed < 2) {
            player.setVelocityY(-tuning.jumpVelocity);
            context.audio.playCue('ui.confirm');
            lastJumpKind = 'double';
            jumpsUsed += 1;
          } else {
            jumpBufferRemainingMs = JUMP_BUFFER_MS;
          }
        }
        jumpBufferRemainingMs = Math.max(0, jumpBufferRemainingMs - deltaMs);

        if (spawnGraceRemainingMs > 0) {
          spawnGraceRemainingMs = Math.max(0, spawnGraceRemainingMs - deltaMs);
        } else if (outcome === 'playing') {
          chasePressure += deltaMs;
          if (chasePressure >= CAUGHT_THRESHOLD_MS) die('caught');
        }
      },

      dispose(): void {
        if (disposed) return;
        disposed = true;
        debugHandle.dispose();
        combat.remove('player');
        try {
          player.destroy();
        } catch {
          /* scene already tearing down */
        }
        for (const sprite of markerSprites) {
          try {
            sprite.destroy();
          } catch {
            /* scene already tearing down */
          }
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
