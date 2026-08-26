/**
 * Rich starter kit: chase-platformer.
 *
 * Derived from `proofs/chase-platformer` (which is committed, proof-validated
 * and left untouched) and adapted for a workbench-created project: it resolves
 * the `background` role when the project has one, drives presentation through
 * the shared `ActorPresentation`, and reads its whole world from the level
 * document so the Scene Composer can move things and have the game agree.
 *
 * Every path this kit writes is inside `content/`, `resources/` or
 * `src/game-specific/` - the surfaces `README.md` calls normal game work.
 * `assertOverlayContained` in @sw2d/cli/factory enforces that mechanically.
 */

import { PRESENTATION_MODULE } from './presentation.ts';

const SHELL_PACK = `import Phaser from 'phaser';
import type { InstalledSystemPack, NormalizedLevel, NormalizedLevelObject } from '@sw2d/contracts';
import { platformController, type SceneContext, type ScenePackDefinition } from '@sw2d/runtime';
import { CAPABILITY_IDS, type ArcadeService, type CombatService, type EntityRegistry, type WorldService } from '@sw2d/packs';
import { ActorPresentation, BobbingMarkers, addBackground } from './presentation.ts';

/**
 * The chase platformer's game-specific shell.
 *
 * Movement policy (coyote time, jump buffer, double jump) is deliberately
 * here rather than in the shared \`platformController\`: it is this game's
 * feel, not a reusable capability. Chase pressure is a millisecond counter
 * that freezes while the scene is paused (Phaser never updates a paused
 * scene) and during a spawn-grace window after every respawn.
 *
 * Art comes entirely from semantic roles. Swap what the workbench maps to
 * \`player\` and this file does not change - that is the whole point of the
 * role indirection.
 */

const LEVEL_DOCUMENT = 'levels/main';
const TUNING_DOCUMENT = 'tuning';

const COYOTE_MS = 120;
const JUMP_BUFFER_MS = 150;
const SPAWN_GRACE_MS = 500;
const HIT_INVULN_MS = 800;
const CAUGHT_THRESHOLD_MS = 45_000;
const PLAYER_MAX_HEALTH = 15;
/** Imported art is whatever size the artist made it; this is the on-screen height the player is drawn at. */
const PLAYER_DISPLAY_HEIGHT = 48;

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

    const viewport = context.definition.viewport;
    const background = addBackground(
      scene,
      context.assets.has('background') ? context.assets.resolve('background') : null,
      viewport.width,
      viewport.height,
    );

    const platformKey = context.assets.resolve('platform');
    const playerKey = context.assets.resolve('player');

    const ground = scene.physics.add.staticGroup();
    for (const solid of level.solids) {
      const body = ground.create(solid.x + solid.width / 2, solid.y + solid.height / 2, platformKey) as Phaser.Physics.Arcade.Sprite;
      body.setDisplaySize(solid.width, solid.height);
      body.refreshBody();
    }

    registry.register('PlayerSpawn', (object: NormalizedLevelObject) => ({ x: object.x, y: object.y }));
    const spawnObject = level.objects.find((object) => object.class === 'PlayerSpawn');
    const spawn = spawnObject
      ? (registry.dispatch(spawnObject, context) as { x: number; y: number })
      : { x: viewport.width * 0.1, y: viewport.height * 0.5 };

    const player = scene.physics.add.sprite(spawn.x, spawn.y, playerKey);
    // Normalise the drawn size so a 512px import and a 28px placeholder both
    // play the same. The physics body follows the display size, not the
    // texture, so movement tuning stays meaningful either way.
    const playerScale = PLAYER_DISPLAY_HEIGHT / player.height;
    player.setScale(playerScale);
    player.body.setSize(player.width * 0.6, player.height * 0.92);
    player.setCollideWorldBounds(true);
    player.body.setAllowGravity(true);
    player.setGravityY(tuning.gravity);
    scene.physics.add.collider(player, ground);
    combat.register('player', PLAYER_MAX_HEALTH);

    const presentation = new ActorPresentation(player, { idleBob: true, lean: true, squash: true, shadow: true });
    const bobbing = new BobbingMarkers();

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
      presentation.flash();
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
      bobbing.add(sprite, (object.id % 7) / 7);
      scene.physics.add.overlap(player, sprite, () => {
        if (world.hasFlag(\`collected.\${itemId}\`)) return;
        world.setFlag(\`collected.\${itemId}\`, true);
        collected += 1;
        arcade.addScore(value);
        presentation.squash(0.18);
        bobbing.remove(sprite);
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
        // Rejected because still invulnerable from an earlier hit: do not
        // re-extend the window, or standing on spikes would be permanent
        // invulnerability rather than repeated damage.
        if (after.current === before) return;
        presentation.flash();
        if (after.current <= 0) die('hazard');
        else combat.setInvulnerableFor('player', HIT_INVULN_MS, nowMs);
      });
    });

    registry.register('Enemy', (object: NormalizedLevelObject) => {
      const sprite = markerSprite(object.x, object.y, object.width || 26, object.height || 26, context.assets.resolve('enemy'));
      bobbing.add(sprite, (object.id % 5) / 5);
      scene.physics.add.overlap(player, sprite, () => {
        if (outcome !== 'playing') return;
        const before = combat.get('player').current;
        const after = combat.damage('player', 5, nowMs);
        if (after.current === before) return;
        presentation.flash();
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
        world.setFlag(\`level.cleared.\${exitId}\`, true);
      });
    });

    for (const object of level.objects) {
      if (object.class === 'PlayerSpawn') continue;
      registry.dispatch(object, context);
    }

    /**
     * Debug contribution. \`playerTextureKey\` is here on purpose: it is what
     * the workbench's browser QA reads to prove that the texture the game is
     * actually drawing is the one the imported asset produced, rather than a
     * placeholder that happens to look right.
     */
    const debugHandle = context.debug.contribute('game.platform-shell', () => ({
      x: Math.round(player.x),
      y: Math.round(player.y),
      vx: Math.round(player.body.velocity.x),
      vy: Math.round(player.body.velocity.y),
      onGround: player.body.blocked.down,
      playerTextureKey: player.texture.key,
      playerTextureWidth: player.texture.getSourceImage().width,
      backgroundTextureKey: background ? background.texture.key : null,
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

        const onGroundNow = player.body.blocked.down;
        if (onGroundNow) {
          coyoteRemainingMs = COYOTE_MS;
          jumpsUsed = 0;
          if (jumpBufferRemainingMs > 0) {
            player.setVelocityY(-tuning.jumpVelocity);
            context.audio.playCue('ui.confirm');
            presentation.squash(-0.18);
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
            presentation.squash(-0.18);
            lastJumpKind = onGroundNow ? 'ground' : 'coyote';
            jumpsUsed = 1;
            coyoteRemainingMs = 0;
          } else if (jumpsUsed < 2) {
            player.setVelocityY(-tuning.jumpVelocity);
            context.audio.playCue('ui.confirm');
            presentation.squash(-0.14);
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

        presentation.update(deltaMs, onGroundNow);
        bobbing.update(deltaMs);
      },

      dispose(): void {
        if (disposed) return;
        disposed = true;
        debugHandle.dispose();
        presentation.dispose();
        bobbing.dispose();
        combat.remove('player');
        try {
          background?.destroy();
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
`;

