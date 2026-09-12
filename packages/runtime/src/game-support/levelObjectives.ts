import type Phaser from 'phaser';
import type { NormalizedLevel } from '@sw2d/contracts';
import { accentStyle, mutedStyle } from '../scenes/theme.ts';
import type { SceneContext } from '../scenes/SceneContext.ts';

/**
 * Bind the universal level's authored objectives - `Checkpoint`, `Hazard`,
 * `Collectible` and `Exit` - to the reusable `sw2d.world` state
 * (Category-C convergence program).
 *
 * The generator has always authored these objects into
 * `content/levels/main.json`, and `sw2d.world-entities` has always been the
 * registry that dispatches them; but the plain generated platform and
 * top-down shells never registered a consumer, so a freshly generated
 * `traditional-platformer` walked and jumped with no checkpoint, no hazard,
 * no collectible quota and no exit - and the catalog stated no limitation.
 * This binder is what both plain shells now call. It is inert when
 * `sw2d.world` is not installed or the level has none of these objects, and
 * it leaves `Collectible` alone when `sw2d.items` owns pickups
 * (`bindCollectiblePickups`), gating the exit on the caller's quota instead.
 *
 * Deliberately small: checkpoint identity and cleared flags live in
 * `world.state`; the binder owns only the sensor sprites and the run
 * counters a proof reads back. Not a level-scripting framework.
 */

const WORLD_CAPABILITY_ID = 'world.state';
const ITEMS_CAPABILITY_ID = 'items.state';
const ARCADE_CAPABILITY_ID = 'arcade.score';

interface WorldState {
  setFlag(flag: string, value: boolean): void;
  hasFlag(flag: string): boolean;
  activateCheckpoint(checkpointId: string): void;
  currentCheckpoint(): string | null;
}

interface ArcadeLedger {
  addScore(delta: number): number;
}

export interface LevelObjectivesSnapshot {
  readonly active: boolean;
  /** Collectibles this binder owns and the player has taken (0 when sw2d.items owns pickups). */
  readonly collected: number;
  /** Collectibles this binder owns in the level. */
  readonly quota: number;
  readonly checkpoint: string | null;
  /** Hazard resets this run. */
  readonly resets: number;
  readonly cleared: boolean;
  readonly outcome: 'playing' | 'complete';
}

export interface LevelObjectivesBinding {
  readonly active: boolean;
  snapshot(): LevelObjectivesSnapshot;
  /** Advance the hazard re-trigger cooldown on the shell's simulation clock. */
  tick(deltaMs: number): void;
  render(): void;
  dispose(): void;
}

const INERT: LevelObjectivesBinding = {
  active: false,
  snapshot: () => ({ active: false, collected: 0, quota: 0, checkpoint: null, resets: 0, cleared: false, outcome: 'playing' }),
  tick: () => undefined,
  render: () => undefined,
  dispose: () => undefined,
};

