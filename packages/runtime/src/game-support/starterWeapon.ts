import { WEAPONS_CAPABILITY_ID, type CombatDamageSink, type ItemsService, type WeaponsService } from '@sw2d/contracts';
import type { SceneContext } from '../scenes/SceneContext.ts';
import { createProjectileRuntime, type ProjectileRuntime } from './projectileRuntime.ts';

/**
 * Minimal weapon wiring for a generated starter (capability program Phase 3).
 *
 * Inert unless the game installs `sw2d.weapons`. When present it equips the
 * player with the first catalog weapon and fires real projectiles through the
 * reusable `createProjectileRuntime` bridge on demand. A starter has no
 * enemies, so there are no target groups here - projectile-vs-target damage,
 * pierce and bounce are proven by the phase's proof games. This exists so a
 * newly generated weapon-family game genuinely *consumes* the capability, not
 * just ships its catalog.
 */
export interface StarterWeaponBinding {
  fire(nowMs: number, dirX: number, dirY: number, origin: { x: number; y: number }): void;
  update(deltaMs: number, nowMs: number): void;
  /** `null` when `sw2d.weapons` is not installed. */
  snapshot(): { weaponId: string | null; ammo: number | null; projectilesLive: number; projectilesSpawned: number } | null;
  dispose(): void;
}

const INERT: StarterWeaponBinding = {
  fire: () => undefined,
  update: () => undefined,
  snapshot: () => null,
  dispose: () => undefined,
};

export function bindStarterWeapon(context: SceneContext, playerCombatId = 'player'): StarterWeaponBinding {
  if (!context.capabilities.has(WEAPONS_CAPABILITY_ID)) return INERT;
  const weapons = context.capabilities.require<WeaponsService>(WEAPONS_CAPABILITY_ID);
  const combat = context.capabilities.require<CombatDamageSink & { register(id: string, max: number): void }>('combat.health');
  const items = context.capabilities.has('items.state')
    ? context.capabilities.require<Pick<ItemsService, 'applyEffects'>>('items.state')
    : undefined;

  const firstWeapon = weapons.definitionIds()[0];
  if (firstWeapon) weapons.equip(playerCombatId, firstWeapon);

  const { width, height } = context.definition.viewport;
  const runtime: ProjectileRuntime = createProjectileRuntime({
    scene: context.scene,
    weapons,
    combat,
    ...(items ? { items } : {}),
    worldWidth: width,
    worldHeight: height,
    // A starter has one always-present themed sprite for projectiles; a game
    // that wants per-weapon projectile art passes its own resolver to
    // createProjectileRuntime directly.
    resolveTexture: () => context.assets.resolve('pickup'),
    targetGroups: [],
    resolveTarget: () => null,
  });

  let disposed = false;
  return {
    fire(nowMs, dirX, dirY, origin) {
      if (disposed || !firstWeapon) return;
      runtime.fire({ ownerId: playerCombatId, originX: origin.x, originY: origin.y, dirX, dirY, nowMs });
    },
    update(deltaMs, nowMs) {
      if (disposed) return;
      runtime.update(deltaMs, nowMs);
    },
    snapshot: () =>
      firstWeapon
        ? {
            weaponId: weapons.ownerState(playerCombatId).weaponId,
            ammo: weapons.ownerState(playerCombatId).ammo,
            projectilesLive: runtime.liveCount,
            projectilesSpawned: runtime.spawnedTotal,
          }
        : null,
    dispose() {
      if (disposed) return;
      disposed = true;
      runtime.dispose();
    },
  };
}
