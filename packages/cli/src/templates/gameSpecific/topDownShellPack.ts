import type { InstalledSystemPack, NormalizedLevel } from '@sw2d/contracts';
import { bindCollectiblePickups, topDownController, type SceneContext, type ScenePackDefinition } from '@sw2d/runtime';

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
    const level = context.content.data[LEVEL_DOCUMENT]?.value as NormalizedLevel | undefined;
    const playerKey = context.assets.resolve('player');
    const { width, height } = context.definition.viewport;

    const spawn = level?.objects.find((object) => object.class === 'PlayerSpawn');
    const spawnX = spawn?.x ?? width * 0.5;
    const spawnY = spawn?.y ?? height * 0.5;

    const player = scene.physics.add.sprite(spawnX, spawnY, playerKey);
    player.setCollideWorldBounds(true);
    player.body.setAllowGravity(false);

    // Data-driven item pickups (capability program Phase 2). Inert unless the
    // game installs sw2d.items - see platformShellPack.ts's note.
    const pickups = bindCollectiblePickups(context, player, level);

    const debugHandle = context.debug.contribute('game.top-down-shell', () => ({
      x: Math.round(player.x),
      y: Math.round(player.y),
      vx: Math.round(player.body.velocity.x),
      vy: Math.round(player.body.velocity.y),
      items: pickups.inventory(),
      pickupsRemaining: pickups.remaining(),
    }));

    let disposed = false;

    return {
      id: GAME_SPECIFIC_PACK.id,

      update(): void {
        if (disposed) return;
        const intent = topDownController.read(context.input);
        player.setVelocityX(intent.moveX * tuning.moveSpeed);
        player.setVelocityY(intent.moveY * tuning.moveSpeed);
      },

      dispose(): void {
        if (disposed) return;
        disposed = true;
        debugHandle.dispose();
        pickups.dispose();
        try {
          player.destroy();
        } catch {
          /* scene already tearing down */
        }
      },
    };
  },
};
