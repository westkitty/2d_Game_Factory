import type { TerritoryService } from '@sw2d/contracts';
import { TERRITORY_CAPABILITY_ID } from '@sw2d/contracts';
import { accentStyle, headingStyle, mutedStyle } from '../scenes/theme.ts';
import type { SceneContext } from '../scenes/SceneContext.ts';

/**
 * Bind the generated top-down shell to two-unit command vs stand-in-zone
 * occupy (Category-C Wave 25 + Wave 31 box-select).
 *
 * Inert unless packConfig names an rts or zone starter. Capture-zone occupancy
 * is sw2d.territory. RTS FLAG stay; box-select is a two-unit presentation on
 * the spatial pointer. Overlay RTS / territory kits stay local.
 */

export type CommandStarterMode = 'rts' | 'zone';

export interface StarterCommandSnapshot {
  readonly active: boolean;
  readonly mode: CommandStarterMode | null;
  readonly selected: boolean;
  readonly selectedCount: number;
  readonly unitX: number;
  readonly unitY: number;
  readonly unit2X: number;
  readonly unit2Y: number;
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
    selectedCount: 0,
    unitX: 0,
    unitY: 0,
    unit2X: 0,
    unit2Y: 0,
    owned: 0,
    lastResult: null,
    outcome: 'playing',
  }),
  render: () => undefined,
  dispose: () => undefined,
};

