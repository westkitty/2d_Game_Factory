import Phaser from 'phaser';
import type { InstalledSystemPack, NormalizedLevel, NormalizedLevelObject } from '@sw2d/contracts';
import { platformController, type SceneContext, type ScenePackDefinition } from '@sw2d/runtime';
import { CAPABILITY_IDS, type EntityRegistry, type WorldService } from '@sw2d/packs';

/**
 * Metroidvania demo (Phase 8 representative demo 3/12).
 *
 * Smoke contract: movement, one ability/unlock flag, a previously-blocked
 * path becomes traversable, objective after unlock. content/levels/main.json
 * places a full-height wall (top at y=260) between the player and the exit -
 * the default jump (rise ~84px from a y=478 ground) cannot clear it. The
 * "High Jump Boots" Powerup, once collected, raises jump velocity enough to
 * clear it (rise ~256px) - a real ability gate, not a cosmetic flag.
 */

const LEVEL_DOCUMENT = 'levels/main';
const DEFAULT_JUMP_VELOCITY = -430;
const HIGH_JUMP_VELOCITY = -750;

export const GAME_SPECIFIC_PACK: ScenePackDefinition = {
  id: 'game.platform-shell',
  version: '0.1.0',
  provides: [],
  dependencies: [CAPABILITY_IDS.world, CAPABILITY_IDS.entities],

  install(context: SceneContext): InstalledSystemPack {
    const scene = context.scene;
    const level = context.content.data[LEVEL_DOCUMENT]?.value as NormalizedLevel;
    const world = context.capabilities.require<WorldService>(CAPABILITY_IDS.world);
    const registry = context.capabilities.require<EntityRegistry<SceneContext>>(CAPABILITY_IDS.entities);

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
    player.setGravityY(1100);
    scene.physics.add.collider(player, ground);

    let highJumpUnlocked = false;
    let cleared = false;
    const markerSprites: Phaser.GameObjects.Sprite[] = [];

    function markerSprite(x: number, y: number, width: number, height: number, key: string): Phaser.GameObjects.Sprite {
      const sprite = scene.add.sprite(x + width / 2, y + height / 2, key);
      if (width > 0 && height > 0) sprite.setDisplaySize(width, height);
      scene.physics.add.existing(sprite, true);
      markerSprites.push(sprite);
      return sprite;
    }

    registry.register('Powerup', (object: NormalizedLevelObject) => {
      const sprite = markerSprite(object.x, object.y, object.width, object.height, context.assets.resolve('pickup'));
      scene.physics.add.overlap(player, sprite, () => {
        if (!sprite.active) return;
        highJumpUnlocked = true;
        sprite.destroy();
        world.setFlag(`ability.${String(object.properties.powerupType)}`, true);
      });
    });

    registry.register('Exit', (object: NormalizedLevelObject) => {
      const exitId = String(object.properties.exitId);
      const sprite = markerSprite(object.x, object.y, object.width, object.height, context.assets.resolve('exit'));
      scene.physics.add.overlap(player, sprite, () => {
        if (cleared) return;
        cleared = true;
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
      highJumpUnlocked,
      cleared,
    }));

    let disposed = false;

    return {
      id: GAME_SPECIFIC_PACK.id,

      update(): void {
        if (disposed) return;
        const intent = platformController.read(context.input);
        player.setVelocityX(intent.moveAxis * 220);
        if (intent.moveAxis !== 0) player.setFlipX(intent.moveAxis < 0);
        if (intent.jumpPressed && player.body.blocked.down) {
          player.setVelocityY(highJumpUnlocked ? HIGH_JUMP_VELOCITY : DEFAULT_JUMP_VELOCITY);
          context.audio.playCue('ui.confirm');
        }
      },

      dispose(): void {
        if (disposed) return;
        disposed = true;
        debugHandle.dispose();
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
