import { accentStyle, headingStyle, mutedStyle } from '../scenes/theme.ts';
import type { SceneContext } from '../scenes/SceneContext.ts';

/**
 * Bind generated top-down / pointer shells to museum plaques vs approaching
 * rail targets (Category-C Wave 26).
 *
 * Inert unless packConfig names a museum or rail starter. This file is
 * presentation — not an exhibit/codex framework and not a rail-path camera.
 * Rail damages through existing `combat.health`. Overlay kits stay local.
 */

const COMBAT_CAPABILITY_ID = 'combat.health';

export type LookStarterMode = 'museum' | 'rail';

export interface StarterLookSnapshot {
  readonly active: boolean;
  readonly mode: LookStarterMode | null;
  readonly inspected: number;
  readonly foesAlive: number;
  readonly nearId: string | null;
  readonly lastResult: string | null;
  readonly outcome: 'playing' | 'complete';
}

export interface StarterLookBinding {
  readonly active: boolean;
  startX(): number;
  startY(): number;
  setPlayer(x: number, y: number): void;
  act(): 'inspected' | 'hit' | 'miss' | 'too-far' | 'cooldown';
  tick(deltaMs: number): void;
  snapshot(): StarterLookSnapshot;
  render(): void;
  dispose(): void;
}

const INERT: StarterLookBinding = {
  active: false,
  startX: () => 0,
  startY: () => 0,
  setPlayer: () => undefined,
  act: () => 'miss',
  tick: () => undefined,
  snapshot: () => ({
    active: false,
    mode: null,
    inspected: 0,
    foesAlive: 0,
    nearId: null,
    lastResult: null,
    outcome: 'playing',
  }),
  render: () => undefined,
  dispose: () => undefined,
};

interface CombatSlice {
  register(entityId: string, maxHealth: number): void;
  has(entityId: string): boolean;
  get(entityId: string): { readonly current: number; readonly max: number };
  damage(entityId: string, amount: number, nowMs: number): { readonly current: number };
  remove(entityId: string): void;
}

const MUSEUM_START = { x: 120, y: 270 };
const RAIL_GUN = { x: 200, y: 270 };
const PLAQUES = [
  { id: 'plinth', label: 'PLINTH', x: 280, y: 270 },
  { id: 'bust', label: 'BUST', x: 700, y: 270 },
] as const;
const TARGETS = [
  { id: 'drone', label: 'DRONE', x: 900, y: 180 },
  { id: 'drone-2', label: 'DRONE', x: 1040, y: 360 },
] as const;
const INSPECT_RANGE = 64;
const STRIKE_RANGE = 220;
const STRIKE_COOLDOWN_MS = 180;
const APPROACH = 160;
const PLAQUE_COLOR = 0x4f9ee0;
const FOE_COLOR = 0xe05fa0;
const DEAD_COLOR = 0x384054;
const CLEAR_COLOR = 0x65d0a8;

function dist(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(ax - bx, ay - by);
}

function ensure(combat: CombatSlice, id: string, maxHealth: number): void {
  if (combat.has(id)) combat.remove(id);
  combat.register(id, maxHealth);
}

