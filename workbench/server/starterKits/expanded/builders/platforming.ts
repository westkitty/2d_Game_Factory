import { defineExpandedKit } from './common.ts';

export type PlatformStarterVariant = 'traditional-platformer' | 'metroidvania';

function shellSource(variant: PlatformStarterVariant): string {
  return String.raw`import Phaser from 'phaser';
import type { InstalledSystemPack, NormalizedLevel } from '@sw2d/contracts';
import { platformController, type SceneContext, type ScenePackDefinition } from '@sw2d/runtime';
import { CAPABILITY_IDS, type ArcadeService, type WorldService } from '@sw2d/packs';
import { ActorPresentation, BobbingMarkers, addBackground } from './presentation.ts';

const VARIANT = ${JSON.stringify(variant)} as const;
const LEVEL_DOCUMENT = 'levels/main';
const TUNING_DOCUMENT = 'tuning';
const PLAYER_HEIGHT = 48;
const METROID_GATE_X = 180;

interface PlayerTuning {
  readonly moveSpeed: number;
  readonly jumpVelocity: number;
  readonly gravity: number;
}

function playerTuning(context: SceneContext): PlayerTuning {
  const value = context.content.data[TUNING_DOCUMENT]?.value as { player?: Partial<PlayerTuning> } | undefined;
  return {
    moveSpeed: value?.player?.moveSpeed ?? 220,
    jumpVelocity: value?.player?.jumpVelocity ?? 430,
    gravity: value?.player?.gravity ?? 1100,
  };
}

export const GAME_SPECIFIC_PACK: ScenePackDefinition = {
  id: 'game.expanded-platform-starter',
  version: '0.1.0',
  provides: [],
  dependencies: [CAPABILITY_IDS.world, CAPABILITY_IDS.arcade],

  install(context: SceneContext): InstalledSystemPack {
    const scene = context.scene;
    const level = context.content.data[LEVEL_DOCUMENT]?.value as NormalizedLevel;
    const tuning = playerTuning(context);
    const world = context.capabilities.require<WorldService>(CAPABILITY_IDS.world);
    const arcade = context.capabilities.require<ArcadeService>(CAPABILITY_IDS.arcade);
    const { width, height } = context.definition.viewport;

    const background = addBackground(scene, context.assets.has('background') ? context.assets.resolve('background') : null, width, height);
    const ground = scene.physics.add.staticGroup();
    for (const solid of level.solids) {
      const sprite = ground.create(solid.x + solid.width / 2, solid.y + solid.height / 2, context.assets.resolve('platform')) as Phaser.Physics.Arcade.Sprite;
      sprite.setDisplaySize(solid.width, solid.height);
      sprite.refreshBody();
    }

    const spawnObject = level.objects.find((object) => object.class === 'PlayerSpawn');
    const spawn = { x: spawnObject?.x ?? 120, y: spawnObject?.y ?? 430 };
    const player = scene.physics.add.sprite(spawn.x, spawn.y, context.assets.resolve('player'));
    player.setScale(PLAYER_HEIGHT / player.height);
    player.body.setSize(player.width * 0.62, player.height * 0.9);
    player.body.setAllowGravity(true);
    player.setGravityY(tuning.gravity);
    player.setCollideWorldBounds(true);
    scene.physics.add.collider(player, ground);

    const presentation = new ActorPresentation(player, { idleBob: false, lean: true, squash: true, shadow: true });
    const bobbing = new BobbingMarkers();
    const markerSprites: Phaser.GameObjects.Sprite[] = [];
    const checkpointPositions = new Map<string, { x: number; y: number }>();

    let collected = 0;
    let hazardHits = 0;
    let outcome: 'playing' | 'complete' = 'playing';
    let abilityUnlocked = false;
    let gateBlockedCount = 0;
    let jumpsUsed = 0;
    let doubleJumpUsed = false;

    function marker(object: { x: number; y: number; width: number; height: number }, role: 'pickup' | 'hazard' | 'checkpoint' | 'exit'): Phaser.GameObjects.Sprite {
      const sprite = scene.add.sprite(object.x + object.width / 2, object.y + object.height / 2, context.assets.resolve(role));
      if (object.width > 0 && object.height > 0) sprite.setDisplaySize(object.width, object.height);
      scene.physics.add.existing(sprite, true);
      markerSprites.push(sprite);
      return sprite;
    }

    function respawn(): void {
      const checkpointId = world.currentCheckpoint();
      const target = (checkpointId ? checkpointPositions.get(checkpointId) : undefined) ?? spawn;
      player.setVelocity(0, 0);
      player.setPosition(target.x, target.y);
      jumpsUsed = 0;
      presentation.flash();
    }

    for (const object of level.objects) {
      if (object.class === 'Checkpoint') {
        const checkpointId = String(object.properties.checkpointId ?? 'checkpoint-1');
        checkpointPositions.set(checkpointId, { x: object.x, y: object.y });
        const sprite = marker(object, 'checkpoint');
        scene.physics.add.overlap(player, sprite, () => world.activateCheckpoint(checkpointId));
      } else if (object.class === 'Collectible') {
        const itemId = String(object.properties.itemId ?? 'pickup-' + object.id);
        const sprite = marker(object, 'pickup');
        bobbing.add(sprite, (object.id % 5) / 5);
        scene.physics.add.overlap(player, sprite, () => {
          if (world.hasFlag('collected.' + itemId)) return;
          world.setFlag('collected.' + itemId, true);
          collected += 1;
          arcade.addScore(Number(object.properties.value ?? 5));
          if (itemId === 'ability-boost') abilityUnlocked = true;
          bobbing.remove(sprite);
          sprite.destroy();
        });
      } else if (object.class === 'Hazard') {
        const sprite = marker(object, 'hazard');
        scene.physics.add.overlap(player, sprite, () => {
          hazardHits += 1;
          respawn();
        });
      } else if (object.class === 'Exit') {
        const sprite = marker(object, 'exit');
        scene.physics.add.overlap(player, sprite, () => {
          if (VARIANT === 'metroidvania' && !abilityUnlocked) return;
          outcome = 'complete';
        });
      }
    }

    const gateSprite = VARIANT === 'metroidvania'
      ? scene.add.sprite(METROID_GATE_X - 8, 390, context.assets.resolve('platform')).setDisplaySize(18, 220).setAlpha(0.7)
      : null;

    const debugHandle = context.debug.contribute('game.expanded-starter', () => ({
      presetId: VARIANT,
      family: 'platforming',
      x: Math.round(player.x),
      y: Math.round(player.y),
      playerTextureKey: player.texture.key,
      backgroundTextureKey: background ? background.texture.key : null,
      collected,
      hazardHits,
      checkpoint: world.currentCheckpoint(),
      score: arcade.score(),
      abilityUnlocked,
      gateBlockedCount,
      jumpsUsed,
      doubleJumpUsed,
      outcome,
    }));

    let disposed = false;
    return {
      id: GAME_SPECIFIC_PACK.id,
      update(deltaMs: number): void {
        if (disposed || outcome === 'complete') return;
        const intent = platformController.read(context.input);
        player.setVelocityX(intent.moveAxis * tuning.moveSpeed);

        const onGround = player.body.blocked.down;
        if (onGround) jumpsUsed = 0;
        if (intent.jumpPressed) {
          const maxJumps = VARIANT === 'metroidvania' && abilityUnlocked ? 2 : 1;
          if (onGround || jumpsUsed < maxJumps) {
            if (!onGround && jumpsUsed > 0) doubleJumpUsed = true;
            player.setVelocityY(-tuning.jumpVelocity);
            jumpsUsed += 1;
            presentation.squash(-0.15);
          }
        }

        if (VARIANT === 'metroidvania' && !abilityUnlocked && player.x < METROID_GATE_X) {
          gateBlockedCount += 1;
          player.setPosition(METROID_GATE_X, player.y);
          if (player.body.velocity.x < 0) player.setVelocityX(0);
        }

        presentation.update(deltaMs, onGround);
        bobbing.update(deltaMs);
      },
      dispose(): void {
        if (disposed) return;
        disposed = true;
        debugHandle.dispose();
        presentation.dispose();
        bobbing.dispose();
        try {
          background?.destroy();
          gateSprite?.destroy();
          player.destroy();
          for (const sprite of markerSprites) if (sprite.active) sprite.destroy();
          ground.clear(true, true);
          ground.destroy(true);
        } catch {
          /* scene already tearing down */
        }
      },
    };
  },
};
`;
}

