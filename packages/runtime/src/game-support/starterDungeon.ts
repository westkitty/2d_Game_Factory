import type Phaser from 'phaser';
import { RUNS_CAPABILITY_ID, type NormalizedLevel, type RunLoadout, type RunSummary, type RunsService } from '@sw2d/contracts';
import { accentStyle, headingStyle, mutedStyle } from '../scenes/theme.ts';
import type { SceneContext } from '../scenes/SceneContext.ts';

/**
 * Bind the generated top-down shell to a room-graph dungeon
 * (Final Product Completion, Wave 2 - matrix L07 / L08).
 *
 * Consumes what the factory already generates and installs: the seeded
 * room-graph `NormalizedLevel` (walls, `PlayerSpawn`, `Enemy` objects per
 * room, the `Exit`), `sw2d.ai` agent states, `sw2d.combat` health, and -
 * for the roguelite - `sw2d.progression` (in-run coin) plus `sw2d.runs`
 * (permadeath, banked meta, between-run loadout).
 *
 * Two bounded modes (not two engines):
 *   - `crawl` (dungeon-crawler): clear every room's enemies, reach the exit.
 *   - `rogue` (action-roguelite): the same dungeon as one *run* - a cleared
 *     room drops coin, the exit clears the run, death ends it; both bank
 *     meta currency through `sw2d.runs`, and K buys the next unlock
 *     between runs.
 *
 * Enemy behaviour is a small deterministic agent state machine on
 * `sw2d.ai`: `idle` at home -> `chase` when the player is inside the aggro
 * radius in the same room -> `patrol` (return home) when the player leaves
 * -> `idle` again. Contact damages the player; J strikes the nearest foe.
 * Rooms are the 320x240 cells the generator lays out; a room is cleared when
 * its last enemy dies. The camera follows the player through the dungeon.
 */

export type DungeonStarterMode = 'crawl' | 'rogue';

export interface StarterDungeonRunSnapshot {
  readonly index: number;
  readonly phase: string;
  readonly cause: string | null;
  readonly metaEarned: number;
  readonly metaCurrency: number;
  readonly unlocked: readonly string[];
  readonly nextUnlock: string | null;
  readonly loadout: RunLoadout;
  readonly loadOutcome: string;
}

export interface StarterDungeonSnapshot {
  readonly active: boolean;
  readonly mode: DungeonStarterMode | null;
  readonly x: number;
  readonly y: number;
  readonly playerHealth: number;
  readonly playerMaxHealth: number;
  readonly enemiesAlive: number;
  readonly enemiesTotal: number;
  readonly room: string;
  readonly roomsVisited: number;
  readonly roomsWithEnemies: number;
  readonly roomsCleared: number;
  readonly states: { readonly idle: number; readonly chase: number; readonly patrol: number };
  readonly nearId: string | null;
  readonly exitOpen: boolean;
  readonly currency: number;
  readonly kills: number;
  readonly worldWidth: number;
  readonly worldHeight: number;
  readonly exitX: number;
  readonly exitY: number;
  /** Live enemies (rounded positions, room, agent state) - HUD/QA evidence, never gameplay logic. */
  readonly enemies: readonly { readonly id: string; readonly x: number; readonly y: number; readonly room: string; readonly state: string }[];
  readonly lastResult: string | null;
  readonly outcome: 'playing' | 'complete' | 'failed';
  readonly run: StarterDungeonRunSnapshot | null;
}

export interface StarterDungeonBinding {
  readonly active: boolean;
  startX(): number;
  startY(): number;
  /** Collide the player and every enemy with the dungeon walls, widen the world, follow with the camera. */
  attach(player: Phaser.Physics.Arcade.Sprite, walls: Phaser.Physics.Arcade.StaticGroup): void;
  setPlayer(x: number, y: number): void;
  strike(): 'hit' | 'miss' | 'cooldown';
  /** Between runs (rogue): buy the next affordable unlock. */
  secondary(): void;
  tick(deltaMs: number): void;
  snapshot(): StarterDungeonSnapshot;
  render(): void;
  dispose(): void;
}

