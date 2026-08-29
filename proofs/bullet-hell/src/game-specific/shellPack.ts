import type Phaser from 'phaser';
import { WEAPONS_CAPABILITY_ID, ENCOUNTERS_CAPABILITY_ID, type InstalledSystemPack, type WeaponsService, type EncounterService } from '@sw2d/contracts';
import { createEncounterRuntime, createProjectileRuntime, topDownController, type SceneContext, type ScenePackDefinition } from '@sw2d/runtime';
import { CAPABILITY_IDS, type CombatService } from '@sw2d/packs';

/**
 * Phase 4 proof - bullet-hell. A bounded, deterministic dense-pattern
 * encounter: `content/encounters.json` drives a phase-level ring + spiral
 * emitter (capped emissions) and a small spawn wave; `createEncounterRuntime`
 * fires the patterns through Phase 3's projectile runtime. Enemy bullets hit
 * the player, the player's sidearm hits the drones - both through the same
 * `combat.health` resolution.
 */

const PLAYER_ID = 'player';

export const GAME_SPECIFIC_PACK: ScenePackDefinition = {
  id: 'game.top-down-shell',
  version: '0.1.0',
  provides: [],
  dependencies: [CAPABILITY_IDS.combat, CAPABILITY_IDS.weapons, CAPABILITY_IDS.encounters],

  install(context: SceneContext): InstalledSystemPack {
    const scene = context.scene;
    const { width, height } = context.definition.viewport;
    const combat = context.capabilities.require<CombatService>(CAPABILITY_IDS.combat);
    const weapons = context.capabilities.require<WeaponsService>(WEAPONS_CAPABILITY_ID);
    const encounters = context.capabilities.require<EncounterService>(ENCOUNTERS_CAPABILITY_ID);

    const player = scene.physics.add.sprite(width * 0.5, height * 0.82, context.assets.resolve('player'));
    player.setCollideWorldBounds(true);
    player.body.setAllowGravity(false);
    combat.register(PLAYER_ID, 60);
    weapons.equip(PLAYER_ID, 'sidearm');
    const playerGroup = scene.physics.add.group();
    playerGroup.add(player);

    const drones = new Map<string, { sprite: Phaser.Physics.Arcade.Sprite; alive: boolean }>();
    const spriteToDrone = new Map<Phaser.GameObjects.GameObject, string>();
    const droneGroup = scene.physics.add.group();

    const projectiles = createProjectileRuntime({
      scene,
      weapons,
      combat,
      worldWidth: width,
      worldHeight: height,
      resolveTexture: (role) => context.assets.resolve(role === 'hazard' ? 'hazard' : 'pickup'),
      targetGroups: [droneGroup, playerGroup],
      resolveTarget: (obj) => {
        if (obj === player) return combat.has(PLAYER_ID) ? { entityId: PLAYER_ID, team: 'player' } : null;
        const id = spriteToDrone.get(obj);
        return id && drones.get(id)?.alive ? { entityId: id, team: 'enemy' } : null;
      },
    });

    let nowMs = 0;
    const encounter = createEncounterRuntime({
      encounters,
      weapons,
      projectiles,
      events: context.events,
      viewport: { width, height },
      playerPos: () => [player.x, player.y],
      healthFraction: (id) => (combat.has(id) ? combat.get(id).current / combat.get(id).max : 0),
      flag: () => false,
      setFlag: () => undefined,
      setInvulnerable: (id, ms, at) => combat.setInvulnerableFor(id, ms, at),
      bossOrigin: () => [width * 0.5, 48],
      spawnEnemy: (request) => {
        const sprite = scene.physics.add.sprite(request.x, request.y, context.assets.resolve('enemy'));
        sprite.body.setAllowGravity(false);
        sprite.setVelocityY(20);
        droneGroup.add(sprite);
        combat.register(request.requestId, request.health);
        drones.set(request.requestId, { sprite, alive: true });
        spriteToDrone.set(sprite, request.requestId);
        return { entityId: request.requestId, pos: () => [sprite.x, sprite.y] };
      },
    });
    encounter.start('storm');

    context.events.on('combat:entityDied', ({ entityId }) => {
      const drone = drones.get(entityId);
      if (drone) {
        drone.alive = false;
        droneGroup.remove(drone.sprite, true, true);
      }
    });

    const debugHandle = context.debug.contribute('game.top-down-shell', () => ({
      x: Math.round(player.x),
      y: Math.round(player.y),
      playerHealth: combat.get(PLAYER_ID),
      dronesAlive: [...drones.values()].filter((d) => d.alive).length,
      phaseId: encounters.state().phaseId,
      bulletsFired: encounter.bulletsFired,
      projectilesLive: projectiles.liveCount,
      hitsResolved: projectiles.hitsResolved,
      encounterComplete: encounter.completed,
    }));

    let disposed = false;
    return {
      id: GAME_SPECIFIC_PACK.id,
      update(deltaMs: number): void {
        if (disposed) return;
        nowMs += deltaMs;
        const intent = topDownController.read(context.input);
        player.setVelocity(intent.moveX * 240, intent.moveY * 240);
        projectiles.update(deltaMs, nowMs);
        encounter.update(deltaMs, nowMs);
        if (intent.primaryPressed || context.input.isDown('PRIMARY_ACTION')) {
          // Aim at the nearest living drone (fallback straight up).
          let dx = 0;
          let dy = -1;
          let best = Infinity;
          for (const d of drones.values()) {
            if (!d.alive) continue;
            const cx = d.sprite.x - player.x;
            const cy = d.sprite.y - player.y;
            const dist = Math.hypot(cx, cy);
            if (dist < best && dist > 0) {
              best = dist;
              dx = cx / dist;
              dy = cy / dist;
            }
          }
          projectiles.fire({ ownerId: PLAYER_ID, originX: player.x, originY: player.y, dirX: dx, dirY: dy, nowMs });
        }
      },
      dispose(): void {
        if (disposed) return;
        disposed = true;
        debugHandle.dispose();
        encounter.dispose();
        projectiles.dispose();
        combat.remove(PLAYER_ID);
        for (const id of drones.keys()) if (combat.has(id)) combat.remove(id);
        try {
          player.destroy();
        } catch {
          /* tearing down */
        }
      },
    };
  },
};
