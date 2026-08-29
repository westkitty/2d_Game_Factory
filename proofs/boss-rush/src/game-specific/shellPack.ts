import { WEAPONS_CAPABILITY_ID, ENCOUNTERS_CAPABILITY_ID, type InstalledSystemPack, type WeaponsService, type EncounterService } from '@sw2d/contracts';
import { createEncounterRuntime, createProjectileRuntime, topDownController, type SceneContext, type ScenePackDefinition } from '@sw2d/runtime';
import { CAPABILITY_IDS, type CombatService } from '@sw2d/packs';

/**
 * Phase 4 proof - boss-rush. One boss, three mechanically distinct phases
 * (aimed shot -> aimed fan -> ring), transitions driven by
 * `entity-health-below` conditions in `content/encounters.json`, each new
 * phase opening a short `onEnterInvulnMs` window and phase 3 raising a world
 * flag. All orchestration is the reusable `sw2d.encounters` model; the shell
 * only spawns the boss sprite and wires input.
 */

const PLAYER_ID = 'player';
const BOSS_ID = 'boss';
const BOSS_MAX_HEALTH = 240;

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
    combat.register(PLAYER_ID, 80);
    weapons.equip(PLAYER_ID, 'sidearm');
    const playerGroup = scene.physics.add.group();
    playerGroup.add(player);

    const boss = scene.physics.add.sprite(width * 0.5, 70, context.assets.resolve('enemy'));
    boss.setDisplaySize(64, 40);
    boss.body.setAllowGravity(false);
    boss.setImmovable(true);
    combat.register(BOSS_ID, BOSS_MAX_HEALTH);
    const bossGroup = scene.physics.add.group();
    bossGroup.add(boss);

    const flags = new Set<string>();

    const projectiles = createProjectileRuntime({
      scene,
      weapons,
      combat,
      worldWidth: width,
      worldHeight: height,
      resolveTexture: (role) => context.assets.resolve(role === 'hazard' ? 'hazard' : 'pickup'),
      targetGroups: [bossGroup, playerGroup],
      resolveTarget: (obj) => {
        if (obj === boss) return combat.has(BOSS_ID) && combat.get(BOSS_ID).current > 0 ? { entityId: BOSS_ID, team: 'enemy' } : null;
        if (obj === player) return combat.has(PLAYER_ID) ? { entityId: PLAYER_ID, team: 'player' } : null;
        return null;
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
      flag: (name) => flags.has(name),
      setFlag: (name, value) => (value ? flags.add(name) : flags.delete(name)),
      setInvulnerable: (id, ms, at) => combat.setInvulnerableFor(id, ms, at),
      bossOrigin: () => [boss.x, boss.y],
      spawnEnemy: () => null, // this encounter has no spawn groups
    });
    encounter.start('warden');

    const debugHandle = context.debug.contribute('game.top-down-shell', () => ({
      x: Math.round(player.x),
      y: Math.round(player.y),
      playerHealth: combat.get(PLAYER_ID),
      bossHealth: combat.has(BOSS_ID) ? combat.get(BOSS_ID).current : 0,
      bossHealthFraction: combat.has(BOSS_ID) ? combat.get(BOSS_ID).current / BOSS_MAX_HEALTH : 0,
      bossInvulnerable: combat.has(BOSS_ID) ? combat.get(BOSS_ID).invulnerableUntilMs > nowMs : false,
      phaseId: encounters.state().phaseId,
      phaseIndex: encounters.state().phaseIndex,
      finalPhaseFlag: flags.has('finalPhase'),
      bulletsFired: encounter.bulletsFired,
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
          projectiles.fire({ ownerId: PLAYER_ID, originX: player.x, originY: player.y, dirX: 0, dirY: -1, nowMs });
        }
      },
      dispose(): void {
        if (disposed) return;
        disposed = true;
        debugHandle.dispose();
        encounter.dispose();
        projectiles.dispose();
        combat.remove(PLAYER_ID);
        if (combat.has(BOSS_ID)) combat.remove(BOSS_ID);
        try {
          player.destroy();
          boss.destroy();
        } catch {
          /* tearing down */
        }
      },
    };
  },
};
