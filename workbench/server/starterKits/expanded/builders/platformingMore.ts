import { defineExpandedKit } from './common.ts';

export type AdditionalPlatformStarterVariant =
  | 'endless-runner'
  | 'precision-platformer'
  | 'puzzle-platformer'
  | 'auto-runner'
  | 'climbing-game'
  | 'grappling-platformer'
  | 'collectathon-platformer';

function prop(name: string, type: string, value: string | number | boolean): { name: string; type: string; value: string | number | boolean } {
  return { name, type, value };
}

function shellSource(variant: AdditionalPlatformStarterVariant): string {
  return String.raw`import Phaser from 'phaser';
import type { InstalledSystemPack, NormalizedLevel } from '@sw2d/contracts';
import { platformController, type SceneContext, type ScenePackDefinition } from '@sw2d/runtime';
import { ActorPresentation, BobbingMarkers, addBackground } from './presentation.ts';

const VARIANT = ${JSON.stringify(variant)} as const;
const LEVEL_DOCUMENT = 'levels/main';
const TUNING_DOCUMENT = 'tuning';
const PLAYER_HEIGHT = 46;
const COLLECTATHON_QUOTA = 3;
const GROUND_GRACE_MS = 120;

interface Tuning { moveSpeed: number; jumpVelocity: number; gravity: number; }

export const GAME_SPECIFIC_PACK: ScenePackDefinition = {
  id: 'game.expanded-platform-special',
  version: '0.1.0',
  provides: [],
  dependencies: [],

  install(context: SceneContext): InstalledSystemPack {
    const scene = context.scene;
    const { width, height } = context.definition.viewport;
    const level = context.content.data[LEVEL_DOCUMENT]?.value as NormalizedLevel;
    const tuningDoc = context.content.data[TUNING_DOCUMENT]?.value as { player?: Partial<Tuning> } | undefined;
    const tuning: Tuning = {
      moveSpeed: tuningDoc?.player?.moveSpeed ?? 220,
      jumpVelocity: tuningDoc?.player?.jumpVelocity ?? 430,
      gravity: tuningDoc?.player?.gravity ?? 1100,
    };
    const background = addBackground(scene, context.assets.has('background') ? context.assets.resolve('background') : null, width, height);
    const solids = scene.physics.add.staticGroup();
    for (const solid of level.solids) {
      const sprite = solids.create(solid.x + solid.width / 2, solid.y + solid.height / 2, context.assets.resolve('platform')) as Phaser.Physics.Arcade.Sprite;
      sprite.setDisplaySize(solid.width, solid.height); sprite.refreshBody();
    }
    const spawn = level.objects.find((object) => object.class === 'PlayerSpawn');
    const player = scene.physics.add.sprite(spawn?.x ?? 70, spawn?.y ?? 440, context.assets.resolve('player'));
    player.setScale(PLAYER_HEIGHT / player.height); player.body.setAllowGravity(true); player.setGravityY(tuning.gravity); player.setCollideWorldBounds(true);
    scene.physics.add.collider(player, solids);
    const presentation = new ActorPresentation(player, { idleBob: false, lean: true, squash: true, shadow: true });
    const bobbing = new BobbingMarkers();
    const decorations: Phaser.GameObjects.Sprite[] = [];

    let elapsedMs = 0;
    let distanceScore = 0;
    let score = 0;
    let collected = 0;
    let hazardHits = 0;
    let respawns = 0;
    let checkpoint = { x: spawn?.x ?? 70, y: spawn?.y ?? 440 };
    let puzzleSolved = false;
    let switchActivations = 0;
    let grappleUsed = false;
    let grappleTargetValid = false;
    let maxHeightReached = player.y;
    let outcome: 'playing' | 'complete' | 'failed' = 'playing';
    let finishBlockedCount = 0;
    let lastAction = 'spawn';
    let anchor: Phaser.GameObjects.Sprite | null = null;
    let switchSprite: Phaser.GameObjects.Sprite | null = null;
    let exitSprite: Phaser.GameObjects.Sprite | null = null;
    let groundGraceMs = GROUND_GRACE_MS;

    function staticMarker(object: { x: number; y: number; width: number; height: number }, role: 'pickup' | 'hazard' | 'checkpoint' | 'exit'): Phaser.GameObjects.Sprite {
      const sprite = scene.add.sprite(object.x + object.width / 2, object.y + object.height / 2, context.assets.resolve(role));
      if (object.width && object.height) sprite.setDisplaySize(object.width, object.height);
      scene.physics.add.existing(sprite, true); decorations.push(sprite); return sprite;
    }
    function respawn(): void {
      player.setVelocity(0, 0); player.setPosition(checkpoint.x, checkpoint.y); respawns += 1; groundGraceMs = GROUND_GRACE_MS; presentation.flash();
    }

    for (const object of level.objects) {
      if (object.class === 'Checkpoint') {
        const sprite = staticMarker(object, 'checkpoint');
        scene.physics.add.overlap(player, sprite, () => { if (outcome !== 'playing') return; checkpoint = { x: object.x, y: object.y }; lastAction = 'checkpoint'; });
      } else if (object.class === 'Collectible') {
        const itemId = String(object.properties.itemId ?? 'item-' + object.id);
        const sprite = staticMarker(object, 'pickup');
        bobbing.add(sprite, (object.id % 4) / 4);
        if (itemId === 'switch') switchSprite = sprite;
        else {
          scene.physics.add.overlap(player, sprite, () => {
            if (outcome !== 'playing' || !sprite.active) return;
            collected += 1; score += Number(object.properties.value ?? 5); lastAction = 'collect'; bobbing.remove(sprite); sprite.destroy();
          });
        }
      } else if (object.class === 'Hazard') {
        const sprite = staticMarker(object, 'hazard');
        scene.physics.add.overlap(player, sprite, () => {
          if (outcome !== 'playing') return;
          hazardHits += 1; lastAction = 'hazard';
          if (VARIANT === 'endless-runner' || VARIANT === 'auto-runner') {
            outcome = 'failed';
            player.setVelocity(0, 0);
          } else respawn();
        });
      } else if (object.class === 'Exit') {
        exitSprite = staticMarker(object, 'exit');
        scene.physics.add.overlap(player, exitSprite, () => {
          if (outcome !== 'playing') return;
          const allowed =
            VARIANT === 'puzzle-platformer' ? puzzleSolved :
            VARIANT === 'collectathon-platformer' ? collected >= COLLECTATHON_QUOTA :
            VARIANT === 'grappling-platformer' ? grappleUsed : true;
          if (allowed) { outcome = 'complete'; lastAction = 'finish'; player.setVelocity(0, 0); }
          else finishBlockedCount += 1;
        });
      } else if (object.class === 'Objective' && VARIANT === 'grappling-platformer') {
        anchor = scene.add.sprite(object.x, object.y, context.assets.resolve('checkpoint')).setDisplaySize(28, 28);
        decorations.push(anchor);
      }
    }

    const status = scene.add.text(16, 15, '', { fontFamily: 'ui-monospace, monospace', fontSize: '14px', color: '#ffffff', backgroundColor: '#111827aa', padding: { x: 7, y: 4 } }).setDepth(50);

    function updatePuzzle(): void {
      if (VARIANT !== 'puzzle-platformer' || !switchSprite?.active) return;
      const distance = Phaser.Math.Distance.Between(player.x, player.y, switchSprite.x, switchSprite.y);
      if (distance < 56 && context.input.justPressed('INTERACT')) {
        puzzleSolved = true; switchActivations += 1; lastAction = 'switch'; switchSprite.setTint(0x65d0a8);
      }
    }

    function updateGrapple(): void {
      if (VARIANT !== 'grappling-platformer' || !anchor) return;
      const dx = anchor.x - player.x; const dy = anchor.y - player.y; const distance = Math.hypot(dx, dy);
      grappleTargetValid = distance <= 300;
      if (grappleTargetValid && context.input.justPressed('SECONDARY_ACTION')) {
        const magnitude = distance || 1;
        player.setVelocity(dx / magnitude * 430, dy / magnitude * 430);
        grappleUsed = true; lastAction = 'grapple'; presentation.squash(-0.12);
      }
    }

    function render(): void {
      status.setText(
        VARIANT + ' | score ' + score + ' | items ' + collected + ' | hazards ' + hazardHits +
        (puzzleSolved ? ' | switch ✓' : '') + (grappleUsed ? ' | grapple ✓' : '') +
        (outcome !== 'playing' ? ' | ' + outcome.toUpperCase() : ''),
      );
    }

    const debugHandle = context.debug.contribute('game.expanded-starter', () => ({
      presetId: VARIANT, family: 'platforming', x: Math.round(player.x), y: Math.round(player.y),
      playerTextureKey: player.texture.key, backgroundTextureKey: background ? background.texture.key : null,
      elapsedMs: Math.round(elapsedMs), distanceScore: Math.floor(distanceScore), score, collected, hazardHits, respawns,
      puzzleSolved, switchActivations, grappleUsed, grappleTargetValid, maxHeightReached: Math.round(maxHeightReached),
      finishBlockedCount, outcome, lastAction,
    }));

    let disposed = false;
    return {
      id: GAME_SPECIFIC_PACK.id,
      update(deltaMs: number): void {
        if (disposed || outcome !== 'playing') return;
        elapsedMs += deltaMs;
        const intent = platformController.read(context.input);
        const automatic = VARIANT === 'endless-runner' || VARIANT === 'auto-runner';
        player.setVelocityX((automatic ? 1 : intent.moveAxis) * tuning.moveSpeed);
        const physicallyGrounded = player.body.blocked.down || player.body.touching.down;
        if (physicallyGrounded) groundGraceMs = GROUND_GRACE_MS;
        else groundGraceMs = Math.max(0, groundGraceMs - deltaMs);
        const grounded = physicallyGrounded || groundGraceMs > 0;
        if (intent.jumpPressed && grounded) {
          player.setVelocityY(-tuning.jumpVelocity);
          groundGraceMs = 0;
          presentation.squash(-0.14);
          lastAction = 'jump';
        }
        distanceScore = Math.max(distanceScore, player.x - (spawn?.x ?? 70));
        maxHeightReached = Math.min(maxHeightReached, player.y);
        updatePuzzle(); updateGrapple();
        if (VARIANT === 'endless-runner' && elapsedMs >= 9000 && outcome === 'playing') { outcome = 'complete'; lastAction = 'survived'; player.setVelocity(0, 0); }
        presentation.update(deltaMs, physicallyGrounded); bobbing.update(deltaMs); render();
      },
      dispose(): void {
        if (disposed) return; disposed = true; debugHandle.dispose(); presentation.dispose(); bobbing.dispose();
        try { background?.destroy(); player.destroy(); status.destroy(); for (const sprite of decorations) if (sprite.active) sprite.destroy(); solids.clear(true, true); solids.destroy(true); } catch { /* scene teardown */ }
      },
    };
  },
};
`;
}

