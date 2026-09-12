import { ENCOUNTERS_CAPABILITY_ID, type EncounterService, type TargetingService, TARGETING_CAPABILITY_ID } from '@sw2d/contracts';
import { accentStyle, headingStyle, mutedStyle } from '../scenes/theme.ts';
import type { SceneContext } from '../scenes/SceneContext.ts';

/**
 * Bind the generated top-down shell to `sw2d.combat` (Category-C Wave 21).
 *
 * Inert unless the generated packConfig names a room or hold starter and
 * `combat.health` is installed. The pack stays entity-keyed health/damage —
 * this file is presentation, not a targeting, AI, or encounter pack.
 * Overlay dungeon / base-defense kits stay local.
 */

const COMBAT_CAPABILITY_ID = 'combat.health';

export type CombatStarterMode = 'room' | 'hold';

export interface StarterCombatSnapshot {
  readonly active: boolean;
  readonly mode: CombatStarterMode | null;
  readonly playerHealth: number;
  readonly baseHealth: number;
  readonly foesAlive: number;
  readonly nearId: string | null;
  readonly lastResult: string | null;
  readonly outcome: 'playing' | 'complete' | 'failed';
  readonly priority: string;
  readonly damage: number;
  readonly gold: number;
  readonly wave: number;
}

export interface StarterCombatBinding {
  readonly active: boolean;
  startX(): number;
  startY(): number;
  setPlayer(x: number, y: number): void;
  strike(): 'hit' | 'miss' | 'cooldown';
  upgrade(): boolean;
  cyclePriority(): void;
  tick(deltaMs: number): void;
  snapshot(): StarterCombatSnapshot;
  render(): void;
  dispose(): void;
}

