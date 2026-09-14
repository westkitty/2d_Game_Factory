import type Phaser from 'phaser';
import { WEAPONS_CAPABILITY_ID, type WeaponsService } from '@sw2d/contracts';
import { accentStyle, headingStyle, mutedStyle } from '../scenes/theme.ts';
import type { SceneContext } from '../scenes/SceneContext.ts';
import { createProjectileRuntime, type ProjectileRuntime } from './projectileRuntime.ts';

/**
 * Bind the generated vehicle shell to the Asteroids loop
 * (Final Product Completion, Wave 3 - matrix L13).
 *
 * Inert unless packConfig names the field starter and `sw2d.combat`,
 * `sw2d.weapons` and `sw2d.arcade` are installed. The ship itself is the
 * reusable `sw2d.vehicles` `ship` profile (momentum, rotational inertia,
 * wrap) driven by the shell; this binding owns everything the ship flies
 * through: a rock field that drifts and wraps, projectile-vs-rock collision
 * through the pooled projectile runtime and `combat.health`, rock splitting
 * (large -> 2 medium -> 2 small), `arcade.score` per rock size, ship-vs-rock
 * collision with lives and a respawn grace, successive waves that grow, and
 * the fail / restart surface. Deterministic: rock headings come from a
 * seeded sequence, never Math.random.
 */

export type AsteroidsStarterMode = 'field';

export interface StarterAsteroidsSnapshot {
  readonly active: boolean;
  readonly mode: AsteroidsStarterMode | null;
  readonly wave: number;
  readonly rocks: number;
  readonly rocksBySize: { readonly large: number; readonly medium: number; readonly small: number };
  readonly score: number;
  readonly lives: number;
  readonly destroyed: number;
  readonly splits: number;
  readonly wraps: number;
  readonly projectilesLive: number;
  readonly projectilesSpawned: number;
  readonly invulnerableMsLeft: number;
  readonly lastResult: string | null;
  readonly outcome: 'playing' | 'failed';
}

export interface StarterAsteroidsBinding {
  readonly active: boolean;
  /** Collide the shell's ship sprite with the rocks. */
  attach(ship: Phaser.Physics.Arcade.Sprite): void;
  fire(nowMs: number, dirX: number, dirY: number, origin: { readonly x: number; readonly y: number }): void;
  tick(deltaMs: number, nowMs: number): void;
  snapshot(): StarterAsteroidsSnapshot;
  render(): void;
  dispose(): void;
}

const INERT: StarterAsteroidsBinding = {
  active: false,
  attach: () => undefined,
  fire: () => undefined,
  tick: () => undefined,
  snapshot: () => ({
    active: false,
    mode: null,
    wave: 0,
    rocks: 0,
    rocksBySize: { large: 0, medium: 0, small: 0 },
    score: 0,
    lives: 0,
    destroyed: 0,
    splits: 0,
    wraps: 0,
    projectilesLive: 0,
    projectilesSpawned: 0,
    invulnerableMsLeft: 0,
    lastResult: null,
    outcome: 'playing',
  }),
  render: () => undefined,
  dispose: () => undefined,
};

interface CombatSlice {
  register(id: string, max: number): void;
  has(id: string): boolean;
  get(id: string): { readonly current: number; readonly max: number };
  damage(entityId: string, amount: number, nowMs: number): unknown;
  setInvulnerableFor(entityId: string, durationMs: number, nowMs: number): void;
  remove(id: string): void;
}

interface ArcadeLedger {
  score(): number;
  addScore(delta: number): number;
  lives?(): number;
}

type RockSize = 'large' | 'medium' | 'small';

interface Rock {
  readonly id: string;
  readonly size: RockSize;
  readonly sprite: Phaser.Physics.Arcade.Sprite;
  vx: number;
  vy: number;
  alive: boolean;
}

const SIZES: Record<RockSize, { radius: number; speed: number; score: number; next: RockSize | null }> = {
  large: { radius: 40, speed: 40, score: 20, next: 'medium' },
  medium: { radius: 24, speed: 70, score: 50, next: 'small' },
  small: { radius: 13, speed: 110, score: 100, next: null },
};
const PLAYER_ID = 'ship';
const START_LIVES = 3;
const RESPAWN_GRACE_MS = 2000;
const WRAP_MARGIN = 24;