const ground = [
  { id: 1, class: 'Solid', name: 'Ground', x: 0, y: 500, width: 960, height: 40 },
  { id: 2, class: 'Solid', name: 'Ledge A', x: 240, y: 410, width: 130, height: 16 },
  { id: 3, class: 'Solid', name: 'Ledge B', x: 500, y: 335, width: 150, height: 16 },
  { id: 4, class: 'Solid', name: 'Ledge C', x: 720, y: 260, width: 140, height: 16 },
] as const;

function prop(name: string, type: string, value: string | number | boolean): { name: string; type: string; value: string | number | boolean } {
  return { name, type, value };
}

export function platformStarterKit(variant: PlatformStarterVariant) {
  if (variant === 'traditional-platformer') {
    return defineExpandedKit({
      presetId: variant,
      shellPackId: 'game.expanded-platform-starter',
      shellSource: shellSource(variant),
      extraPackIds: ['sw2d.world', 'sw2d.arcade'],
      level: {
        solids: ground,
        entities: [
          { id: 10, class: 'PlayerSpawn', name: 'Start', x: 70, y: 440, width: 0, height: 0, properties: [] },
          { id: 11, class: 'Checkpoint', name: 'Midpoint', x: 300, y: 450, width: 24, height: 32, properties: [prop('checkpointId', 'string', 'mid')] },
          { id: 12, class: 'Collectible', name: 'Coin A', x: 215, y: 450, width: 18, height: 18, properties: [prop('itemId', 'string', 'coin-a'), prop('value', 'int', 5)] },
          { id: 13, class: 'Collectible', name: 'Coin B', x: 690, y: 450, width: 18, height: 18, properties: [prop('itemId', 'string', 'coin-b'), prop('value', 'int', 5)] },
          // This is the first authored hazard in the beginner/reference kit.
          // Keep it visually unmistakable but give the player enough approach
          // distance and a compact hitbox so the default collision body clears
          // it with a normal moving jump rather than edge-perfect timing.
          { id: 14, class: 'Hazard', name: 'Spikes', x: 430, y: 488, width: 36, height: 12, properties: [prop('damage', 'int', 1)] },
          { id: 15, class: 'Exit', name: 'Finish', x: 900, y: 438, width: 26, height: 56, properties: [prop('exitId', 'string', 'finish')] },
        ],
      },
      // This is intentionally a forgiving first-platformer arc. It changes
      // only authored starter tuning; the shared platform controller and
      // physics ownership remain untouched.
      tuning: { moveSpeed: 225, jumpVelocity: 520, gravity: 1000 },
    });
  }

  return defineExpandedKit({
    presetId: variant,
    shellPackId: 'game.expanded-platform-starter',
    shellSource: shellSource(variant),
    extraPackIds: ['sw2d.world', 'sw2d.arcade'],
    level: {
      solids: ground,
      entities: [
        { id: 20, class: 'PlayerSpawn', name: 'Start', x: 300, y: 440, width: 0, height: 0, properties: [] },
        { id: 21, class: 'Checkpoint', name: 'Ability Camp', x: 610, y: 450, width: 24, height: 32, properties: [prop('checkpointId', 'string', 'ability-camp')] },
        { id: 22, class: 'Collectible', name: 'Traversal Ability', x: 735, y: 450, width: 22, height: 22, properties: [prop('itemId', 'string', 'ability-boost'), prop('value', 'int', 20)] },
        { id: 23, class: 'Hazard', name: 'Rift', x: 470, y: 180, width: 70, height: 18, properties: [prop('damage', 'int', 1)] },
        { id: 24, class: 'Exit', name: 'Backtracked Exit', x: 45, y: 438, width: 26, height: 56, properties: [prop('exitId', 'string', 'old-route')] },
      ],
    },
    tuning: { moveSpeed: 225, jumpVelocity: 430, gravity: 1120 },
  });
}