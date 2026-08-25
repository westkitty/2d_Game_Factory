import Phaser from 'phaser';
import type { InstalledSystemPack, NormalizedLevel, NormalizedLevelObject } from '@sw2d/contracts';
import { platformController, type SceneContext, type ScenePackDefinition } from '@sw2d/runtime';
import { CAPABILITY_IDS, type EntityRegistry, type WorldService } from '@sw2d/packs';

/**
 * Tiled-driven level: the Phase 6 content-pipeline proof.
 *
 * Everything about *layout* - ground/platform geometry, the player's spawn
 * point, where the checkpoint/collectibles/hazard/exit sit - comes from
 * content/levels/intro.json through @sw2d/content-pipeline's normalizer and
 * the entity registry (`world.entities`), not from coordinates written in
 * this file. What stays here, matching the protected boundary exactly the
 * way placeholderMoverPack.ts does, is "how the body moves" (platform
 * controller intent -> Arcade Physics velocity) and the small amount of
 * real per-entity behaviour a proof level needs: a checkpoint activates
 * worldPack's existing checkpoint state, collectibles/hazards count
 * themselves, the exit sets a world flag. None of that is fake - it is the
 * deliberately small slice MASTER_PROJECT.md section 8 asks for, not a full
 * game (no damage system, no respawn-at-checkpoint - Phase 10's proof A).
 */

const LEVEL_DOCUMENT_NAME = 'levels/intro';

export interface TiledLevelConfig {
  readonly moveSpeed: number;
  readonly jumpVelocity: number;
  readonly gravity: number;
}

const DEFAULT_CONFIG: TiledLevelConfig = {
  moveSpeed: 220,
  jumpVelocity: -430,
  gravity: 1100,
};

function safely(step: () => void): void {
  try {
    step();
  } catch (error) {
    console.debug('[sw2d] starter.tiled-level: disposal step skipped (scene already tearing down)', error);
  }
}

function readLevel(context: SceneContext): NormalizedLevel {
  const envelope = context.content.data[LEVEL_DOCUMENT_NAME];
  if (!envelope || !envelope.valid) {
    throw new Error(`[sw2d] starter.tiled-level: content document "${LEVEL_DOCUMENT_NAME}" is missing or invalid`);
  }
  return envelope.value as NormalizedLevel;
}

export const TILED_LEVEL_PACK: ScenePackDefinition<Partial<TiledLevelConfig>> = {
  id: 'starter.tiled-level',
  version: '0.1.0',
  provides: [],
  dependencies: [CAPABILITY_IDS.world, CAPABILITY_IDS.entities],

  install(context: SceneContext, config): InstalledSystemPack {
    const settings: TiledLevelConfig = { ...DEFAULT_CONFIG, ...config };
    const scene = context.scene;
    const level = readLevel(context);
    const world = context.capabilities.require<WorldService>(CAPABILITY_IDS.world);
    const registry = context.capabilities.require<EntityRegistry<SceneContext>>(CAPABILITY_IDS.entities);

    // Solid/platform geometry, entirely from level.solids (Tiled "Solid" objects) -
    // no hard-coded platform coordinates.
    const platformKey = context.assets.resolve('platform');
    const ground = scene.physics.add.staticGroup();
    for (const solid of level.solids) {
      const body = ground.create(solid.x + solid.width / 2, solid.y + solid.height / 2, platformKey) as Phaser.Physics.Arcade.Sprite;
      body.setDisplaySize(solid.width, solid.height);
      body.refreshBody();
    }

    registry.register('PlayerSpawn', (object: NormalizedLevelObject) => ({
      x: object.x,
      y: object.y,
      facing: typeof object.properties.facing === 'string' ? object.properties.facing : 'right',
    }));

    const spawnObject = level.objects.find((object) => object.class === 'PlayerSpawn');
    if (!spawnObject) throw new Error('[sw2d] starter.tiled-level: level has no PlayerSpawn object');
    const spawn = registry.dispatch(spawnObject, context) as { x: number; y: number; facing: string };

    const playerKey = context.assets.resolve('player');
    const player = scene.physics.add.sprite(spawn.x, spawn.y, playerKey);
    player.setCollideWorldBounds(true);
    player.body.setAllowGravity(true);
    player.setGravityY(settings.gravity);
    player.setFlipX(spawn.facing === 'left');
    scene.physics.add.collider(player, ground);

    let collectiblesCollected = 0;
    const touchedHazards = new Set<number>();
    let checkpointActive: string | null = null;
    let cleared = false;
    const markerSprites: Phaser.GameObjects.Sprite[] = [];

    function markerSprite(x: number, y: number, width: number, height: number, key: string): Phaser.GameObjects.Sprite {
      const sprite = scene.add.sprite(x + width / 2, y + height / 2, key);
      if (width > 0 && height > 0) sprite.setDisplaySize(width, height);
      scene.physics.add.existing(sprite, true);
      markerSprites.push(sprite);
      return sprite;
    }

    registry.register('Checkpoint', (object: NormalizedLevelObject) => {
      const checkpointId = String(object.properties.checkpointId);
      const sprite = markerSprite(object.x, object.y, object.width, object.height, context.assets.resolve('checkpoint'));
      scene.physics.add.overlap(player, sprite, () => {
        if (checkpointActive === checkpointId) return;
        checkpointActive = checkpointId;
        world.activateCheckpoint(checkpointId);
      });
    });

    registry.register('Collectible', (object: NormalizedLevelObject) => {
      const sprite = markerSprite(object.x, object.y, object.width, object.height, context.assets.resolve('pickup'));
      scene.physics.add.overlap(player, sprite, () => {
        if (!sprite.active) return;
        collectiblesCollected += 1;
        sprite.destroy();
      });
    });

    registry.register('Hazard', (object: NormalizedLevelObject) => {
      const sprite = markerSprite(object.x, object.y, object.width, object.height, context.assets.resolve('hazard'));
      scene.physics.add.overlap(player, sprite, () => {
        touchedHazards.add(object.id);
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

    const debugHandle = context.debug.contribute('starter.tiled-level', () => ({
      player: {
        x: Math.round(player.x),
        y: Math.round(player.y),
        vx: Math.round(player.body.velocity.x),
        vy: Math.round(player.body.velocity.y),
        onGround: player.body.blocked.down,
      },
      collectiblesCollected,
      hazardsTouched: touchedHazards.size,
      checkpointActive,
      cleared,
    }));

    let disposed = false;

    return {
      id: TILED_LEVEL_PACK.id,

      update(): void {
        if (disposed) return;
        const intent = platformController.read(context.input);
        player.setVelocityX(intent.moveAxis * settings.moveSpeed);
        if (intent.moveAxis !== 0) player.setFlipX(intent.moveAxis < 0);
        if (intent.jumpPressed && player.body.blocked.down) {
          player.setVelocityY(settings.jumpVelocity);
          context.audio.playCue('ui.confirm');
        }
      },

      dispose(): void {
        if (disposed) return;
        disposed = true;
        debugHandle.dispose();
        // Same lesson as placeholderMoverPack.ts: a restart's batched
        // stop+start can already have torn down this scene's physics world
        // by the time this runs, so every physics-touching step is
        // independently guarded.
        safely(() => player.destroy());
        for (const sprite of markerSprites) safely(() => sprite.destroy());
        safely(() => {
          ground.clear(true, true);
          ground.destroy(true);
        });
      },
    };
  },
};
