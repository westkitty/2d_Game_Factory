import type Phaser from 'phaser';
import { ITEMS_CAPABILITY_ID, type ItemsService, type NormalizedLevel } from '@sw2d/contracts';
import type { SceneContext } from '../scenes/SceneContext.ts';

/**
 * Bind `Collectible` level objects to the data-driven item service
 * (capability program Phase 2).
 *
 * A generated game gets this for free: its shell template calls this once,
 * and it does nothing unless the game installed `sw2d.items`. Each Collectible
 * whose `itemId` names a catalog entry becomes a sensor sprite; a player
 * overlap grants the item and applies its on-pickup effects through the
 * reusable service. No per-pickup code, no item logic in the shell.
 */
export interface CollectiblePickupBinding {
  /** Live `{ itemId: count }`, or null when `sw2d.items` is not installed. */
  inventory(): Readonly<Record<string, number>> | null;
  /** Number of Collectible pickups still on the field. */
  remaining(): number;
  dispose(): void;
}

const INERT: CollectiblePickupBinding = { inventory: () => null, remaining: () => 0, dispose: () => undefined };

export function bindCollectiblePickups(
  context: SceneContext,
  player: Phaser.Physics.Arcade.Sprite,
  level: NormalizedLevel | undefined,
  options: { pickupTarget?: string; combatTargetId?: string } = {},
): CollectiblePickupBinding {
  if (!context.capabilities.has(ITEMS_CAPABILITY_ID)) return INERT;
  const items = context.capabilities.require<ItemsService>(ITEMS_CAPABILITY_ID);
  const scene = context.scene;
  const textureKey = context.assets.resolve('pickup');
  const group = scene.physics.add.group();
  const bySprite = new Map<Phaser.GameObjects.GameObject, { itemId: string; quantity: number }>();

  for (const object of level?.objects ?? []) {
    if (object.class !== 'Collectible') continue;
    const itemId = String(object.properties['itemId'] ?? '');
    if (!items.lookup(itemId)) continue;
    const sprite = scene.physics.add.sprite(object.x, object.y, textureKey);
    (sprite.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);
    sprite.setDisplaySize(object.width || 16, object.height || 16);
    group.add(sprite);
    const rawQty = Number(object.properties['value']);
    bySprite.set(sprite, { itemId, quantity: Number.isFinite(rawQty) && rawQty > 0 ? Math.floor(rawQty) : 1 });
  }

  const collider = scene.physics.add.overlap(player, group, (_p, pickup) => {
    const entry = bySprite.get(pickup as Phaser.GameObjects.GameObject);
    if (!entry) return;
    bySprite.delete(pickup as Phaser.GameObjects.GameObject);
    const def = items.lookup(entry.itemId);
    items.grant(entry.itemId, def?.quantityPerGrant ?? entry.quantity);
    // On-pickup effects fire for pick-me-up items (coins, keys); a consumable's
    // effects belong to its consume() call, not the moment it enters the bag.
    if (def && !def.consumable && def.effects && def.effects.length > 0) {
      items.applyEffects(def.effects, { combatTargetId: options.combatTargetId ?? 'player', nowMs: 0 });
    }
    context.audio.playCue('ui.confirm');
    (pickup as Phaser.GameObjects.Sprite).destroy();
  });

  let disposed = false;
  return {
    inventory: () => items.inventory(),
    remaining: () => bySprite.size,
    dispose: () => {
      if (disposed) return;
      disposed = true;
      try {
        scene.physics.world.removeCollider(collider);
      } catch {
        /* scene already tearing down */
      }
      try {
        group.clear(true, true);
        group.destroy(true);
      } catch {
        /* scene already tearing down */
      }
      bySprite.clear();
    },
  };
}