/**
 * A designed first level, not the universal three-object generator fixture.
 *
 * It is deliberately laid out to be *edited*: separated ledges, spaced
 * pickups, one hazard and one enemy, so the Scene Composer has real objects
 * to move and the difference is visible in the preview.
 */
function level(): Record<string, unknown> {
  return {
    type: 'map',
    orientation: 'orthogonal',
    infinite: false,
    width: 30,
    height: 17,
    tilewidth: 32,
    tileheight: 32,
    layers: [
      { type: 'tilelayer', name: 'Background', width: 30, height: 17 },
      {
        type: 'objectgroup',
        name: 'Solids',
        objects: [
          { id: 1, class: 'Solid', name: 'Ground', x: 0, y: 500, width: 960, height: 40 },
          { id: 10, class: 'Solid', name: 'Ledge Low', x: 200, y: 420, width: 120, height: 14 },
          { id: 11, class: 'Solid', name: 'Ledge Mid', x: 400, y: 340, width: 120, height: 14 },
          { id: 12, class: 'Solid', name: 'Ledge High', x: 620, y: 260, width: 140, height: 14 },
          { id: 13, class: 'Solid', name: 'Pillar', x: 540, y: 430, width: 26, height: 70 },
        ],
      },
      {
        type: 'objectgroup',
        name: 'Entities',
        objects: [
          { id: 2, class: 'PlayerSpawn', name: 'Start', x: 60, y: 440, width: 0, height: 0, properties: [{ name: 'facing', type: 'string', value: 'right' }] },
          { id: 3, class: 'Checkpoint', name: 'Checkpoint A', x: 420, y: 300, width: 24, height: 24, properties: [{ name: 'checkpointId', type: 'string', value: 'checkpoint-1' }] },
          { id: 4, class: 'Collectible', name: 'Coin 1', x: 236, y: 386, width: 18, height: 18, properties: [{ name: 'itemId', type: 'string', value: 'coin-1' }, { name: 'value', type: 'int', value: 5 }] },
          { id: 5, class: 'Collectible', name: 'Coin 2', x: 440, y: 306, width: 18, height: 18, properties: [{ name: 'itemId', type: 'string', value: 'coin-2' }, { name: 'value', type: 'int', value: 5 }] },
          { id: 6, class: 'Collectible', name: 'Coin 3', x: 668, y: 226, width: 18, height: 18, properties: [{ name: 'itemId', type: 'string', value: 'coin-3' }, { name: 'value', type: 'int', value: 10 }] },
          { id: 7, class: 'Hazard', name: 'Spikes', x: 330, y: 482, width: 70, height: 18, properties: [{ name: 'damage', type: 'int', value: 6 }] },
          { id: 8, class: 'Enemy', name: 'Patroller', x: 760, y: 466, width: 28, height: 28, properties: [{ name: 'enemyType', type: 'string', value: 'walker' }, { name: 'patrolRange', type: 'int', value: 120 }] },
          { id: 9, class: 'Exit', name: 'Level Exit', x: 890, y: 436, width: 26, height: 56, properties: [{ name: 'exitId', type: 'string', value: 'exit-1' }] },
        ],
      },
    ],
  };
}

