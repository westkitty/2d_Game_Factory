import type { TerritoryService } from '@sw2d/contracts';
import { TERRITORY_CAPABILITY_ID } from '@sw2d/contracts';
import { accentStyle, headingStyle, mutedStyle } from '../scenes/theme.ts';
import type { SceneContext } from '../scenes/SceneContext.ts';

/**
 * Bind the generated top-down shell to one-unit command vs stand-in-zone
 * occupy (Category-C Wave 25).
 *
 * Inert unless packConfig names an rts or zone starter. This file is
 * Capture-zone occupancy is sw2d.territory. RTS FLAG stay; box-select is a
 * one-unit presentation on the spatial pointer. Overlay RTS / territory kits
 * stay local.
 */

export type CommandStarterMode = 'rts' | 'zone';

export interface StarterCommandSnapshot {
  readonly active: boolean;
  readonly mode: CommandStarterMode | null;
  readonly selected: boolean;
  readonly unitX: number;
  readonly unitY: number;
  readonly owned: number;
  readonly lastResult: string | null;
  readonly outcome: 'playing' | 'complete';
}

export interface StarterCommandBinding {
  readonly active: boolean;
  startX(): number;
  startY(): number;
  select(): 'selected' | 'already';
  setMove(ax: number, ay: number): void;
  setPlayer(x: number, y: number): void;
  tick(deltaMs: number): void;
  snapshot(): StarterCommandSnapshot;
  render(): void;
  dispose(): void;
}

const INERT: StarterCommandBinding = {
  active: false,
  startX: () => 0,
  startY: () => 0,
  select: () => 'already',
  setMove: () => undefined,
  setPlayer: () => undefined,
  tick: () => undefined,
  snapshot: () => ({
    active: false,
    mode: null,
    selected: false,
    unitX: 0,
    unitY: 0,
    owned: 0,
    lastResult: null,
    outcome: 'playing',
  }),
  render: () => undefined,
  dispose: () => undefined,
};

const UNIT_START = { x: 200, y: 270 };
const FLAG = { x: 820, y: 270 };
const ZONE_A = { x: 280, y: 270 };
const ZONE_B = { x: 700, y: 270 };
const ZONE_R = 72;
const HOLD_MS = 400;
const UNIT_SPEED = 220;
const UNIT_COLOR = 0x65d0a8;
const FLAG_COLOR = 0xb98af0;
const ZONE_COLOR = 0x4f9ee0;
const CLEAR_COLOR = 0x65d0a8;

function dist(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(ax - bx, ay - by);
}

