import type Phaser from 'phaser';
import {
  ENCOUNTERS_CAPABILITY_ID,
  WEAPONS_CAPABILITY_ID,
  type EncounterService,
  type EncounterSpawnRequest,
  type WeaponsService,
} from '@sw2d/contracts';
import type { SceneContext } from '../scenes/SceneContext.ts';
import { createEncounterRuntime, type EncounterRuntime } from './encounterRuntime.ts';
import { createProjectileRuntime, type ProjectileRuntime } from './projectileRuntime.ts';

/**
 * Full starter battle wiring for a generated top-down game (Arena finish
 * program, Wave 2 - integration debt, not new capability).
 *
 * Before this existed, a generated bullet-hell / survivor-like / boss-rush
 * game shipped a validated `content/encounters.json` and installed
 * `sw2d.encounters`, and then nothing ever read the service: no enemy
 * spawned, no pattern fired, the "encounter" was inert metadata. This bridge
 * closes that gap with the same reusable pieces the committed proof games
 * already use (`createEncounterRuntime` + `createProjectileRuntime` +
 * `combat.health`), so a newly generated encounter-family game has a real
 * loop on first boot: enemies spawn from content, chase and shoot the
 * player, the player shoots back, kills clear the wave, the next wave
 * starts, and dying costs a life and respawns with a brief invulnerability
 * window.
 *
 * Inert (returns `active: false`) unless the game installs `sw2d.combat`,
 * `sw2d.weapons` AND `sw2d.encounters` - a plain twin-stick starter keeps
 * `bindStarterWeapon`'s lighter wiring. Everything spawned here is owned
 * here and torn down in `dispose()` (restart-safe).
 */

/** The slice of `combat.health` this binding needs (mirrors bindStarterWeapon's approach - avoids a runtime->packs dependency). */
interface StarterCombatService {
  register(id: string, max: number): void;
  has(id: string): boolean;
  get(id: string): { readonly current: number; readonly max: number };
  damage(entityId: string, amount: number, nowMs: number): unknown;
  setInvulnerableFor(entityId: string, durationMs: number, nowMs: number): void;
  remove(id: string): void;
}

export interface StarterEncounterOptions {
  /** Combat entity id for the player. Default 'player'. */
  readonly playerCombatId?: string;
  /** Player max health when this binding registers it. Default 100. */
  readonly playerMaxHealth?: number;
  /** Enemy ground speed toward the player, px/s. Default 60. */
  readonly enemySpeed?: number;
  /** Damage an enemy deals on contact with the player. Default 8. */
  readonly contactDamage?: number;
  /** Invulnerability window after taking contact damage, ms. Default 700. */
  readonly contactInvulnMs?: number;
  /** Invulnerability window after respawning, ms. Default 1500. */
  readonly respawnInvulnMs?: number;
}

export interface StarterEncounterSnapshot {
  readonly weaponId: string | null;
  readonly ammo: number | null;
  readonly projectilesLive: number;
  readonly projectilesSpawned: number;
  readonly enemiesAlive: number;
  readonly kills: number;
  readonly playerDeaths: number;
  readonly wavesCleared: number;
  readonly encounterPhase: string | null;
  readonly encounterComplete: boolean;
  readonly playerHealth: { readonly current: number; readonly max: number } | null;
}

export interface StarterEncounterBinding {
  /** False when any of sw2d.combat / sw2d.weapons / sw2d.encounters is absent - every other member is then a no-op. */
  readonly active: boolean;
  fire(nowMs: number, dirX: number, dirY: number, origin: { x: number; y: number }): void;
  update(deltaMs: number, nowMs: number): void;
  /** `null` when inactive. */
  snapshot(): StarterEncounterSnapshot | null;
  dispose(): void;
}

const INERT: StarterEncounterBinding = {
  active: false,
  fire: () => undefined,
  update: () => undefined,
  snapshot: () => null,
  dispose: () => undefined,
};