const INERT: StarterDungeonBinding = {
  active: false,
  startX: () => 0,
  startY: () => 0,
  attach: () => undefined,
  setPlayer: () => undefined,
  strike: () => 'miss',
  secondary: () => undefined,
  tick: () => undefined,
  snapshot: () => ({
    active: false,
    mode: null,
    x: 0,
    y: 0,
    playerHealth: 0,
    playerMaxHealth: 0,
    enemiesAlive: 0,
    enemiesTotal: 0,
    room: '',
    roomsVisited: 0,
    roomsWithEnemies: 0,
    roomsCleared: 0,
    states: { idle: 0, chase: 0, patrol: 0 },
    nearId: null,
    exitOpen: false,
    currency: 0,
    kills: 0,
    worldWidth: 0,
    worldHeight: 0,
    exitX: 0,
    exitY: 0,
    enemies: [],
    lastResult: null,
    outcome: 'playing',
    run: null,
  }),
  render: () => undefined,
  dispose: () => undefined,
};

interface CombatSlice {
  register(entityId: string, maxHealth: number): void;
  has(entityId: string): boolean;
  get(entityId: string): { readonly current: number; readonly max: number };
  damage(entityId: string, amount: number, nowMs: number): { readonly current: number };
  setInvulnerableFor(entityId: string, durationMs: number, nowMs: number): void;
  remove(entityId: string): void;
}

interface AiSlice {
  register(agentId: string, initialState?: 'idle' | 'patrol' | 'chase' | 'flee'): void;
  has(agentId: string): boolean;
  state(agentId: string): 'idle' | 'patrol' | 'chase' | 'flee';
  setState(agentId: string, next: 'idle' | 'patrol' | 'chase' | 'flee'): void;
  remove(agentId: string): void;
}

interface ProgressionSlice {
  currency(): number;
  addCurrency(delta: number): number;
  xp(): number;
  addXp(delta: number): number;
}

interface Enemy {
  readonly id: string;
  readonly room: string;
  readonly homeX: number;
  readonly homeY: number;
  sprite: Phaser.Physics.Arcade.Sprite | null;
  x: number;
  y: number;
  stunnedUntilMs: number;
}

const COMBAT_CAPABILITY_ID = 'combat.health';
const AI_CAPABILITY_ID = 'ai.state';
const PROGRESSION_CAPABILITY_ID = 'progression.state';
const ROOM_W = 320;
const ROOM_H = 240;
const PLAYER_ID = 'dungeon-player';
const PLAYER_HP = 5;
const ENEMY_HP = 2;
const ENEMY_SPEED = 70;
const RETURN_SPEED = 55;
const AGGRO_RANGE = 170;
const LEASH_RANGE = 300;
const STRIKE_RANGE = 64;
const STRIKE_COOLDOWN_MS = 220;
const CONTACT_RANGE = 26;
const CONTACT_IFRAMES_MS = 700;
const KNOCKBACK = 26;
const HIT_STUN_MS = 320;

function dist(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(ax - bx, ay - by);
}

function roomOf(x: number, y: number): string {
  return `${Math.floor(x / ROOM_W)},${Math.floor(y / ROOM_H)}`;
}

function ensure(combat: CombatSlice, id: string, maxHealth: number): void {
  if (combat.has(id)) combat.remove(id);
  combat.register(id, maxHealth);
}