export function bindStarterLook(
  context: SceneContext,
  options?: { readonly mode?: LookStarterMode | null; readonly hud?: boolean },
): StarterLookBinding {
  const mode = options?.mode ?? null;
  if (mode !== 'museum' && mode !== 'rail') return INERT;
  const combat = mode === 'rail' && context.capabilities.has(COMBAT_CAPABILITY_ID)
    ? context.capabilities.require<CombatSlice>(COMBAT_CAPABILITY_ID)
    : null;
  if (mode === 'rail' && !combat) return INERT;

  const hud = options?.hud !== false;
  const scene = context.scene;
  const { width, height } = context.definition.viewport;
  const start = mode === 'museum' ? MUSEUM_START : RAIL_GUN;

  const seen = new Set<string>();
  const foes = TARGETS.map((t) => ({ ...t }));
  if (combat) {
    for (const foe of foes) ensure(combat, foe.id, 1);
  }

  const title = hud ? scene.add.text(width * 0.5, 28, '', headingStyle(20)).setOrigin(0.5).setScrollFactor(0).setDepth(50) : null;
  const status = hud ? scene.add.text(width * 0.5, 54, '', mutedStyle(14)).setOrigin(0.5).setScrollFactor(0).setDepth(50) : null;
  const hint = hud ? scene.add.text(width * 0.5, height - 28, '', accentStyle(14)).setOrigin(0.5).setScrollFactor(0).setDepth(50) : null;
  const markers: { id: string; sprite: { setPosition(x: number, y: number): unknown; setFillStyle(c: number, a?: number): unknown; destroy(): void } }[] = [];
  if (hud && mode === 'museum') {
    for (const plaque of PLAQUES) {
      markers.push({
        id: plaque.id,
        sprite: scene.add.rectangle(plaque.x, plaque.y, 40, 56, PLAQUE_COLOR, 0.95).setStrokeStyle(2, 0xffffff, 0.9).setDepth(18),
      });
      scene.add.text(plaque.x, plaque.y - 42, plaque.label, mutedStyle(12)).setOrigin(0.5).setDepth(19);
    }
  }
  if (hud && mode === 'rail') {
    scene.add.rectangle(RAIL_GUN.x, RAIL_GUN.y, 28, 44, 0x65d0a8, 0.95).setStrokeStyle(2, 0xffffff, 0.9).setDepth(18);
    for (const foe of foes) {
      markers.push({
        id: foe.id,
        sprite: scene.add.rectangle(foe.x, foe.y, 32, 32, FOE_COLOR, 0.95).setStrokeStyle(2, 0xffffff, 0.9).setDepth(20),
      });
    }
  }

  let playerX = start.x;
  let playerY = start.y;
  let nowMs = 0;
  let lastStrikeAt = -STRIKE_COOLDOWN_MS;
  let lastResult: string | null = null;
  let outcome: 'playing' | 'complete' = 'playing';
  let disposed = false;

  function living() {
    if (!combat) return [];
    return foes.filter((foe) => combat.has(foe.id) && combat.get(foe.id).current > 0);
  }

  function nearId(): string | null {
    if (mode === 'museum') {
      let best: { id: string; d: number } | null = null;
      for (const plaque of PLAQUES) {
        const d = dist(playerX, playerY, plaque.x, plaque.y);
        if (d <= INSPECT_RANGE && (best === null || d < best.d)) best = { id: plaque.id, d };
      }
      return best?.id ?? null;
    }
    let best: { id: string; d: number } | null = null;
    for (const foe of living()) {
      const d = dist(RAIL_GUN.x, RAIL_GUN.y, foe.x, foe.y);
      if (d <= STRIKE_RANGE && (best === null || d < best.d)) best = { id: foe.id, d };
    }
    return best?.id ?? null;
  }

  function snapshot(): StarterLookSnapshot {
    return {
      active: true,
      mode,
      inspected: seen.size,
      foesAlive: living().length,
      nearId: nearId(),
      lastResult,
      outcome,
    };
  }

  function paint(): void {
    const snap = snapshot();
    if (mode === 'museum') {
      for (const entry of markers) {
        entry.sprite.setFillStyle(seen.has(entry.id) ? CLEAR_COLOR : PLAQUE_COLOR, 0.95);
      }
    } else {
      for (const entry of markers) {
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
    }
    if (!title || !status || !hint) return;
    if (mode === 'museum') {
      title.setText(snap.outcome === 'complete' ? 'READ' : 'MUSEUM');
      status.setText(`plaques ${snap.inspected}/2${snap.nearId ? `  ·  near ${snap.nearId}` : ''}${snap.lastResult ? `  ·  ${snap.lastResult}` : ''}`);
      hint.setText(snap.outcome === 'playing' ? 'WALK TO A PLAQUE   J INSPECTS' : 'READ');
    } else {
      title.setText(snap.outcome === 'complete' ? 'CLEARED' : 'RAIL');
      status.setText(`foes ${snap.foesAlive}${snap.nearId ? `  ·  near ${snap.nearId}` : ''}${snap.lastResult ? `  ·  ${snap.lastResult}` : ''}`);
      hint.setText(snap.outcome === 'playing' ? 'J DAMAGES APPROACHING TARGETS' : 'CLEARED');
    }
  }

  function finish(): void {
    if (outcome !== 'playing') return;
    if (mode === 'museum' && seen.size >= PLAQUES.length) {
      outcome = 'complete';
      lastResult = 'read';
      context.audio.playCue('ui.confirm');
      return;
    }
    if (mode === 'rail' && living().length === 0) {
      outcome = 'complete';
      lastResult = 'cleared';
      context.audio.playCue('ui.confirm');
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
    act() {
      if (disposed || outcome !== 'playing') return 'miss';
      if (mode === 'museum') {
        const id = nearId();
        if (id === null) {
          lastResult = 'too-far';
          paint();
          return 'too-far';
        }
        seen.add(id);
        lastResult = `inspected-${id}`;
        finish();
        context.audio.playCue('ui.confirm');
        paint();
        return 'inspected';
      }
      if (!combat) return 'miss';
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
      combat.damage(id, 1, nowMs);
      lastResult = combat.get(id).current > 0 ? 'hit' : `kill-${id}`;
      finish();
      context.audio.playCue('ui.confirm');
      paint();
      return 'hit';
    },
    tick(deltaMs: number): void {
      if (disposed || outcome !== 'playing') return;
      nowMs += deltaMs;
      if (mode === 'rail') {
        const step = APPROACH * (deltaMs / 1000);
        for (const foe of living()) foe.x -= step;
      }
      paint();
    },
    snapshot,
    render: paint,
    dispose(): void {
      if (disposed) return;
      disposed = true;
      if (combat) {
        for (const foe of foes) {
          if (combat.has(foe.id)) combat.remove(foe.id);
        }
      }
      try {
        title?.destroy();
        status?.destroy();
        hint?.destroy();
        for (const entry of markers) entry.sprite.destroy();
      } catch {
        /* scene already tearing down */
      }
    },
  };
}