export function bindStarterEncounters(
  context: SceneContext,
  player: Phaser.Physics.Arcade.Sprite,
  options: StarterEncounterOptions = {},
): StarterEncounterBinding {
  if (
    !context.capabilities.has('combat.health') ||
    !context.capabilities.has(WEAPONS_CAPABILITY_ID) ||
    !context.capabilities.has(ENCOUNTERS_CAPABILITY_ID)
  ) {
    return INERT;
  }

  const scene = context.scene;
  const combat = context.capabilities.require<StarterCombatService>('combat.health');
  const weapons = context.capabilities.require<WeaponsService>(WEAPONS_CAPABILITY_ID);
  const encounters = context.capabilities.require<EncounterService>(ENCOUNTERS_CAPABILITY_ID);

  const encounterId = encounters.definitionIds()[0];
  if (!encounterId) return INERT;

  const playerId = options.playerCombatId ?? 'player';
  const playerMaxHealth = options.playerMaxHealth ?? 100;
  const enemySpeed = options.enemySpeed ?? 60;
  const contactDamage = options.contactDamage ?? 8;
  const contactInvulnMs = options.contactInvulnMs ?? 700;
  const respawnInvulnMs = options.respawnInvulnMs ?? 1500;
  const { width, height } = context.definition.viewport;

  if (!combat.has(playerId)) combat.register(playerId, playerMaxHealth);

  // Prefer a player-team weapon from the catalog; fall back to the first id.
  const weaponIds = weapons.definitionIds();
  const playerWeapon = weaponIds.find((id) => weapons.lookup(id)?.team === 'player') ?? weaponIds[0];
  if (playerWeapon) weapons.equip(playerId, playerWeapon);

  const enemies = new Map<string, { sprite: Phaser.Physics.Arcade.Sprite; alive: boolean }>();
  const spriteToEnemy = new Map<Phaser.GameObjects.GameObject, string>();
  // Plain (non-physics) groups on purpose: an Arcade physics group applies its
  // body defaults to every added child, which silently reset the shell's
  // player.setCollideWorldBounds(true) and let the player walk out of the
  // arena - a bug found by actually playing the generated bullet-hell. The
  // projectile runtime's overlap checks only need the children to have bodies,
  // which these sprites already do.
  const enemyGroup = scene.add.group();
  const playerGroup = scene.add.group();
  playerGroup.add(player);

  let kills = 0;
  let playerDeaths = 0;
  let wavesCleared = 0;
  let nowMsLatest = 0;

  const projectiles: ProjectileRuntime = createProjectileRuntime({
    scene,
    weapons,
    combat,
    worldWidth: width,
    worldHeight: height,
    resolveTexture: (role) => context.assets.resolve(role === 'hazard' ? 'hazard' : 'pickup'),
    targetGroups: [enemyGroup, playerGroup],
    resolveTarget: (obj) => {
      if (obj === player) return combat.has(playerId) ? { entityId: playerId, team: 'player' } : null;
      const id = spriteToEnemy.get(obj);
      return id && enemies.get(id)?.alive ? { entityId: id, team: 'enemy' } : null;
    },
  });

  const encounter: EncounterRuntime = createEncounterRuntime({
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
    spawnEnemy: (request: EncounterSpawnRequest) => {
      const sprite = scene.physics.add.sprite(request.x, request.y, context.assets.resolve('enemy'));
      sprite.body.setAllowGravity(false);
      enemyGroup.add(sprite);
      combat.register(request.requestId, request.health);
      enemies.set(request.requestId, { sprite, alive: true });
      spriteToEnemy.set(sprite, request.requestId);
      return { entityId: request.requestId, pos: () => [sprite.x, sprite.y] };
    },
  });
  encounter.start(encounterId);

  const contactOverlap = scene.physics.add.overlap(player, enemyGroup, () => {
    if (!combat.has(playerId)) return;
    const before = combat.get(playerId).current;
    combat.damage(playerId, contactDamage, nowMsLatest);
    // Only start a grace window when the hit actually landed (invulnerability
    // already active means damage() was a no-op).
    if (combat.get(playerId).current < before) {
      combat.setInvulnerableFor(playerId, contactInvulnMs, nowMsLatest);
    }
  });

  const onDeath = context.events.on('combat:entityDied', ({ entityId }) => {
    if (entityId === playerId) {
      playerDeaths += 1;
      combat.remove(playerId);
      combat.register(playerId, playerMaxHealth);
      combat.setInvulnerableFor(playerId, respawnInvulnMs, nowMsLatest);
      return;
    }
    const enemy = enemies.get(entityId);
    if (enemy) {
      kills += 1;
      enemy.alive = false;
      spriteToEnemy.delete(enemy.sprite);
      enemies.delete(entityId);
      enemyGroup.remove(enemy.sprite, true, true);
      // The encounter runtime already reported the death to the service; the
      // combat entry is removed here so the same deterministic requestId can
      // register again when the wave loop restarts the encounter.
      if (combat.has(entityId)) combat.remove(entityId);
    }
  });

  let disposed = false;

  return {
    active: true,

    fire(nowMs, dirX, dirY, origin) {
      if (disposed || !playerWeapon) return;
      projectiles.fire({ ownerId: playerId, originX: origin.x, originY: origin.y, dirX, dirY, nowMs });
    },

    update(deltaMs, nowMs) {
      if (disposed) return;
      nowMsLatest = nowMs;
      projectiles.update(deltaMs, nowMs);
      encounter.update(deltaMs, nowMs);
      // Simple deterministic pressure: every live enemy closes on the player.
      for (const enemy of enemies.values()) {
        if (!enemy.alive) continue;
        const dx = player.x - enemy.sprite.x;
        const dy = player.y - enemy.sprite.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 1) enemy.sprite.setVelocity((dx / dist) * enemySpeed, (dy / dist) * enemySpeed);
        else enemy.sprite.setVelocity(0, 0);
      }
      // Survival loop: when the wave content is exhausted and the field is
      // clear, run the same content again as the next wave.
      if (encounter.completed && enemies.size === 0 && projectiles.liveCount === 0) {
        wavesCleared += 1;
        encounter.start(encounterId);
      }
    },

    snapshot: () => ({
      weaponId: playerWeapon ? weapons.ownerState(playerId).weaponId : null,
      ammo: playerWeapon ? weapons.ownerState(playerId).ammo : null,
      projectilesLive: projectiles.liveCount,
      projectilesSpawned: projectiles.spawnedTotal,
      enemiesAlive: [...enemies.values()].filter((e) => e.alive).length,
      kills,
      playerDeaths,
      wavesCleared,
      encounterPhase: encounters.state().phaseId,
      encounterComplete: encounter.completed,
      playerHealth: combat.has(playerId) ? { current: combat.get(playerId).current, max: combat.get(playerId).max } : null,
    }),

    dispose() {
      if (disposed) return;
      disposed = true;
      onDeath.dispose();
      contactOverlap.destroy();
      encounter.dispose();
      projectiles.dispose();
      for (const [id, enemy] of enemies) {
        if (combat.has(id)) combat.remove(id);
        try {
          enemy.sprite.destroy();
        } catch {
          /* scene already tearing down */
        }
      }
      enemies.clear();
      spriteToEnemy.clear();
      if (combat.has(playerId)) combat.remove(playerId);
      try {
        enemyGroup.destroy(false);
        playerGroup.destroy(false);
      } catch {
        /* scene already tearing down */
      }
    },
  };
}