export function bindStarterDungeon(
  context: SceneContext,
  level: NormalizedLevel | undefined,
  options?: { readonly mode?: DungeonStarterMode | null; readonly hud?: boolean },
): StarterDungeonBinding {
  const mode = options?.mode ?? null;
  if (mode !== 'crawl' && mode !== 'rogue') return INERT;
  if (!level || !context.capabilities.has(COMBAT_CAPABILITY_ID) || !context.capabilities.has(AI_CAPABILITY_ID)) return INERT;
  const combat = context.capabilities.require<CombatSlice>(COMBAT_CAPABILITY_ID);
  const ai = context.capabilities.require<AiSlice>(AI_CAPABILITY_ID);
  const progression = context.capabilities.get<ProgressionSlice>(PROGRESSION_CAPABILITY_ID) ?? null;
  const runsService = context.capabilities.get<RunsService>(RUNS_CAPABILITY_ID) ?? null;
  const runs = mode === 'rogue' && runsService?.active() ? runsService : null;
  const loadout: RunLoadout = runs?.loadout() ?? { maxHealthBonus: 0, damageBonus: 0, speedBonus: 0, startCurrency: 0, startXp: 0 };

  const hud = options?.hud !== false;
  const scene = context.scene;
  const { width, height } = context.definition.viewport;
  const worldWidth = Math.max(width, level.mapWidth * 32);
  const worldHeight = Math.max(height, level.mapHeight * 32);
  const spawn = level.objects.find((o) => o.class === 'PlayerSpawn');
  const start = { x: spawn?.x ?? width * 0.5, y: spawn?.y ?? height * 0.5 };
  const exit = level.objects.find((o) => o.class === 'Exit') ?? null;
  const exitPos = exit ? { x: exit.x + exit.width / 2, y: exit.y + exit.height / 2 } : null;

  const enemies: Enemy[] = level.objects
    .filter((o) => o.class === 'Enemy')
    .map((o, index) => ({
      id: `dungeon-enemy-${index}`,
      room: roomOf(o.x + o.width / 2, o.y + o.height / 2),
      homeX: o.x + o.width / 2,
      homeY: o.y + o.height / 2,
      sprite: null,
      x: o.x + o.width / 2,
      y: o.y + o.height / 2,
      stunnedUntilMs: 0,
    }));
  const roomsWithEnemies = new Set(enemies.map((e) => e.room));

  const playerMaxHealth = PLAYER_HP + loadout.maxHealthBonus;
  ensure(combat, PLAYER_ID, playerMaxHealth);
  for (const enemy of enemies) {
    ensure(combat, enemy.id, ENEMY_HP);
    if (ai.has(enemy.id)) ai.remove(enemy.id);
    ai.register(enemy.id, 'idle');
  }
  if (progression) {
    const existing = progression.currency();
    if (existing !== loadout.startCurrency) progression.addCurrency(loadout.startCurrency - existing);
  }
  let runIndex = 0;
  let runSummary: RunSummary | null = null;
  if (runs) runIndex = runs.beginRun();

  const title = hud ? scene.add.text(width * 0.5, 28, '', headingStyle(20)).setOrigin(0.5).setScrollFactor(0).setDepth(50) : null;
  const status = hud ? scene.add.text(width * 0.5, 54, '', mutedStyle(14)).setOrigin(0.5).setScrollFactor(0).setDepth(50) : null;
  const hint = hud ? scene.add.text(width * 0.5, height - 28, '', accentStyle(14)).setOrigin(0.5).setScrollFactor(0).setDepth(50) : null;
  const exitSprite = hud && exitPos ? scene.add.image(exitPos.x, exitPos.y, context.assets.resolve('exit')).setDisplaySize(30, 52).setDepth(6).setAlpha(0.35) : null;

  const enemyKey = context.assets.resolve('enemy');
  const enemyGroup = scene.physics.add.group();
  for (const enemy of enemies) {
    const sprite = scene.physics.add.sprite(enemy.homeX, enemy.homeY, enemyKey);
    sprite.body.setAllowGravity(false);
    sprite.setCollideWorldBounds(true);
    sprite.setDepth(5);
    enemyGroup.add(sprite);
    enemy.sprite = sprite;
  }

  let playerX = start.x;
  let playerY = start.y;
  let playerSprite: Phaser.Physics.Arcade.Sprite | null = null;
  let nowMs = 0;
  let lastStrikeAt = -STRIKE_COOLDOWN_MS;
  let lastResult: string | null = null;
  let outcome: 'playing' | 'complete' | 'failed' = 'playing';
  let currentRoom = roomOf(start.x, start.y);
  const visited = new Set<string>([currentRoom]);
  const cleared = new Set<string>();
  let kills = 0;
  let elapsedMs = 0;
  let disposed = false;
  const colliders: Phaser.Physics.Arcade.Collider[] = [];

  function alive(enemy: Enemy): boolean {
    return combat.has(enemy.id) && combat.get(enemy.id).current > 0;
  }

  function living(): Enemy[] {
    return enemies.filter(alive);
  }

  function nearId(): string | null {
    let best: { id: string; d: number } | null = null;
    for (const enemy of living()) {
      const d = dist(playerX, playerY, enemy.x, enemy.y);
      if (d <= STRIKE_RANGE && (best === null || d < best.d)) best = { id: enemy.id, d };
    }
    return best?.id ?? null;
  }

  function exitOpen(): boolean {
    return living().length === 0;
  }

  function counts(): { idle: number; chase: number; patrol: number } {
    const c = { idle: 0, chase: 0, patrol: 0 };
    for (const enemy of living()) {
      const state = ai.state(enemy.id);
      if (state === 'chase') c.chase += 1;
      else if (state === 'patrol') c.patrol += 1;
      else c.idle += 1;
    }
    return c;
  }

  function runSnapshot(): StarterDungeonRunSnapshot | null {
    if (!runs) return null;
    const meta = runs.meta();
    return {
      index: runIndex,
      phase: runs.phase(),
      cause: runSummary?.cause ?? null,
      metaEarned: runSummary?.metaEarned ?? 0,
      metaCurrency: meta.metaCurrency,
      unlocked: meta.unlocked,
      nextUnlock: runs.nextAffordable()?.id ?? null,
      loadout,
      loadOutcome: runs.loadOutcome(),
    };
  }

  function snapshot(): StarterDungeonSnapshot {
    return {
      active: true,
      mode,
      x: Math.round(playerX),
      y: Math.round(playerY),
      playerHealth: combat.has(PLAYER_ID) ? combat.get(PLAYER_ID).current : 0,
      playerMaxHealth,
      enemiesAlive: living().length,
      enemiesTotal: enemies.length,
      room: currentRoom,
      roomsVisited: visited.size,
      roomsWithEnemies: roomsWithEnemies.size,
      roomsCleared: cleared.size,
      states: counts(),
      nearId: nearId(),
      exitOpen: exitOpen(),
      currency: progression?.currency() ?? 0,
      kills,
      worldWidth,
      worldHeight,
      exitX: Math.round(exitPos?.x ?? 0),
      exitY: Math.round(exitPos?.y ?? 0),
      enemies: living().map((e) => ({ id: e.id, x: Math.round(e.x), y: Math.round(e.y), room: e.room, state: ai.state(e.id) })),
      lastResult,
      outcome,
      run: runSnapshot(),
    };
  }

  function paint(): void {
    const snap = snapshot();
    for (const enemy of enemies) {
      if (!enemy.sprite) continue;
      const isAlive = alive(enemy);
      enemy.sprite.setVisible(isAlive);
      if (isAlive) {
        const state = ai.state(enemy.id);
        enemy.sprite.setTint(state === 'chase' ? 0xff6b6b : state === 'patrol' ? 0xffd166 : 0xffffff);
      }
    }
    exitSprite?.setAlpha(snap.exitOpen ? 1 : 0.35);
    if (!title || !status || !hint) return;
    const label = mode === 'crawl' ? 'DUNGEON' : `RUN ${snap.run?.index ?? 1}`;
    title.setText(snap.outcome === 'complete' ? (mode === 'crawl' ? 'DUNGEON CLEARED' : 'RUN CLEARED') : snap.outcome === 'failed' ? (mode === 'crawl' ? 'DOWN' : 'RUN OVER') : label);
    const meta = snap.run ? `  ·  meta ${snap.run.metaCurrency}${snap.run.unlocked.length ? ` [${snap.run.unlocked.join(' ')}]` : ''}` : '';
    status.setText(
      `hp ${snap.playerHealth}/${snap.playerMaxHealth}  ·  foes ${snap.enemiesAlive}/${snap.enemiesTotal}  ·  rooms ${snap.roomsCleared}/${snap.roomsWithEnemies}${
        mode === 'rogue' ? `  ·  coin ${snap.currency}` : ''
      }${meta}${snap.lastResult ? `  ·  ${snap.lastResult}` : ''}`,
    );
    if (snap.outcome === 'playing') {
      hint.setText(snap.exitOpen ? 'EVERY ROOM CLEARED   REACH THE EXIT' : 'EXPLORE THE ROOMS   J STRIKES   CLEAR EVERY FOE');
    } else if (snap.run) {
      const next = runs?.nextAffordable();
      hint.setText(
        `BANKED +${snap.run.metaEarned}${next ? `   K BUYS ${next.label.toUpperCase()} (${next.cost})` : '   NO UNLOCK AFFORDABLE'}   P THEN K RESTARTS THE RUN`,
      );
    } else {
      hint.setText(snap.outcome === 'complete' ? 'DUNGEON CLEARED   P THEN K RESTARTS' : 'DOWN   P THEN K RESTARTS');
    }
  }

  function endRun(cause: 'death' | 'cleared'): void {
    if (!runs || runSummary) return;
    runSummary = runs.endRun({
      cause,
      xp: progression?.xp() ?? 0,
      kills,
      wave: cleared.size,
      currency: progression?.currency() ?? 0,
      durationMs: Math.round(elapsedMs),
    });
  }

  function finish(): void {
    if (outcome !== 'playing') return;
    if (combat.has(PLAYER_ID) && combat.get(PLAYER_ID).current <= 0) {
      outcome = 'failed';
      lastResult = 'down';
      endRun('death');
      for (const enemy of enemies) enemy.sprite?.setVelocity(0, 0);
      return;
    }
    if (exitPos && exitOpen() && dist(playerX, playerY, exitPos.x, exitPos.y) <= 36) {
      outcome = 'complete';
      lastResult = 'escaped';
      context.audio.playCue('ui.confirm');
      endRun('cleared');
    }
  }

  function moveEnemy(enemy: Enemy, targetX: number, targetY: number, speed: number, stopAt: number): void {
    const sprite = enemy.sprite;
    if (!sprite) return;
    const dx = targetX - sprite.x;
    const dy = targetY - sprite.y;
    const d = Math.hypot(dx, dy);
    if (d <= stopAt) {
      sprite.setVelocity(0, 0);
      return;
    }
    sprite.setVelocity((dx / d) * speed, (dy / d) * speed);
  }

  paint();

  return {
    active: true,
    startX: () => start.x,
    startY: () => start.y,
    attach(player, walls): void {
      if (disposed) return;
      playerSprite = player;
      scene.physics.world.setBounds(0, 0, worldWidth, worldHeight);
      scene.cameras.main.setBounds(0, 0, worldWidth, worldHeight);
      scene.cameras.main.startFollow(player, true, 0.15, 0.15);
      colliders.push(scene.physics.add.collider(enemyGroup, walls));
      colliders.push(scene.physics.add.collider(enemyGroup, enemyGroup));
    },
    setPlayer(x, y): void {
      if (disposed) return;
      playerX = x;
      playerY = y;
      const room = roomOf(x, y);
      if (room !== currentRoom) {
        currentRoom = room;
        visited.add(room);
        lastResult = `entered ${room}`;
      }
    },
    strike() {
      if (disposed || outcome !== 'playing') return 'miss';
      if (nowMs - lastStrikeAt < STRIKE_COOLDOWN_MS) {
        lastResult = 'cooldown';
        return 'cooldown';
      }
      lastStrikeAt = nowMs;
      const id = nearId();
      const enemy = id ? enemies.find((e) => e.id === id) : null;
      if (!enemy) {
        lastResult = 'miss';
        paint();
        return 'miss';
      }
      combat.damage(enemy.id, 1 + loadout.damageBonus, nowMs);
      enemy.stunnedUntilMs = nowMs + HIT_STUN_MS;
      if (enemy.sprite) {
        const dx = enemy.sprite.x - playerX;
        const dy = enemy.sprite.y - playerY;
        const d = Math.hypot(dx, dy) || 1;
        enemy.sprite.setPosition(enemy.sprite.x + (dx / d) * KNOCKBACK, enemy.sprite.y + (dy / d) * KNOCKBACK);
      }
      if (alive(enemy)) {
        lastResult = 'hit';
      } else {
        kills += 1;
        lastResult = `kill ${enemy.id}`;
        progression?.addXp(1);
        if (!living().some((e) => e.room === enemy.room)) {
          cleared.add(enemy.room);
          lastResult = `cleared ${enemy.room}`;
          if (mode === 'rogue') progression?.addCurrency(1);
        }
      }
      context.audio.playCue('ui.confirm');
      finish();
      paint();
      return 'hit';
    },
    secondary(): void {
      if (disposed || !runs) return;
      if (outcome === 'playing') return;
      const next = runs.nextAffordable();
      if (!next) {
        lastResult = 'no-unlock';
        paint();
        return;
      }
      const result = runs.buy(next.id);
      lastResult = result === 'bought' ? `bought ${next.id}` : result;
      if (result === 'bought') context.audio.playCue('ui.confirm');
      paint();
    },
    tick(deltaMs): void {
      if (disposed || outcome !== 'playing') return;
      nowMs += deltaMs;
      elapsedMs += deltaMs;
      for (const enemy of enemies) {
        if (!enemy.sprite) continue;
        if (!alive(enemy)) {
          enemy.sprite.setVelocity(0, 0);
          continue;
        }
        enemy.x = enemy.sprite.x;
        enemy.y = enemy.sprite.y;
        const d = dist(playerX, playerY, enemy.x, enemy.y);
        const sameRoom = roomOf(playerX, playerY) === enemy.room;
        const state = ai.state(enemy.id);
        if (nowMs < enemy.stunnedUntilMs) {
          enemy.sprite.setVelocity(0, 0);
          continue;
        }
        if (state === 'chase') {
          if (d > LEASH_RANGE || !sameRoom) {
            ai.setState(enemy.id, 'patrol');
            lastResult = `${enemy.id} returns`;
          } else {
            moveEnemy(enemy, playerX, playerY, ENEMY_SPEED, CONTACT_RANGE * 0.8);
            if (d <= CONTACT_RANGE) {
              const before = combat.get(PLAYER_ID).current;
              combat.damage(PLAYER_ID, 1, nowMs);
              if (combat.get(PLAYER_ID).current < before) {
                combat.setInvulnerableFor(PLAYER_ID, CONTACT_IFRAMES_MS, nowMs);
                lastResult = 'contact';
              }
            }
          }
        } else if (sameRoom && d <= AGGRO_RANGE) {
          ai.setState(enemy.id, 'chase');
          lastResult = `${enemy.id} chases`;
        } else if (state === 'patrol') {
          const home = dist(enemy.x, enemy.y, enemy.homeX, enemy.homeY);
          if (home <= 6) {
            ai.setState(enemy.id, 'idle');
            enemy.sprite.setVelocity(0, 0);
          } else {
            moveEnemy(enemy, enemy.homeX, enemy.homeY, RETURN_SPEED, 4);
          }
        } else {
          enemy.sprite.setVelocity(0, 0);
        }
      }
      finish();
      paint();
    },
    snapshot,
    render: paint,
    dispose(): void {
      if (disposed) return;
      disposed = true;
      for (const collider of colliders) {
        try {
          collider.destroy();
        } catch {
          /* scene already tearing down */
        }
      }
      for (const enemy of enemies) {
        if (combat.has(enemy.id)) combat.remove(enemy.id);
        if (ai.has(enemy.id)) ai.remove(enemy.id);
        try {
          enemy.sprite?.destroy();
        } catch {
          /* scene already tearing down */
        }
      }
      if (combat.has(PLAYER_ID)) combat.remove(PLAYER_ID);
      try {
        enemyGroup.destroy(false);
        title?.destroy();
        status?.destroy();
        hint?.destroy();
        exitSprite?.destroy();
        if (playerSprite) scene.cameras.main.stopFollow();
      } catch {
        /* scene already tearing down */
      }
    },
  };
}