export function bindLevelObjectives(
  context: SceneContext,
  player: Phaser.Physics.Arcade.Sprite,
  level: NormalizedLevel | undefined,
  options: {
    /** Extra gate on the exit - e.g. `() => pickups.remaining() === 0` when sw2d.items owns the collectibles. */
    readonly exitRequires?: () => boolean;
    /** Draw the objective HUD line. Default true. */
    readonly hud?: boolean;
  } = {},
): LevelObjectivesBinding {
  if (!level || !context.capabilities.has(WORLD_CAPABILITY_ID)) return INERT;
  const objects = level.objects.filter((o) => o.class === 'Checkpoint' || o.class === 'Hazard' || o.class === 'Collectible' || o.class === 'Exit');
  if (objects.length === 0) return INERT;
  const world = context.capabilities.require<WorldState>(WORLD_CAPABILITY_ID);
  const itemsOwnPickups = context.capabilities.has(ITEMS_CAPABILITY_ID);
  const arcade = context.capabilities.has(ARCADE_CAPABILITY_ID) ? context.capabilities.require<ArcadeLedger>(ARCADE_CAPABILITY_ID) : null;
  const scene = context.scene;
  const { width, height } = context.definition.viewport;
  const hud = options.hud !== false;

  const spawn = { x: player.x, y: player.y };
  const checkpoints = new Map<string, { x: number; y: number }>();
  const sprites: Phaser.GameObjects.Sprite[] = [];
  const colliders: Phaser.Physics.Arcade.Collider[] = [];
  const takenSprites = new Set<Phaser.GameObjects.GameObject>();

  let collected = 0;
  let resets = 0;
  let cleared = false;
  let hazardCooldownMs = 0;
  let disposed = false;
  const quota = itemsOwnPickups ? 0 : objects.filter((o) => o.class === 'Collectible').length;

  function sensor(x: number, y: number, w: number, h: number, key: string): Phaser.GameObjects.Sprite {
    const sprite = scene.add.sprite(x + w / 2, y + h / 2, key);
    if (w > 0 && h > 0) sprite.setDisplaySize(w, h);
    scene.physics.add.existing(sprite, true);
    sprites.push(sprite);
    return sprite;
  }

  function respawn(): void {
    const id = world.currentCheckpoint();
    const target = (id ? checkpoints.get(id) : undefined) ?? spawn;
    player.setVelocity(0, 0);
    player.setPosition(target.x, target.y);
  }

  for (const object of objects) {
    if (object.class === 'Checkpoint') {
      const id = String(object.properties['checkpointId'] ?? `checkpoint-${checkpoints.size + 1}`);
      checkpoints.set(id, { x: object.x, y: object.y });
      const sprite = sensor(object.x, object.y, object.width, object.height, context.assets.resolve('checkpoint'));
      colliders.push(scene.physics.add.overlap(player, sprite, () => {
        if (disposed || world.currentCheckpoint() === id) return;
        world.activateCheckpoint(id);
        context.audio.playCue('ui.confirm');
        paint();
      }));
    } else if (object.class === 'Hazard') {
      const sprite = sensor(object.x, object.y, object.width, object.height, context.assets.resolve('hazard'));
      colliders.push(scene.physics.add.overlap(player, sprite, () => {
        if (disposed || cleared || hazardCooldownMs > 0) return;
        resets += 1;
        hazardCooldownMs = 500;
        respawn();
        paint();
      }));
    } else if (object.class === 'Collectible' && !itemsOwnPickups) {
      const itemId = String(object.properties['itemId'] ?? `collectible-${collected}`);
      const rawValue = Number(object.properties['value']);
      const value = Number.isFinite(rawValue) ? rawValue : 0;
      const sprite = sensor(object.x, object.y, object.width || 16, object.height || 16, context.assets.resolve('pickup'));
      colliders.push(scene.physics.add.overlap(player, sprite, () => {
        if (disposed || takenSprites.has(sprite) || world.hasFlag(`collected.${itemId}`)) return;
        takenSprites.add(sprite);
        world.setFlag(`collected.${itemId}`, true);
        collected += 1;
        arcade?.addScore(value);
        context.audio.playCue('ui.confirm');
        sprite.destroy();
        paint();
      }));
    } else if (object.class === 'Exit') {
      const exitId = String(object.properties['exitId'] ?? 'exit');
      const sprite = sensor(object.x, object.y, object.width, object.height, context.assets.resolve('exit'));
      colliders.push(scene.physics.add.overlap(player, sprite, () => {
        if (disposed || cleared) return;
        if (collected < quota) return;
        if (options.exitRequires && !options.exitRequires()) return;
        cleared = true;
        world.setFlag(`level.cleared.${exitId}`, true);
        context.audio.playCue('ui.confirm');
        player.setVelocity(0, 0);
        paint();
      }));
    }
  }

  const status = hud ? scene.add.text(width * 0.5, 54, '', mutedStyle(14)).setOrigin(0.5).setScrollFactor(0).setDepth(50) : null;
  const hint = hud ? scene.add.text(width * 0.5, height - 28, '', accentStyle(14)).setOrigin(0.5).setScrollFactor(0).setDepth(50) : null;

  function snapshot(): LevelObjectivesSnapshot {
    return {
      active: true,
      collected,
      quota,
      checkpoint: world.currentCheckpoint(),
      resets,
      cleared,
      outcome: cleared ? 'complete' : 'playing',
    };
  }

  function paint(): void {
    if (!status || !hint) return;
    const snap = snapshot();
    status.setText(
      `${quota > 0 ? `collected ${snap.collected}/${snap.quota}  ·  ` : ''}checkpoint ${snap.checkpoint ?? 'none'}  ·  resets ${snap.resets}`,
    );
    hint.setText(snap.cleared ? 'LEVEL CLEARED' : quota > 0 && snap.collected < quota ? 'COLLECT EVERYTHING, THEN REACH THE EXIT' : 'REACH THE EXIT');
  }
  paint();

  return {
    active: true,
    snapshot,
    tick(deltaMs: number): void {
      if (disposed || hazardCooldownMs <= 0) return;
      hazardCooldownMs = Math.max(0, hazardCooldownMs - deltaMs);
    },
    render: paint,
    dispose(): void {
      if (disposed) return;
      disposed = true;
      for (const collider of colliders) {
        try {
          scene.physics.world.removeCollider(collider);
        } catch {
          /* scene already tearing down */
        }
      }
      try {
        for (const sprite of sprites) sprite.destroy();
        status?.destroy();
        hint?.destroy();
      } catch {
        /* scene already tearing down */
      }
    },
  };
}
