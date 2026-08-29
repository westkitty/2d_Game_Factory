import Phaser from 'phaser';
import type { InstalledSystemPack } from '@sw2d/contracts';
import { bindCollectiblePickups, bindStarterWeapon, resolveSceneLevel, topDownController, type SceneContext, type ScenePackDefinition } from '@sw2d/runtime';

/**
 * Generated starter shell: top-down controller family.
 *
 * See platformShellPack.ts's file comment for the pattern this follows -
 * copied verbatim by `sw2d new`, edited freely afterward.
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
  id: 'game.top-down-shell',
  version: '0.1.0',
  provides: [],
  dependencies: [],

  install(context: SceneContext): InstalledSystemPack {
    const scene = context.scene;
    const tuning = readPlayerTuning(context);
    // Procedural generation (capability program Phase 7): when sw2d.generation
    // is installed this is a deterministic seeded NormalizedLevel; otherwise it
    // is the hand-authored content/levels/main.json. Same downstream readers.
    const { level, manifest: generationManifest } = resolveSceneLevel(context, LEVEL_DOCUMENT);
    const playerKey = context.assets.resolve('player');
    const platformKey = context.assets.resolve('platform');
    const { width, height } = context.definition.viewport;

    const walls = scene.physics.add.staticGroup();
    for (const solid of level?.solids ?? []) {
      const body = walls.create(solid.x + solid.width / 2, solid.y + solid.height / 2, platformKey) as Phaser.Physics.Arcade.Sprite;
      body.setDisplaySize(solid.width, solid.height);
      body.refreshBody();
    }

    const spawn = level?.objects.find((object) => object.class === 'PlayerSpawn');
    const spawnX = spawn?.x ?? width * 0.5;
    const spawnY = spawn?.y ?? height * 0.5;

    const player = scene.physics.add.sprite(spawnX, spawnY, playerKey);
    player.setCollideWorldBounds(true);
    player.body.setAllowGravity(false);
    scene.physics.add.collider(player, walls);

    // Data-driven item pickups (capability program Phase 2). Inert unless the
    // game installs sw2d.items - see platformShellPack.ts's note.
    const pickups = bindCollectiblePickups(context, player, level);
    // Weapons (capability program Phase 3). Inert unless sw2d.weapons is installed.
    const weapon = bindStarterWeapon(context);
    let nowMs = 0;
    let facingX = 1;
    let facingY = 0;

    const debugHandle = context.debug.contribute('game.top-down-shell', () => ({
      x: Math.round(player.x),
      y: Math.round(player.y),
      vx: Math.round(player.body.velocity.x),
      vy: Math.round(player.body.velocity.y),
      items: pickups.inventory(),
      pickupsRemaining: pickups.remaining(),
      weapon: weapon.snapshot(),
      ...(generationManifest ? { generation: generationManifest } : {}),
    }));

    let disposed = false;

    return {
      id: GAME_SPECIFIC_PACK.id,

      update(deltaMs: number): void {
        if (disposed) return;
        nowMs += deltaMs;
        const intent = topDownController.read(context.input);
        player.setVelocityX(intent.moveX * tuning.moveSpeed);
        player.setVelocityY(intent.moveY * tuning.moveSpeed);
        if (intent.aimMagnitude > 0) {
          facingX = intent.aimX;
          facingY = intent.aimY;
        } else if (intent.moveMagnitude > 0) {
          facingX = intent.moveX;
          facingY = intent.moveY;
        }
        weapon.update(deltaMs, nowMs);
        if (intent.primaryPressed) weapon.fire(nowMs, facingX, facingY, { x: player.x, y: player.y });
      },

      dispose(): void {
        if (disposed) return;
        disposed = true;
        debugHandle.dispose();
        pickups.dispose();
        weapon.dispose();
        try {
          player.destroy();
        } catch {
          /* scene already tearing down */
        }
        try {
          walls.clear(true, true);
          walls.destroy(true);
        } catch {
          /* scene already tearing down */
        }
      },
    };
  },
};