function gameManifest(gameId: string, displayName: string): Record<string, unknown> {
  return {
    id: gameId,
    displayName,
    version: '0.1.0',
    schemaVersion: 1,
    viewport: { width: 960, height: 540 },
    bindings: {},
    // The kit uses combat and arcade in addition to the preset's required
    // world/world-entities, so they are enabled here. `validate`'s browser
    // smoke checks every declared pack actually installs, which is what keeps
    // this list honest.
    systemPacks: [
      { packId: 'sw2d.world', config: {} },
      { packId: 'sw2d.world-entities', config: {} },
      { packId: 'sw2d.combat', config: {} },
      { packId: 'sw2d.arcade', config: {} },
      { packId: 'game.platform-shell', config: {} },
    ],
    defaultSettings: { masterVolume: 0.7 },
  };
}

export function chasePlatformerOverlay(gameId: string, displayName: string): ReadonlyMap<string, string> {
  return new Map<string, string>([
    ['src/game-specific/shellPack.ts', SHELL_PACK],
    ['src/game-specific/presentation.ts', PRESENTATION_MODULE],
    ['content/game.json', JSON.stringify(gameManifest(gameId, displayName), null, 2) + '\n'],
    ['content/levels/main.json', JSON.stringify(level(), null, 2) + '\n'],
    ['content/tuning.json', JSON.stringify({ schemaVersion: 1, player: { moveSpeed: 230, jumpVelocity: 440, gravity: 1150 } }, null, 2) + '\n'],
  ]);
}