/** Small deterministic sequence for rock headings (mulberry32). */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function bindStarterAsteroids(
  context: SceneContext,
  options?: { readonly mode?: AsteroidsStarterMode | null; readonly hud?: boolean },
): StarterAsteroidsBinding {
  const mode = options?.mode ?? null;
  if (mode !== 'field') return INERT;
  if (!context.capabilities.has('combat.health') || !context.capabilities.has(WEAPONS_CAPABILITY_ID) || !context.capabilities.has('arcade.score')) return INERT;
  const combat = context.capabilities.require<CombatSlice>('combat.health');
  const weapons = context.capabilities.require<WeaponsService>(WEAPONS_CAPABILITY_ID);
  const arcade = context.capabilities.require<ArcadeLedger>('arcade.score');
  const hud = options?.hud !== false;
  const scene = context.scene;
  const { width, height } = context.definition.viewport;
  const random = rng(20240911);

  const existing = arcade.score();
  if (existing !== 0) arcade.addScore(-existing);
  if (combat.has(PLAYER_ID)) combat.remove(PLAYER_ID);
  combat.register(PLAYER_ID, 1);
  const weaponIds = weapons.definitionIds();
  const playerWeapon = weaponIds.find((id) => weapons.lookup(id)?.team === 'player') ?? weaponIds[0];
  if (playerWeapon) weapons.equip(PLAYER_ID, playerWeapon);

  const rockGroup = scene.add.group();
  const rocks: Rock[] = [];
  const spriteToRock = new Map<Phaser.GameObjects.GameObject, Rock>();
  const rockKey = context.assets.resolve('hazard');
  let nextRockId = 0;
  let ship: Phaser.Physics.Arcade.Sprite | null = null;
  let shipOverlap: Phaser.Physics.Arcade.Collider | null = null;

  let wave = 0;
  let lives = START_LIVES;
  let destroyed = 0;
  let splits = 0;
  let wraps = 0;
  let invulnUntilMs = 0;
  let nowMsLatest = 0;
  let lastResult: string | null = null;
  let outcome: 'playing' | 'failed' = 'playing';
  let disposed = false;

  const projectiles: ProjectileRuntime = createProjectileRuntime({
    scene,
    weapons,
    combat,
    worldWidth: width,
    worldHeight: height,
    resolveTexture: () => context.assets.resolve('pickup'),
    targetGroups: [rockGroup],
    resolveTarget: (obj) => {
      const rock = spriteToRock.get(obj);
      return rock && rock.alive ? { entityId: rock.id, team: 'rock' } : null;
    },
  });

  function spawnRock(size: RockSize, x: number, y: number, headingRad?: number): Rock {
    const def = SIZES[size];
    const id = `rock-${nextRockId++}`;
    const sprite = scene.physics.add.sprite(x, y, rockKey);
    sprite.setDisplaySize(def.radius * 2, def.radius * 2);
    sprite.body.setAllowGravity(false);
    sprite.body.setCircle(sprite.width / 2);
    sprite.setDepth(4);
    const heading = headingRad ?? random() * Math.PI * 2;
    const speed = def.speed * (0.8 + random() * 0.5);
    const rock: Rock = { id, size, sprite, vx: Math.cos(heading) * speed, vy: Math.sin(heading) * speed, alive: true };
    sprite.setVelocity(rock.vx, rock.vy);
    sprite.setAngularVelocity((random() - 0.5) * 80);
    rockGroup.add(sprite);
    spriteToRock.set(sprite, rock);
    combat.register(id, 1);
    rocks.push(rock);
    return rock;
  }

  function spawnWave(): void {
    wave += 1;
    const count = Math.min(8, 3 + wave);
    for (let i = 0; i < count; i++) {
      // Along the edges, never on the ship.
      const edge = i % 4;
      const t = random();
      const x = edge === 0 ? t * width : edge === 1 ? width - 30 : edge === 2 ? t * width : 30;
      const y = edge === 0 ? 30 : edge === 1 ? t * height : edge === 2 ? height - 30 : t * height;
      spawnRock('large', x, y);
    }
    lastResult = `wave ${wave}`;
  }

  function removeRock(rock: Rock): void {
    rock.alive = false;
    spriteToRock.delete(rock.sprite);
    rockGroup.remove(rock.sprite, true, true);
    if (combat.has(rock.id)) combat.remove(rock.id);
    const index = rocks.indexOf(rock);
    if (index >= 0) rocks.splice(index, 1);
  }

  const onDeath = context.events.on('combat:entityDied', ({ entityId }) => {
    if (disposed) return;
    const rock = rocks.find((r) => r.id === entityId && r.alive);
    if (!rock) return;
    const def = SIZES[rock.size];
    const { x, y } = rock.sprite;
    removeRock(rock);
    destroyed += 1;
    arcade.addScore(def.score);
    lastResult = `hit ${rock.size}`;
    if (def.next) {
      splits += 1;
      const base = Math.atan2(rock.vy, rock.vx);
      spawnRock(def.next, x, y, base + 0.7);
      spawnRock(def.next, x, y, base - 0.7);
    }
    context.audio.playCue('ui.confirm');
  });

  const title = hud ? scene.add.text(width * 0.5, 28, '', headingStyle(20)).setOrigin(0.5).setScrollFactor(0).setDepth(50) : null;
  const status = hud ? scene.add.text(width * 0.5, 54, '', mutedStyle(14)).setOrigin(0.5).setScrollFactor(0).setDepth(50) : null;
  const hint = hud ? scene.add.text(width * 0.5, height - 28, '', accentStyle(14)).setOrigin(0.5).setScrollFactor(0).setDepth(50) : null;

  function bySize(): { large: number; medium: number; small: number } {
    const c = { large: 0, medium: 0, small: 0 };
    for (const rock of rocks) if (rock.alive) c[rock.size] += 1;
    return c;
  }

  function snapshot(): StarterAsteroidsSnapshot {
    return {
      active: true,
      mode,
      wave,
      rocks: rocks.filter((r) => r.alive).length,
      rocksBySize: bySize(),
      score: arcade.score(),
      lives,
      destroyed,
      splits,
      wraps,
      projectilesLive: projectiles.liveCount,
      projectilesSpawned: projectiles.spawnedTotal,
      invulnerableMsLeft: Math.max(0, Math.round(invulnUntilMs - nowMsLatest)),
      lastResult,
      outcome,
    };
  }

  function paint(): void {
    if (ship) ship.setAlpha(nowMsLatest < invulnUntilMs ? 0.45 : 1);
    if (!title || !status || !hint) return;
    const snap = snapshot();
    title.setText(snap.outcome === 'failed' ? 'SHIP LOST' : `WAVE ${snap.wave}`);
    status.setText(`score ${snap.score}  ·  lives ${snap.lives}  ·  rocks ${snap.rocks}${snap.lastResult ? `  ·  ${snap.lastResult}` : ''}`);
    hint.setText(snap.outcome === 'playing' ? 'UP THRUSTS   LEFT/RIGHT SPIN   J/X FIRES   THE FIELD WRAPS' : 'P THEN K RESTARTS');
  }

  function shipHit(): void {
    if (outcome !== 'playing' || nowMsLatest < invulnUntilMs || !ship) return;
    lives -= 1;
    lastResult = 'ship hit';
    invulnUntilMs = nowMsLatest + RESPAWN_GRACE_MS;
    context.events.emit('asteroids:shipHit', { lives });
    if (lives <= 0) {
      outcome = 'failed';
      lastResult = 'ship lost';
      for (const rock of rocks) rock.sprite.setVelocity(0, 0);
    }
  }

  spawnWave();
  paint();

  return {
    active: true,
    attach(shipSprite): void {
      if (disposed) return;
      ship = shipSprite;
      shipOverlap = scene.physics.add.overlap(shipSprite, rockGroup, () => shipHit());
    },
    fire(nowMs, dirX, dirY, origin): void {
      if (disposed || outcome !== 'playing' || !playerWeapon) return;
      projectiles.fire({ ownerId: PLAYER_ID, originX: origin.x, originY: origin.y, dirX, dirY, nowMs });
    },
    tick(deltaMs, nowMs): void {
      if (disposed) return;
      nowMsLatest = nowMs;
      projectiles.update(deltaMs, nowMs);
      if (outcome !== 'playing') {
        paint();
        return;
      }
      for (const rock of rocks) {
        if (!rock.alive) continue;
        const s = rock.sprite;
        // Drift is constant; the field wraps around the play area.
        s.setVelocity(rock.vx, rock.vy);
        if (s.x < -WRAP_MARGIN) {
          s.x = width + WRAP_MARGIN;
          wraps += 1;
        } else if (s.x > width + WRAP_MARGIN) {
          s.x = -WRAP_MARGIN;
          wraps += 1;
        }
        if (s.y < -WRAP_MARGIN) {
          s.y = height + WRAP_MARGIN;
          wraps += 1;
        } else if (s.y > height + WRAP_MARGIN) {
          s.y = -WRAP_MARGIN;
          wraps += 1;
        }
      }
      if (rocks.every((r) => !r.alive)) spawnWave();
      paint();
    },
    snapshot,
    render: paint,
    dispose(): void {
      if (disposed) return;
      disposed = true;
      onDeath.dispose();
      projectiles.dispose();
      try {
        shipOverlap?.destroy();
      } catch {
        /* scene already tearing down */
      }
      for (const rock of [...rocks]) {
        if (combat.has(rock.id)) combat.remove(rock.id);
        try {
          rock.sprite.destroy();
        } catch {
          /* scene already tearing down */
        }
      }
      rocks.length = 0;
      spriteToRock.clear();
      if (combat.has(PLAYER_ID)) combat.remove(PLAYER_ID);
      try {
        rockGroup.destroy(false);
        title?.destroy();
        status?.destroy();
        hint?.destroy();
      } catch {
        /* scene already tearing down */
      }
    },
  };
}