const INERT: StarterCombatBinding = {
  active: false,
  startX: () => 0,
  startY: () => 0,
  setPlayer: () => undefined,
  strike: () => 'miss',
  upgrade: () => false,
  cyclePriority: () => undefined,
  tick: () => undefined,
  snapshot: () => ({
    active: false,
    mode: null,
    playerHealth: 0,
    baseHealth: 0,
    foesAlive: 0,
    nearId: null,
    lastResult: null,
    outcome: 'playing',
    priority: 'nearest',
    damage: 0,
    gold: 0,
    wave: 0,
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

interface Foe {
  readonly id: string;
  readonly label: string;
  x: number;
  y: number;
}

const PLAYER_ID = 'starter-player';
const BASE_ID = 'starter-base';
const PLAYER_HP = 5;
const FOE_HP = 2;
const BASE_HP = 3;
const STRIKE_RANGE = 110;
const STRIKE_COOLDOWN_MS = 180;
const CONTACT_RANGE = 28;
const CONTACT_IFRAMES_MS = 600;
const MARCH_SPEED = 36;
const ROOM_START = { x: 140, y: 270 };
const HOLD_START = { x: 480, y: 270 };
const BASE_POS = { x: 820, y: 270 };
const ROOM_FOES: readonly { id: string; label: string; x: number; y: number }[] = [
  { id: 'grunt', label: 'GRUNT', x: 400, y: 270 },
  { id: 'brute', label: 'BRUTE', x: 680, y: 270 },
];
const HOLD_FOES: readonly { id: string; label: string; x: number; y: number }[] = [
  { id: 'raider', label: 'RAIDER', x: 160, y: 180 },
  { id: 'raider-2', label: 'RAIDER', x: 160, y: 360 },
];
const FOE_COLOR = 0xe05fa0;
const DEAD_COLOR = 0x384054;
const BASE_COLOR = 0x4f9ee0;
const CLEAR_COLOR = 0x65d0a8;
const FAIL_COLOR = 0xe0574f;

function dist(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(ax - bx, ay - by);
}

function ensure(combat: CombatSlice, id: string, maxHealth: number): void {
  if (combat.has(id)) combat.remove(id);
  combat.register(id, maxHealth);
}

export function bindStarterCombat(
  context: SceneContext,
  options?: { readonly mode?: CombatStarterMode | null; readonly hud?: boolean },
): StarterCombatBinding {
  const mode = options?.mode ?? null;
  if (mode !== 'room' && mode !== 'hold') return INERT;
  if (!context.capabilities.has(COMBAT_CAPABILITY_ID)) return INERT;
  const combat = context.capabilities.require<CombatSlice>(COMBAT_CAPABILITY_ID);
  const encounters = context.capabilities.get<EncounterService>(ENCOUNTERS_CAPABILITY_ID);
  const targeting = context.capabilities.get<TargetingService>(TARGETING_CAPABILITY_ID);

  const hud = options?.hud !== false;
  const scene = context.scene;
  const { width, height } = context.definition.viewport;
  const start = mode === 'room' ? ROOM_START : HOLD_START;
  const seed = mode === 'room' ? ROOM_FOES : HOLD_FOES;
  const foes: Foe[] = seed.map((foe) => ({ ...foe }));
  const ids = [PLAYER_ID, ...foes.map((foe) => foe.id), ...(mode === 'hold' ? [BASE_ID] : [])];

  ensure(combat, PLAYER_ID, PLAYER_HP);
  for (const foe of foes) ensure(combat, foe.id, FOE_HP);
  if (mode === 'hold') ensure(combat, BASE_ID, BASE_HP);

  const title = hud ? scene.add.text(width * 0.5, 28, '', headingStyle(20)).setOrigin(0.5).setScrollFactor(0).setDepth(50) : null;
  const status = hud ? scene.add.text(width * 0.5, 54, '', mutedStyle(14)).setOrigin(0.5).setScrollFactor(0).setDepth(50) : null;
  const hint = hud ? scene.add.text(width * 0.5, height - 28, '', accentStyle(14)).setOrigin(0.5).setScrollFactor(0).setDepth(50) : null;

  const foeSprites: { id: string; sprite: { setPosition(x: number, y: number): unknown; setFillStyle(color: number, alpha?: number): unknown; destroy(): void } }[] = [];
  const foeLabels: { destroy(): void }[] = [];
  if (hud) {
    for (const foe of foes) {
      const sprite = scene.add.rectangle(foe.x, foe.y, 36, 36, FOE_COLOR, 0.95).setStrokeStyle(2, 0xffffff, 0.9).setDepth(20);
      foeSprites.push({ id: foe.id, sprite });
      foeLabels.push(scene.add.text(foe.x, foe.y - 32, foe.label, mutedStyle(12)).setOrigin(0.5).setDepth(21));
    }
  }
  const baseSprite =
    hud && mode === 'hold'
      ? scene.add.rectangle(BASE_POS.x, BASE_POS.y, 56, 56, BASE_COLOR, 0.95).setStrokeStyle(2, 0xffffff, 0.9).setDepth(18)
      : null;
  const baseLabel =
    hud && mode === 'hold' ? scene.add.text(BASE_POS.x, BASE_POS.y - 42, 'BASE', mutedStyle(12)).setOrigin(0.5).setDepth(19) : null;

  let playerX = start.x;
  let playerY = start.y;
  let nowMs = 0;
  let lastStrikeAt = -STRIKE_COOLDOWN_MS;
  let lastResult: string | null = null;
  let outcome: 'playing' | 'complete' | 'failed' = 'playing';
  let disposed = false;
  let gold = 40;
  let strikeDamage = 1;
  let priority: 'nearest' | 'lowest' = 'nearest';
  let waveStarted = false;

  function living(): Foe[] {
    return foes.filter((foe) => combat.has(foe.id) && combat.get(foe.id).current > 0);
  }

  function nearId(): string | null {
    let best: { id: string; d: number; hp: number } | null = null;
    for (const foe of living()) {
      const d = dist(playerX, playerY, foe.x, foe.y);
      if (d > STRIKE_RANGE) continue;
      const hp = combat.get(foe.id).current;
      if (
        best === null ||
        (priority === 'lowest' ? hp < best.hp || (hp === best.hp && d < best.d) : d < best.d)
      ) {
        best = { id: foe.id, d, hp };
      }
    }
    return best?.id ?? null;
  }

  function snapshot(): StarterCombatSnapshot {
    return {
      active: true,
      mode,
      playerHealth: combat.has(PLAYER_ID) ? combat.get(PLAYER_ID).current : 0,
      baseHealth: mode === 'hold' && combat.has(BASE_ID) ? combat.get(BASE_ID).current : 0,
      foesAlive: living().length,
      nearId: nearId(),
      lastResult,
      outcome,
      priority,
      damage: strikeDamage,
      gold,
      wave: encounters?.state().phaseIndex ?? 0,
    };
  }

  function paint(): void {
    const snap = snapshot();
    for (const entry of foeSprites) {
      const live = living().find((foe) => foe.id === entry.id);
      if (live) {
        entry.sprite.setPosition(live.x, live.y);
        entry.sprite.setFillStyle(FOE_COLOR, 0.95);
      } else {
        const dead = foes.find((foe) => foe.id === entry.id);
        if (dead) entry.sprite.setPosition(dead.x, dead.y);
        entry.sprite.setFillStyle(DEAD_COLOR, 0.45);
      }
    }
    if (baseSprite) {
      const color = snap.outcome === 'failed' ? FAIL_COLOR : snap.outcome === 'complete' ? CLEAR_COLOR : BASE_COLOR;
      baseSprite.setFillStyle(color, 0.95);
    }
    if (!title || !status || !hint) return;
    if (mode === 'room') {
      title.setText(snap.outcome === 'complete' ? 'CLEARED' : snap.outcome === 'failed' ? 'DOWN' : 'ROOM');
      status.setText(
        `hp ${snap.playerHealth}  ·  foes ${snap.foesAlive}${snap.nearId ? `  ·  near ${snap.nearId}` : ''}${
          snap.lastResult ? `  ·  ${snap.lastResult}` : ''
        }${snap.outcome !== 'playing' ? `  ·  ${snap.outcome}` : ''}`,
      );
      hint.setText(snap.outcome === 'playing' ? 'WALK TO A FOE   J STRIKES' : snap.outcome === 'complete' ? 'CLEARED' : 'DOWN');
    } else {
      title.setText(snap.outcome === 'complete' ? 'HELD' : snap.outcome === 'failed' ? 'BREACHED' : 'HOLD');
      status.setText(
        `base ${snap.baseHealth}  ·  foes ${snap.foesAlive}  ·  dmg ${snap.damage}  ·  ${snap.priority}${
          snap.nearId ? `  ·  near ${snap.nearId}` : ''
        }${snap.lastResult ? `  ·  ${snap.lastResult}` : ''}${snap.outcome !== 'playing' ? `  ·  ${snap.outcome}` : ''}`,
      );
      hint.setText(
        snap.outcome === 'playing' ? 'J STRIKES  ·  K UPGRADES  ·  L CYCLES PRIORITY' : snap.outcome === 'complete' ? 'HELD' : 'BREACHED',
      );
    }
  }

  function finish(): void {
    if (outcome !== 'playing') return;
    if (living().length === 0) {
      if (mode === 'hold' && encounters && !waveStarted) {
        const id = encounters.definitionIds()[0];
        if (id) encounters.start(id);
        waveStarted = true;
        lastResult = 'wave-2';
        return;
      }
      if (mode === 'hold' && encounters && !encounters.state().completed) return;
      outcome = 'complete';
      lastResult = 'cleared';
      context.audio.playCue('ui.confirm');
      return;
    }
    if (mode === 'room' && combat.get(PLAYER_ID).current <= 0) {
      outcome = 'failed';
      lastResult = 'down';
      return;
    }
    if (mode === 'hold' && combat.get(BASE_ID).current <= 0) {
      outcome = 'failed';
      lastResult = 'breached';
    }
  }

  paint();

  return {
    active: true,
    startX: () => start.x,
    startY: () => start.y,
    setPlayer(x: number, y: number): void {
      if (disposed) return;
      playerX = x;
      playerY = y;
    },
    strike() {
      if (disposed || outcome !== 'playing') return 'miss';
      if (nowMs - lastStrikeAt < STRIKE_COOLDOWN_MS) {
        lastResult = 'cooldown';
        paint();
        return 'cooldown';
      }
      lastStrikeAt = nowMs;
      const id = nearId();
      if (id === null) {
        lastResult = 'miss';
        paint();
        return 'miss';
      }
      combat.damage(id, strikeDamage, nowMs);
      lastResult = combat.get(id).current > 0 ? 'hit' : `kill-${id}`;
      finish();
      context.audio.playCue('ui.confirm');
      paint();
      return 'hit';
    },
    upgrade(): boolean {
      if (disposed || outcome !== 'playing' || gold < 20) {
        lastResult = 'upgrade-rejected';
        paint();
        return false;
      }
      gold -= 20;
      strikeDamage += 1;
      targeting?.upgrade(targeting.lineup()[0] ?? 'tower');
      lastResult = 'upgraded';
      context.audio.playCue('ui.confirm');
      paint();
      return true;
    },
    cyclePriority(): void {
      if (disposed || outcome !== 'playing') return;
      priority = priority === 'nearest' ? 'lowest' : 'nearest';
      lastResult = `priority-${priority}`;
      paint();
    },
    tick(deltaMs: number): void {
      if (disposed || outcome !== 'playing') return;
      nowMs += deltaMs;
      if (mode === 'hold' && encounters && waveStarted) {
        const tick = encounters.update(deltaMs, {
          aimAt: () => [1, 0],
          healthFraction: (id) => (combat.has(id) ? combat.get(id).current / combat.get(id).max : 0),
          flag: () => false,
          originOf: (id) => {
            const live = foes.find((foe) => foe.id === id);
            return live ? [live.x, live.y] : null;
          },
          bossOrigin: () => [BASE_POS.x, BASE_POS.y],
          viewport: () => context.definition.viewport,
        });
        for (const spawn of tick.spawns) {
          foes.push({ id: spawn.requestId, label: 'RAIDER', x: spawn.x, y: spawn.y });
          ensure(combat, spawn.requestId, spawn.health);
          ids.push(spawn.requestId);
          if (hud) {
            const sprite = scene.add.rectangle(spawn.x, spawn.y, 36, 36, FOE_COLOR, 0.95).setStrokeStyle(2, 0xffffff, 0.9).setDepth(20);
            foeSprites.push({ id: spawn.requestId, sprite });
          }
        }
        for (const foe of foes) {
          if (combat.has(foe.id) && combat.get(foe.id).current <= 0) encounters.reportDeath(foe.id);
        }
      }
      if (mode === 'hold') {
        const step = MARCH_SPEED * (deltaMs / 1000);
        for (const foe of living()) {
          const dx = BASE_POS.x - foe.x;
          const dy = BASE_POS.y - foe.y;
          const d = Math.hypot(dx, dy);
          if (d <= CONTACT_RANGE) {
            combat.damage(BASE_ID, 1, nowMs);
            combat.setInvulnerableFor(BASE_ID, CONTACT_IFRAMES_MS, nowMs);
            lastResult = 'base-hit';
            finish();
            continue;
          }
          if (d > 0) {
            foe.x += (dx / d) * step;
            foe.y += (dy / d) * step;
          }
        }
      } else {
        for (const foe of living()) {
          if (dist(playerX, playerY, foe.x, foe.y) <= CONTACT_RANGE) {
            combat.damage(PLAYER_ID, 1, nowMs);
            combat.setInvulnerableFor(PLAYER_ID, CONTACT_IFRAMES_MS, nowMs);
            lastResult = 'contact';
            finish();
          }
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
      for (const id of ids) {
        if (combat.has(id)) combat.remove(id);
      }
      try {
        title?.destroy();
        status?.destroy();
        hint?.destroy();
        baseSprite?.destroy();
        baseLabel?.destroy();
        for (const entry of foeSprites) entry.sprite.destroy();
        for (const label of foeLabels) label.destroy();
      } catch {
        /* scene already tearing down */
      }
    },
  };
}
