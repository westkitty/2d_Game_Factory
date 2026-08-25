import Phaser from 'phaser';
import type { InstalledSystemPack } from '@sw2d/contracts';
import { platformController, type SceneContext, type ScenePackDefinition } from '@sw2d/runtime';

/**
 * Game-specific extension: a controllable placeholder actor.
 *
 * This lives in the *game*, not the runtime, and that is the whole point of the
 * file. It proves four boundaries at once:
 *
 *   1. a game can add real behaviour without editing @sw2d/runtime;
 *   2. SystemPackDefinition/InstalledSystemPack is a working contract, not a
 *      speculative interface;
 *   3. gameplay reads semantic actions only - it never sees a key code, so the
 *      same code is driven by keyboard and by the on-screen touch buttons;
 *   4. movement reads platform *intent* (`platformController.read`), not raw
 *      `ActionInput`, directly - the controller answers "what does the player
 *      intend", this file answers "how does the body move" (velocity,
 *      gravity, the jump-vs-grounded decision).
 *
 * Real platform movement systems (coyote time, jump buffering, variable jump
 * height, double jump) belong to a movement system pack in a later phase.
 * This is deliberately the minimum that proves the wiring.
 */
export interface PlaceholderMoverConfig {
  readonly moveSpeed: number;
  readonly dashMultiplier: number;
  readonly jumpVelocity: number;
  readonly gravity: number;
}

const DEFAULT_CONFIG: PlaceholderMoverConfig = {
  moveSpeed: 220,
  dashMultiplier: 1.75,
  jumpVelocity: -430,
  gravity: 1100,
};

/**
 * Run a disposal step that may legitimately no-op if Phaser has already torn
 * the target down as part of its own scene shutdown. Logged, not swallowed
 * silently, so a genuinely unexpected failure is still visible.
 */
function safely(step: () => void): void {
  try {
    step();
  } catch (error) {
    console.debug('[sw2d] starter.placeholder-mover: disposal step skipped (scene already tearing down)', error);
  }
}

export const PLACEHOLDER_MOVER_PACK: ScenePackDefinition<Partial<PlaceholderMoverConfig>> = {
  id: 'starter.placeholder-mover',
  version: '0.1.0',
  provides: ['starter.player'],
  dependencies: [],
  // Declared now, enforced by the validator Sonnet builds in Phase 2.
  configSchemaId: 'starter/placeholder-mover.config.json',

  install(context: SceneContext, config): InstalledSystemPack {
    const settings: PlaceholderMoverConfig = { ...DEFAULT_CONFIG, ...config };
    const scene = context.scene;
    const { width, height } = context.definition.viewport;

    const platformKey = context.assets.resolve('platform');
    const playerKey = context.assets.resolve('player');

    const ground = scene.physics.add.staticGroup();
    const addPlatform = (x: number, y: number, tiles: number): void => {
      const platform = ground.create(x, y, platformKey) as Phaser.Physics.Arcade.Sprite;
      platform.setScale(tiles, 1).refreshBody();
    };
    addPlatform(width / 2, height - 24, width / 64 + 1);
    addPlatform(width * 0.24, height * 0.66, 3);
    addPlatform(width * 0.72, height * 0.52, 3);

    const player = scene.physics.add.sprite(width * 0.5, height * 0.4, playerKey);
    player.setCollideWorldBounds(true);
    // Per-body gravity: a pack must never mutate world-level physics state that
    // another pack also depends on.
    player.body.setAllowGravity(true);
    player.setGravityY(settings.gravity);

    const collider = scene.physics.add.collider(player, ground);

    const debugHandle = context.debug.contribute('starter.player', () => ({
      x: Math.round(player.x),
      y: Math.round(player.y),
      vx: Math.round(player.body.velocity.x),
      vy: Math.round(player.body.velocity.y),
      onGround: player.body.blocked.down,
    }));

    let disposed = false;

    return {
      id: PLACEHOLDER_MOVER_PACK.id,

      update(): void {
        if (disposed) return;
        const intent = platformController.read(context.input);
        const speed = settings.moveSpeed * (intent.dashHeld ? settings.dashMultiplier : 1);

        player.setVelocityX(intent.moveAxis * speed);
        if (intent.moveAxis !== 0) player.setFlipX(intent.moveAxis < 0);

        // intent.jumpPressed is already a claimed edge (platformController
        // calls consumePress('JUMP')), so this can only fire once per press
        // no matter how many other systems also read the controller.
        if (intent.jumpPressed && player.body.blocked.down) {
          player.setVelocityY(settings.jumpVelocity);
          context.audio.playCue('ui.confirm');
        }
      },

      dispose(): void {
        if (disposed) return;
        disposed = true;
        debugHandle.dispose();
        // A restart queues a stop and an immediate start of the same scene in
        // one batch (SceneRouterImpl.restartRun); by the time this runs, the
        // scene's physics world/groups can already be gone - Phaser tears
        // down a stopped scene's own display list and physics bodies itself.
        // Each step below is independently guarded so a mid-teardown scene
        // cannot abort the steps after it (a throw from `removeCollider`
        // used to skip `player.destroy()`/`ground.destroy()` entirely - a
        // real leak the flat disposable-count evidence did not catch, since
        // SystemHostImpl.dispose() clears its own bookkeeping regardless of
        // whether an individual pack's dispose() throws).
        safely(() => scene.physics.world?.removeCollider(collider));
        safely(() => player.destroy());
        safely(() => {
          ground.clear(true, true);
          ground.destroy(true);
        });
      },
    };
  },
};