const ground = [{ id: 1, class: 'Solid', name: 'Ground', x: 0, y: 500, width: 960, height: 40 }] as const;
const baseSpawn = { id: 2, class: 'PlayerSpawn', name: 'Start', x: 70, y: 440, width: 0, height: 0, properties: [] } as const;

export function additionalPlatformStarterKit(variant: AdditionalPlatformStarterVariant) {
  const common = { shellPackId: 'game.expanded-platform-special', shellSource: shellSource(variant) } as const;
  if (variant === 'endless-runner') return defineExpandedKit({ ...common, presetId: variant, level: { solids: ground, entities: [baseSpawn, { id: 3, class: 'Collectible', name: 'Score', x: 260, y: 450, width: 18, height: 18, properties: [prop('itemId', 'string', 'score'), prop('value', 'int', 10)] }, { id: 4, class: 'Hazard', name: 'Jump Me', x: 520, y: 482, width: 45, height: 18, properties: [prop('damage', 'int', 1)] }] }, tuning: { moveSpeed: 170, jumpVelocity: 420, gravity: 1120 } });
  if (variant === 'auto-runner') return defineExpandedKit({ ...common, presetId: variant, level: { solids: ground, entities: [baseSpawn, { id: 3, class: 'Hazard', name: 'Jump Me', x: 425, y: 488, width: 28, height: 12, properties: [prop('damage', 'int', 1)] }, { id: 4, class: 'Exit', name: 'Finish', x: 890, y: 438, width: 28, height: 56, properties: [prop('exitId', 'string', 'finish')] }] }, tuning: { moveSpeed: 185, jumpVelocity: 470, gravity: 1000 } });
  if (variant === 'precision-platformer') return defineExpandedKit({ ...common, presetId: variant, level: { solids: [{ id: 1, class: 'Solid', name: 'Start', x: 0, y: 500, width: 220, height: 40 }, { id: 2, class: 'Solid', name: 'Tiny A', x: 300, y: 430, width: 74, height: 14 }, { id: 3, class: 'Solid', name: 'Tiny B', x: 465, y: 355, width: 68, height: 14 }, { id: 4, class: 'Solid', name: 'Tiny C', x: 630, y: 290, width: 72, height: 14 }, { id: 5, class: 'Solid', name: 'Finish Floor', x: 790, y: 500, width: 170, height: 40 }], entities: [baseSpawn, { id: 10, class: 'Checkpoint', name: 'Precision CP', x: 640, y: 245, width: 22, height: 32, properties: [prop('checkpointId', 'string', 'precision-cp')] }, { id: 11, class: 'Hazard', name: 'Void', x: 220, y: 510, width: 570, height: 25, properties: [prop('damage', 'int', 1)] }, { id: 12, class: 'Exit', name: 'Finish', x: 900, y: 438, width: 28, height: 56, properties: [prop('exitId', 'string', 'finish')] }] }, tuning: { moveSpeed: 185, jumpVelocity: 390, gravity: 1420 } });
  if (variant === 'puzzle-platformer') return defineExpandedKit({ ...common, presetId: variant, level: { solids: ground, entities: [baseSpawn, { id: 3, class: 'Collectible', name: 'Switch', x: 520, y: 450, width: 26, height: 26, properties: [prop('itemId', 'string', 'switch')] }, { id: 4, class: 'Exit', name: 'Locked Exit', x: 890, y: 438, width: 28, height: 56, properties: [prop('exitId', 'string', 'locked-exit')] }] }, tuning: { moveSpeed: 220, jumpVelocity: 430, gravity: 1100 } });
  if (variant === 'climbing-game') return defineExpandedKit({ ...common, presetId: variant, level: { solids: [{ id: 1, class: 'Solid', name: 'Ground', x: 0, y: 500, width: 260, height: 40 }, { id: 2, class: 'Solid', name: 'L1', x: 250, y: 420, width: 160, height: 16 }, { id: 3, class: 'Solid', name: 'L2', x: 470, y: 335, width: 150, height: 16 }, { id: 4, class: 'Solid', name: 'L3', x: 650, y: 245, width: 150, height: 16 }, { id: 5, class: 'Solid', name: 'Summit', x: 800, y: 155, width: 150, height: 16 }], entities: [baseSpawn, { id: 10, class: 'Checkpoint', name: 'High CP', x: 680, y: 205, width: 22, height: 32, properties: [prop('checkpointId', 'string', 'high-cp')] }, { id: 11, class: 'Hazard', name: 'Fall', x: 240, y: 525, width: 560, height: 20, properties: [prop('damage', 'int', 1)] }, { id: 12, class: 'Exit', name: 'Summit', x: 875, y: 100, width: 28, height: 50, properties: [prop('exitId', 'string', 'summit')] }] }, tuning: { moveSpeed: 205, jumpVelocity: 430, gravity: 1060 } });
  if (variant === 'grappling-platformer') return defineExpandedKit({ ...common, presetId: variant, level: { solids: [{ id: 1, class: 'Solid', name: 'Left', x: 0, y: 500, width: 330, height: 40 }, { id: 2, class: 'Solid', name: 'Right', x: 690, y: 500, width: 270, height: 40 }], entities: [baseSpawn, { id: 10, class: 'Objective', name: 'Anchor', x: 510, y: 235, width: 0, height: 0, properties: [prop('objectiveId', 'string', 'grapple-anchor')] }, { id: 11, class: 'Hazard', name: 'Gap', x: 330, y: 510, width: 360, height: 25, properties: [prop('damage', 'int', 1)] }, { id: 12, class: 'Exit', name: 'Finish', x: 890, y: 438, width: 28, height: 56, properties: [prop('exitId', 'string', 'finish')] }] }, tuning: { moveSpeed: 205, jumpVelocity: 420, gravity: 850 } });
  return defineExpandedKit({ ...common, presetId: variant, level: { solids: ground, entities: [baseSpawn, { id: 3, class: 'Collectible', name: 'A', x: 220, y: 450, width: 18, height: 18, properties: [prop('itemId', 'string', 'a')] }, { id: 4, class: 'Collectible', name: 'B', x: 430, y: 450, width: 18, height: 18, properties: [prop('itemId', 'string', 'b')] }, { id: 5, class: 'Collectible', name: 'C', x: 650, y: 450, width: 18, height: 18, properties: [prop('itemId', 'string', 'c')] }, { id: 6, class: 'Exit', name: 'Quota Exit', x: 890, y: 438, width: 28, height: 56, properties: [prop('exitId', 'string', 'quota-exit')] }] }, tuning: { moveSpeed: 220, jumpVelocity: 430, gravity: 1100 } });
}