const UNIT_A = { x: 200, y: 270 };
const UNIT_B = { x: 200, y: 400 };
const FLAG = { x: 820, y: 270 };
const ZONE_A = { x: 280, y: 270 };
const ZONE_B = { x: 700, y: 270 };
const ZONE_R = 72;
const HOLD_MS = 400;
const UNIT_SPEED = 220;
const UNIT_COLOR = 0x65d0a8;
const UNIT_B_COLOR = 0x4f9ee0;
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
  const start = mode === 'rts' ? UNIT_A : { x: 120, y: 270 };

  const title = hud ? scene.add.text(width * 0.5, 28, '', headingStyle(20)).setOrigin(0.5).setScrollFactor(0).setDepth(50) : null;
  const status = hud ? scene.add.text(width * 0.5, 54, '', mutedStyle(14)).setOrigin(0.5).setScrollFactor(0).setDepth(50) : null;
  const hint = hud ? scene.add.text(width * 0.5, height - 28, '', accentStyle(14)).setOrigin(0.5).setScrollFactor(0).setDepth(50) : null;
  const unitASprite =
    hud && mode === 'rts'
      ? scene.add.rectangle(UNIT_A.x, UNIT_A.y, 36, 36, UNIT_COLOR, 0.95).setStrokeStyle(2, 0xffffff, 0.9).setDepth(20)
      : null;
  const unitBSprite =
    hud && mode === 'rts'
      ? scene.add.rectangle(UNIT_B.x, UNIT_B.y, 36, 36, UNIT_B_COLOR, 0.95).setStrokeStyle(2, 0xffffff, 0.9).setDepth(20)
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

  const units = [
    { x: start.x, y: start.y, selected: false },
    { x: UNIT_B.x, y: UNIT_B.y, selected: false },
  ];
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
    const selectedCount = units.filter((unit) => unit.selected).length;
    return {
      active: true,
      mode,
      selected: units[0]!.selected,
      selectedCount,
      unitX: Math.round(units[0]!.x),
      unitY: Math.round(units[0]!.y),
      unit2X: Math.round(units[1]!.x),
      unit2Y: Math.round(units[1]!.y),
      owned: (ownedA ? 1 : 0) + (ownedB ? 1 : 0),
      lastResult,
      outcome,
    };
  }

  function paint(): void {
    const snap = snapshot();
    unitASprite?.setPosition(units[0]!.x, units[0]!.y);
    unitASprite?.setStrokeStyle(units[0]!.selected ? 4 : 2, 0xffffff, 0.95);
    unitBSprite?.setPosition(units[1]!.x, units[1]!.y);
    unitBSprite?.setStrokeStyle(units[1]!.selected ? 4 : 2, 0xffffff, 0.95);
    if (flagSprite) flagSprite.setFillStyle(snap.outcome === 'complete' ? CLEAR_COLOR : FLAG_COLOR, 0.95);
    zoneASprite?.setFillStyle(ownedA ? CLEAR_COLOR : ZONE_COLOR, ownedA ? 0.7 : 0.35);
    zoneBSprite?.setFillStyle(ownedB ? CLEAR_COLOR : ZONE_COLOR, ownedB ? 0.7 : 0.35);
    if (!title || !status || !hint) return;
    if (mode === 'rts') {
      title.setText(snap.outcome === 'complete' ? 'SEIZED' : 'RTS');
      status.setText(
        `a ${snap.unitX},${snap.unitY}  ·  b ${snap.unit2X},${snap.unit2Y}  ·  sel ${snap.selectedCount}${
          snap.lastResult ? `  ·  ${snap.lastResult}` : ''
        }`,
      );
      hint.setText(
        snap.outcome === 'playing'
          ? snap.selectedCount > 0
            ? 'WASD MOVES SELECTED UNITS'
            : 'J SELECTS UNIT A   DRAG BOX-SELECTS'
          : 'SEIZED',
      );
    } else {
      title.setText(snap.outcome === 'complete' ? 'OWNED' : 'ZONES');
      status.setText(`owned ${snap.owned}/2${snap.lastResult ? `  ·  ${snap.lastResult}` : ''}`);
      hint.setText(snap.outcome === 'playing' ? 'STAND IN BOTH ZONES' : 'OWNED');
    }
  }

  function finish(): void {
    if (outcome !== 'playing') return;
    if (mode === 'rts') {
      const nearFlag = units.some((unit) => unit.selected && dist(unit.x, unit.y, FLAG.x, FLAG.y) <= 36);
      if (nearFlag) {
        outcome = 'complete';
        lastResult = 'seized';
        context.audio.playCue('ui.confirm');
        return;
      }
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
      if (units[0]!.selected) {
        lastResult = 'already';
        paint();
        return 'already';
      }
      units[0]!.selected = true;
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
      units[0]!.x = x;
      units[0]!.y = y;
    },
    tick(deltaMs: number): void {
      if (disposed || outcome !== 'playing') return;
      if (mode === 'rts') {
        const step = UNIT_SPEED * (deltaMs / 1000);
        for (const unit of units) {
          if (!unit.selected) continue;
          unit.x = Math.max(24, Math.min(width - 24, unit.x + moveX * step));
          unit.y = Math.max(24, Math.min(height - 24, unit.y + moveY * step));
        }
        if ((moveX !== 0 || moveY !== 0) && units.some((unit) => unit.selected)) lastResult = 'move';
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
          const wide = maxX - minX >= 8 || maxY - minY >= 8;
          if (wide) {
            let boxed = 0;
            for (const unit of units) {
              if (unit.x >= minX && unit.x <= maxX && unit.y >= minY && unit.y <= maxY) {
                unit.selected = true;
                boxed += 1;
              }
            }
            if (boxed > 0) {
              lastResult = 'boxed';
              context.audio.playCue('ui.confirm');
            }
          }
          dragStart = null;
          boxSprite?.setVisible(false);
        }
      }
      if (mode === 'zone' && territory?.active()) {
        territory.setOccupant(units[0]!.x, units[0]!.y);
        territory.tick(deltaMs);
        ownedA = territory.owned().includes('zone-a');
        ownedB = territory.owned().includes('zone-b');
        lastResult = territory.lastResult();
      } else if (mode === 'zone') {
        const inA = dist(units[0]!.x, units[0]!.y, ZONE_A.x, ZONE_A.y) <= ZONE_R;
        const inB = dist(units[0]!.x, units[0]!.y, ZONE_B.x, ZONE_B.y) <= ZONE_R;
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
        unitASprite?.destroy();
        unitBSprite?.destroy();
        flagSprite?.destroy();
        zoneASprite?.destroy();
        zoneBSprite?.destroy();
        boxSprite?.destroy();
      } catch {
        /* scene already tearing down */
      }
    },
  };
}
