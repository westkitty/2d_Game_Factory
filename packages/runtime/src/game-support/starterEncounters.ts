import type Phaser from 'phaser';
import {
  ENCOUNTERS_CAPABILITY_ID,
  WEAPONS_CAPABILITY_ID,
  type EncounterService,
  type EncounterSpawnRequest,
  type WeaponsService,
} from '@sw2d/contracts';
import { accentStyle, headingStyle, mutedStyle } from '../scenes/theme.ts';
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
  /**
   * When false, the player's death ends the battle instead of respawning
   * (permadeath - Final Product Completion Wave 2, survivor-like / roguelite
   * runs). Default true.
   */
  readonly respawn?: boolean;
  /** Run loadout applied at bind time (Final Product Completion Wave 2). */
  readonly loadout?: { readonly maxHealthBonus?: number; readonly damageBonus?: number; readonly speedBonus?: number };
  /** Extra enemy archetype -> texture role resolution (the boss archetype gets the hazard role by default). */
  readonly enemyTextureRole?: (archetype: string) => 'enemy' | 'hazard' | 'pickup' | 'player';
  /**
   * Final Product Completion Wave 3 options.
   * `hud`: draw the battle HUD (wave / boss / score / time). Default true.
   * `walls`: a static group `ground` archetypes collide with (platformers).
   * `gravity`: gravity applied to `ground` archetypes. Default 1100.
   * `spawnOffset`: world offset added to spawn positions (a rail camera's scroll).
   * `timeLimitMs`: gallery time limit - the sequence must finish before it runs out.
   * `escapeEdge`: enemies leaving the play area count as escaped (gallery / rail misses) and are removed.
   */
  readonly hud?: boolean;
  readonly walls?: Phaser.Physics.Arcade.StaticGroup;
  readonly gravity?: number;
  readonly spawnOffset?: () => readonly [number, number];
  readonly timeLimitMs?: number;
  readonly escapeEdge?: boolean;
  /** Whether `drift` archetypes bounce off the play area (gallery targets) or sweep straight off it (stage formations). Default true. */
  readonly driftBounce?: boolean;
  /** World size for edge checks when it differs from the viewport. */
  readonly world?: () => { readonly width: number; readonly height: number; readonly x: number; readonly y: number };
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
  /** Escalation wave of the running encounter (0-based). */
  readonly wave: number;
  /** Current enemy pursuit speed after escalation and loadout. */
  readonly enemySpeed: number;
  /** True once a permadeath battle has ended (player died with respawn off) or the sequence finished. */
  readonly over: boolean;
  readonly outcome: 'playing' | 'failed' | 'complete';
  /** Boss sequence progress (Final Product Completion Wave 3): index of the running encounter and the total. */
  readonly sequenceIndex: number;
  readonly sequenceLength: number;
  readonly bossesDefeated: number;
  readonly transitionMsLeft: number;
  /** Score banked through `arcade.score` (0 when no arcade ledger / no archetype score). */
  readonly score: number;
  /** Gallery / rail: enemies that escaped the play area. */
  readonly escaped: number;
  /** Player shots that landed vs fired (accuracy). */
  readonly hits: number;
  readonly shots: number;
  readonly timeLeftMs: number | null;
  readonly bossHealth: { readonly current: number; readonly max: number } | null;
  /** Projectile pool statistics (matrix L12): sprites allocated at peak, spawns served from the pool. */
  readonly poolAllocated: number;
  readonly poolReused: number;
  readonly playerHealth: { readonly current: number; readonly max: number } | null;
  /** Live enemy positions / velocities (rounded) - for HUD/QA aiming, never gameplay logic. */
  readonly enemies: readonly { readonly id: string; readonly x: number; readonly y: number; readonly vx: number; readonly vy: number; readonly archetype: string }[];
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

  const sequence = encounters.sequence();
  const sequenceIds = sequence ? sequence.encounterIds.filter((id) => encounters.lookup(id)) : [];
  const encounterId = sequenceIds[0] ?? encounters.definitionIds()[0];
  if (!encounterId) return INERT;

  const playerId = options.playerCombatId ?? 'player';
  const loadout = options.loadout ?? {};
  const playerMaxHealth = (options.playerMaxHealth ?? 100) + (loadout.maxHealthBonus ?? 0);
  const baseEnemySpeed = options.enemySpeed ?? 60;
  const playerDamageBonus = loadout.damageBonus ?? 0;
  const respawn = options.respawn !== false;
  const escalation = encounters.escalation();
  const hud = options.hud !== false;
  const gravity = options.gravity ?? 1100;
  const arcade = context.capabilities.get<{ score(): number; addScore(delta: number): number }>('arcade.score') ?? null;
  const timeLimitMs = options.timeLimitMs ?? null;
  const world = options.world ?? (() => ({ x: 0, y: 0, width, height }));
  const contactDamage = options.contactDamage ?? 8;
  const contactInvulnMs = options.contactInvulnMs ?? 700;
  const respawnInvulnMs = options.respawnInvulnMs ?? 1500;
  const { width, height } = context.definition.viewport;

  if (!combat.has(playerId)) combat.register(playerId, playerMaxHealth);

  // Prefer a player-team weapon from the catalog; fall back to the first id.
  const weaponIds = weapons.definitionIds();
  const playerWeapon = weaponIds.find((id) => weapons.lookup(id)?.team === 'player') ?? weaponIds[0];
  if (playerWeapon) weapons.equip(playerId, playerWeapon);

  interface LiveEnemy {
    sprite: Phaser.Physics.Arcade.Sprite;
    alive: boolean;
    archetype: string;
    motion: 'chase' | 'ground' | 'drift' | 'approach' | 'hold';
    speed: number;
    vx: number;
    vy: number;
    score: number;
  }
  const enemies = new Map<string, LiveEnemy>();
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
  let over = false;
  let outcome: 'playing' | 'failed' | 'complete' = 'playing';
  let escaped = 0;
  let shots = 0;
  let elapsedMs = 0;
  let scoreBanked = 0;
  let sequenceIndex = 0;
  let bossesDefeated = 0;
  let transitionMsLeft = 0;
  let currentEncounterId = encounterId;
  const enemySpeed = (): number => baseEnemySpeed * encounters.speedScale();

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
    damageBonusFor: (ownerId) => (ownerId === playerId ? playerDamageBonus : 0),
    bounds: world,
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
      const role: 'enemy' | 'hazard' | 'pickup' | 'player' = options.enemyTextureRole?.(request.archetype) ?? (request.archetype === 'boss' ? 'hazard' : 'enemy');
      const [ox, oy] = options.spawnOffset?.() ?? [0, 0];
      const sprite = scene.physics.add.sprite(request.x + ox, request.y + oy, context.assets.resolve(role));
      const def = encounters.archetype(request.archetype);
      const size = def?.size ?? (request.archetype === 'boss' ? 56 : 0);
      if (size > 0) sprite.setDisplaySize(size, size);
      const motion = def?.motion ?? 'chase';
      sprite.body.setAllowGravity(motion === 'ground');
      if (motion === 'ground') {
        sprite.setGravityY(gravity);
        if (options.walls) scene.physics.add.collider(sprite, options.walls);
      }
      enemyGroup.add(sprite);
      combat.register(request.requestId, request.health);
      const speed = def?.speed ?? baseEnemySpeed;
      const driftRad = ((def?.driftDeg ?? 0) * Math.PI) / 180;
      enemies.set(request.requestId, {
        sprite,
        alive: true,
        archetype: request.archetype,
        motion,
        speed,
        vx: motion === 'drift' ? Math.cos(driftRad) * speed : 0,
        vy: motion === 'drift' ? Math.sin(driftRad) * speed : 0,
        score: def?.score ?? 0,
      });
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
      if (!respawn) {
        // Permadeath: the battle is over. Enemies freeze, nothing respawns.
        finish('failed');
        return;
      }
      combat.remove(playerId);
      combat.register(playerId, playerMaxHealth);
      combat.setInvulnerableFor(playerId, respawnInvulnMs, nowMsLatest);
      return;
    }
    const enemy = enemies.get(entityId);
    if (enemy) {
      kills += 1;
      if (enemy.score > 0 && arcade) {
        arcade.addScore(enemy.score);
        scoreBanked += enemy.score;
      }
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

  const title = hud ? scene.add.text(width * 0.5, 28, '', headingStyle(20)).setOrigin(0.5).setScrollFactor(0).setDepth(50) : null;
  const status = hud ? scene.add.text(width * 0.5, 54, '', mutedStyle(14)).setOrigin(0.5).setScrollFactor(0).setDepth(50) : null;
  const hint = hud ? scene.add.text(width * 0.5, height - 28, '', accentStyle(14)).setOrigin(0.5).setScrollFactor(0).setDepth(50) : null;

  function bossHealth(): { current: number; max: number } | null {
    if (sequenceIds.length === 0) return null;
    let best: { current: number; max: number } | null = null;
    for (const [id, enemy] of enemies) {
      if (!enemy.alive || !combat.has(id)) continue;
      const h = combat.get(id);
      if (!best || h.max > best.max) best = { current: h.current, max: h.max };
    }
    return best;
  }

  function paint(): void {
    if (!title || !status || !hint) return;
    const health = combat.has(playerId) ? combat.get(playerId) : null;
    const timeLeft = timeLimitMs === null ? null : Math.max(0, timeLimitMs - elapsedMs);
    if (sequenceIds.length > 0) {
      const boss = bossHealth();
      title.setText(outcome === 'complete' ? 'ALL BOSSES DOWN' : outcome === 'failed' ? (timeLeft === 0 ? 'TIME UP' : 'DOWN') : transitionMsLeft > 0 ? `BOSS ${sequenceIndex} DOWN` : `BOSS ${sequenceIndex + 1} / ${sequenceIds.length}`);
      status.setText(
        `${health ? `hp ${health.current}/${health.max}` : ''}${boss ? `  ·  boss ${boss.current}/${boss.max}` : ''}  ·  kills ${kills}${scoreBanked > 0 ? `  ·  score ${arcade?.score() ?? scoreBanked}` : ''}${
          escaped > 0 ? `  ·  escaped ${escaped}` : ''
        }${timeLeft !== null ? `  ·  ${(timeLeft / 1000).toFixed(1)}s` : ''}${shots > 0 ? `  ·  ${projectiles.hitsResolved}/${shots} hits` : ''}`,
      );
      hint.setText(outcome === 'playing' ? (transitionMsLeft > 0 ? 'NEXT BOSS INCOMING' : 'FIRE J/X   AIM WITH MOUSE OR NUMPAD') : 'P THEN K RESTARTS');
    } else {
      title.setText(outcome === 'complete' ? 'CLEARED' : outcome === 'failed' ? 'RUN OVER' : `WAVE ${wavesCleared + 1}`);
      status.setText(
        `${health ? `hp ${health.current}/${health.max}` : ''}  ·  foes ${[...enemies.values()].filter((e) => e.alive).length}  ·  kills ${kills}${
          scoreBanked > 0 ? `  ·  score ${arcade?.score() ?? scoreBanked}` : ''
        }${escaped > 0 ? `  ·  escaped ${escaped}` : ''}${timeLeft !== null ? `  ·  ${(timeLeft / 1000).toFixed(1)}s` : ''}${
          encounters.state().wave > 0 ? `  ·  escalation x${encounters.state().wave}` : ''
        }`,
      );
      hint.setText(outcome === 'playing' ? 'FIRE J/X   AIM WITH MOUSE OR NUMPAD   CLEAR THE WAVE' : 'P THEN K RESTARTS');
    }
  }

  function finish(next: 'failed' | 'complete'): void {
    if (over) return;
    over = true;
    outcome = next;
    for (const enemy of enemies.values()) enemy.sprite.setVelocity(0, 0);
    context.events.emit('encounters:battleOver', { outcome: next, kills, wavesCleared });
  }

  paint();
  let disposed = false;

  return {
    active: true,

    fire(nowMs, dirX, dirY, origin) {
      if (disposed || !playerWeapon || over) return;
      const result = projectiles.fire({ ownerId: playerId, originX: origin.x, originY: origin.y, dirX, dirY, nowMs });
      if (result.fired) shots += 1;
    },

    update(deltaMs, nowMs) {
      if (disposed) return;
      nowMsLatest = nowMs;
      projectiles.update(deltaMs, nowMs);
      if (over) {
        paint();
        return;
      }
      elapsedMs += deltaMs;
      if (timeLimitMs !== null && elapsedMs >= timeLimitMs) {
        finish('failed');
        paint();
        return;
      }
      if (transitionMsLeft > 0) {
        // Boss sequence: readable gap between one boss falling and the next.
        transitionMsLeft = Math.max(0, transitionMsLeft - deltaMs);
        if (transitionMsLeft === 0) {
          currentEncounterId = sequenceIds[sequenceIndex]!;
          encounter.start(currentEncounterId);
          context.events.emit('encounters:bossStarted', { encounterId: currentEncounterId, index: sequenceIndex, of: sequenceIds.length });
        }
        paint();
        return;
      }
      encounter.update(deltaMs, nowMs);
      // Deterministic pressure by archetype behaviour (content/encounters.json
      // `archetypes`; default chase): close on the player, walk the ground,
      // drift and bounce, approach the gun, or hold.
      const scale = encounters.speedScale();
      const bounds = world();
      for (const [id, enemy] of enemies) {
        if (!enemy.alive) continue;
        const sprite = enemy.sprite;
        const speed = (enemy.motion === 'chase' ? enemySpeed() : enemy.speed * scale);
        const dx = player.x - sprite.x;
        const dy = player.y - sprite.y;
        const dist = Math.hypot(dx, dy);
        switch (enemy.motion) {
          case 'chase':
          case 'approach':
            if (dist > 1) sprite.setVelocity((dx / dist) * speed, (dy / dist) * speed);
            else sprite.setVelocity(0, 0);
            break;
          case 'ground':
            sprite.setVelocityX(Math.abs(dx) > 8 ? Math.sign(dx) * speed : 0);
            break;
          case 'drift': {
            // Gallery targets bounce inside the play area; on a stage whose
            // edges are escapes (escapeEdge), a formation sweeps straight off.
            if (options.driftBounce !== false) {
              if ((sprite.x <= bounds.x + 16 && enemy.vx < 0) || (sprite.x >= bounds.x + bounds.width - 16 && enemy.vx > 0)) enemy.vx = -enemy.vx;
              if ((sprite.y <= bounds.y + 16 && enemy.vy < 0) || (sprite.y >= bounds.y + bounds.height - 16 && enemy.vy > 0)) enemy.vy = -enemy.vy;
            }
            sprite.setVelocity(enemy.vx * scale, enemy.vy * scale);
            break;
          }
          case 'hold':
            sprite.setVelocity(0, 0);
            break;
        }
        if (options.escapeEdge) {
          // Gallery / rail: a target that gets past the gun line or leaves the
          // world has escaped - a miss, not a kill.
          const margin = 40;
          const past = enemy.motion === 'approach' ? dist <= 28 : false;
          const gone = sprite.x < bounds.x - margin || sprite.x > bounds.x + bounds.width + margin || sprite.y < bounds.y - margin || sprite.y > bounds.y + bounds.height + margin;
          if (past || gone) {
            escaped += 1;
            enemy.alive = false;
            spriteToEnemy.delete(sprite);
            enemies.delete(id);
            enemyGroup.remove(sprite, true, true);
            if (combat.has(id)) combat.remove(id);
            encounters.reportDeath(id);
            context.events.emit('encounters:escaped', { requestId: id, escaped });
          }
        }
      }
      if (sequenceIds.length > 0 && encounter.completed && enemies.size === 0) {
        // One boss down. Next one after the transition, or the rush is complete.
        bossesDefeated += 1;
        if (sequenceIndex + 1 < sequenceIds.length) {
          sequenceIndex += 1;
          transitionMsLeft = Math.max(1, sequence?.transitionMs ?? 0);
          context.events.emit('encounters:bossDefeated', { encounterId: currentEncounterId, index: sequenceIndex - 1, of: sequenceIds.length });
        } else {
          context.events.emit('encounters:bossDefeated', { encounterId: currentEncounterId, index: sequenceIndex, of: sequenceIds.length });
          finish('complete');
        }
        paint();
        return;
      }
      // Survival loop: when the wave content is exhausted and the field is
      // clear of enemies, run the same content again as the next wave. Only
      // enemies gate the restart - the original `projectiles.liveCount === 0`
      // condition stalled the loop forever for a player who simply held the
      // fire button (their own shots kept liveCount > 0), found by playing
      // the generated arena-combat starter. In-flight shots crossing a wave
      // boundary are fine: combat entries are removed on death, so the fresh
      // wave's re-registered ids resolve cleanly.
      if (sequenceIds.length === 0 && encounter.completed && enemies.size === 0) {
        wavesCleared += 1;
        // Escalation (Final Product Completion Wave 2): the same content as a
        // bigger, tougher, faster wave when the catalog authors it.
        encounter.start(encounterId, escalation ? { wave: wavesCleared } : undefined);
        context.events.emit('encounters:waveCleared', { wavesCleared, wave: encounters.state().wave });
      }
      paint();
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
      wave: encounters.state().wave,
      enemySpeed: Math.round(enemySpeed()),
      over,
      outcome,
      sequenceIndex,
      sequenceLength: sequenceIds.length,
      bossesDefeated,
      transitionMsLeft: Math.round(transitionMsLeft),
      score: arcade?.score() ?? scoreBanked,
      escaped,
      hits: projectiles.hitsResolved,
      shots,
      timeLeftMs: timeLimitMs === null ? null : Math.round(Math.max(0, timeLimitMs - elapsedMs)),
      bossHealth: bossHealth(),
      poolAllocated: projectiles.poolAllocated,
      poolReused: projectiles.poolReused,
      playerHealth: combat.has(playerId) ? { current: combat.get(playerId).current, max: combat.get(playerId).max } : null,
      enemies: [...enemies.entries()]
        .filter(([, e]) => e.alive)
        .map(([id, e]) => ({ id, x: Math.round(e.sprite.x), y: Math.round(e.sprite.y), vx: Math.round(e.sprite.body?.velocity.x ?? 0), vy: Math.round(e.sprite.body?.velocity.y ?? 0), archetype: e.archetype })),
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
        title?.destroy();
        status?.destroy();
        hint?.destroy();
        enemyGroup.destroy(false);
        playerGroup.destroy(false);
      } catch {
        /* scene already tearing down */
      }
    },
  };
}