export function bindStarterCommand(
  context: SceneContext,
  options?: { readonly mode?: CommandStarterMode | null; readonly hud?: boolean },
): StarterCommandBinding {
  const mode = options?.mode ?? null;
  if (mode !== 'rts' && mode !== 'zone') return INERT;

  const hud = options?.hud !== false;
  const scene = context.scene;
  const { width, height } = context.definition.viewport;
  const territory = context.capabilities.get<TerritoryService>(TERRITORY_CAPABILITY_ID);
  const start = mode === 'rts' ? UNIT_START : { x: 120, y: 270 };

  const title = hud ? scene.add.text(width * 0.5, 28, '', headingStyle(20)).setOrigin(0.5).setScrollFactor(0).setDepth(50) : null;
  const status = hud ? scene.add.text(width * 0.5, 54, '', mutedStyle(14)).setOrigin(0.5).setScrollFactor(0).setDepth(50) : null;
  const hint = hud ? scene.add.text(width * 0.5, height - 28, '', accentStyle(14)).setOrigin(0.5).setScrollFactor(0).setDepth(50) : null;
  const unitSprite =
    hud && mode === 'rts'
      ? scene.add.rectangle(UNIT_START.x, UNIT_START.y, 36, 36, UNIT_COLOR, 0.95).setStrokeStyle(2, 0xffffff, 0.9).setDepth(20)
      : null;
  const flagSprite =
    hud && mode === 'rts'
      ? scene.add.rectangle(FLAG.x, FLAG.y, 22, 44, FLAG_COLOR, 0.95).setStrokeStyle(2, 0xffffff, 0.9).setDepth(18)
      : null;
  const zoneASprite =
    hud && mode === 'zone'
      ? scene.add.circle(ZONE_A.x, ZONE_A.y, ZONE_R, ZONE_COLOR, 0.35).setStrokeStyle(2, 0xffffff, 0.8).setDepth(18)
      : null;
  const zoneBSprite =
    hud && mode === 'zone'
      ? scene.add.circle(ZONE_B.x, ZONE_B.y, ZONE_R, ZONE_COLOR, 0.35).setStrokeStyle(2, 0xffffff, 0.8).setDepth(18)
      : null;

  let selected = false;
  let unitX = start.x;
  let unitY = start.y;
  let moveX = 0;
  let moveY = 0;
  let holdA = 0;
  let holdB = 0;
  let ownedA = false;
  let ownedB = false;
  let lastResult: string | null = null;
  let outcome: 'playing' | 'complete' = 'playing';
  let disposed = false;
  let dragStart: { x: number; y: number } | null = null;
  const boxSprite =
    hud && mode === 'rts'
      ? scene.add.rectangle(0, 0, 1, 1, 0xffffff, 0.12).setStrokeStyle(1, 0xffffff, 0.8).setDepth(30).setVisible(false)
      : null;

  function snapshot(): StarterCommandSnapshot {
    return {
      active: true,
      mode,
      selected,
      unitX: Math.round(unitX),
      unitY: Math.round(unitY),
      owned: (ownedA ? 1 : 0) + (ownedB ? 1 : 0),
      lastResult,
      outcome,
    };
  }

  function paint(): void {
    const snap = snapshot();
    unitSprite?.setPosition(unitX, unitY);
    if (flagSprite) flagSprite.setFillStyle(snap.outcome === 'complete' ? CLEAR_COLOR : FLAG_COLOR, 0.95);
    zoneASprite?.setFillStyle(ownedA ? CLEAR_COLOR : ZONE_COLOR, ownedA ? 0.7 : 0.35);
    zoneBSprite?.setFillStyle(ownedB ? CLEAR_COLOR : ZONE_COLOR, ownedB ? 0.7 : 0.35);
    if (!title || !status || !hint) return;
    if (mode === 'rts') {
      title.setText(snap.outcome === 'complete' ? 'SEIZED' : 'RTS');
      status.setText(
        `unit ${snap.unitX},${snap.unitY}  ·  ${snap.selected ? 'selected' : 'idle'}${
          snap.lastResult ? `  ·  ${snap.lastResult}` : ''
        }`,
      );
      hint.setText(snap.outcome === 'playing' ? (snap.selected ? 'WASD MOVES THE UNIT' : 'J SELECTS THE UNIT') : 'SEIZED');
    } else {
      title.setText(snap.outcome === 'complete' ? 'OWNED' : 'ZONES');
      status.setText(`owned ${snap.owned}/2${snap.lastResult ? `  ·  ${snap.lastResult}` : ''}`);
      hint.setText(snap.outcome === 'playing' ? 'STAND IN BOTH ZONES' : 'OWNED');
    }
  }

  function finish(): void {
    if (outcome !== 'playing') return;
    if (mode === 'rts' && selected && dist(unitX, unitY, FLAG.x, FLAG.y) <= 36) {
      outcome = 'complete';
      lastResult = 'seized';
      context.audio.playCue('ui.confirm');
      return;
    }
    if (mode === 'zone' && ownedA && ownedB) {
      outcome = 'complete';
      lastResult = 'owned';
      context.audio.playCue('ui.confirm');
    }
  }

  paint();

  return {
    active: true,
    startX: () => start.x,
    startY: () => start.y,
    select() {
      if (disposed || mode !== 'rts' || outcome !== 'playing') return 'already';
      if (selected) {
        lastResult = 'already';
        paint();
        return 'already';
      }
      selected = true;
      lastResult = 'selected';
      context.audio.playCue('ui.confirm');
      paint();
      return 'selected';
    },
    setMove(ax: number, ay: number): void {
      if (disposed) return;
      moveX = ax;
      moveY = ay;
    },
    setPlayer(x: number, y: number): void {
      if (disposed) return;
      unitX = x;
      unitY = y;
    },
    tick(deltaMs: number): void {
      if (disposed || outcome !== 'playing') return;
      if (mode === 'rts' && selected) {
        const step = UNIT_SPEED * (deltaMs / 1000);
        unitX = Math.max(24, Math.min(width - 24, unitX + moveX * step));
        unitY = Math.max(24, Math.min(height - 24, unitY + moveY * step));
        if (moveX !== 0 || moveY !== 0) lastResult = 'move';
      }
      if (mode === 'rts') {
        const ptr = context.spatialPointer.state;
        if (ptr.justPressed) dragStart = { x: ptr.worldX, y: ptr.worldY };
        if (dragStart && ptr.down) {
          const w = Math.abs(ptr.worldX - dragStart.x);
          const h = Math.abs(ptr.worldY - dragStart.y);
          boxSprite?.setVisible(true).setPosition((dragStart.x + ptr.worldX) / 2, (dragStart.y + ptr.worldY) / 2);
          boxSprite?.setSize(Math.max(1, w), Math.max(1, h));
        }
        if (ptr.justReleased && dragStart) {
          const minX = Math.min(dragStart.x, ptr.worldX);
          const maxX = Math.max(dragStart.x, ptr.worldX);
          const minY = Math.min(dragStart.y, ptr.worldY);
          const maxY = Math.max(dragStart.y, ptr.worldY);
          if (unitX >= minX && unitX <= maxX && unitY >= minY && unitY <= maxY) {
            selected = true;
            lastResult = 'boxed';
            context.audio.playCue('ui.confirm');
          }
          dragStart = null;
          boxSprite?.setVisible(false);
        }
      }
      if (mode === 'zone' && territory?.active()) {
        territory.setOccupant(unitX, unitY);
        territory.tick(deltaMs);
        ownedA = territory.owned().includes('zone-a');
        ownedB = territory.owned().includes('zone-b');
        lastResult = territory.lastResult();
      } else if (mode === 'zone') {
        const inA = dist(unitX, unitY, ZONE_A.x, ZONE_A.y) <= ZONE_R;
        const inB = dist(unitX, unitY, ZONE_B.x, ZONE_B.y) <= ZONE_R;
        if (inA && !ownedA) {
          holdA += deltaMs;
          lastResult = 'holding-a';
          if (holdA >= HOLD_MS) {
            ownedA = true;
            lastResult = 'owned-a';
            context.audio.playCue('ui.confirm');
          }
        } else if (!inA && !ownedA) holdA = 0;
        if (inB && !ownedB) {
          holdB += deltaMs;
          lastResult = 'holding-b';
          if (holdB >= HOLD_MS) {
            ownedB = true;
            lastResult = 'owned-b';
            context.audio.playCue('ui.confirm');
          }
        } else if (!inB && !ownedB) holdB = 0;
      }
      finish();
      paint();
    },
    snapshot,
    render: paint,
    dispose(): void {
      if (disposed) return;
      disposed = true;
      try {
        title?.destroy();
        status?.destroy();
        hint?.destroy();
        unitSprite?.destroy();
        flagSprite?.destroy();
        zoneASprite?.destroy();
        zoneBSprite?.destroy();
      } catch {
        /* scene already tearing down */
      }
    },
  };
}
