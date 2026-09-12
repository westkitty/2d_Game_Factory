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
  readonly unit3X: number;
  readonly unit3Y: number;
  readonly queued: number;
  readonly alive: number;
  readonly owned: number;
  readonly contested: number;
  readonly score: number;
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
    unit3X: 0,
    unit3Y: 0,
    queued: 0,
    alive: 0,
    owned: 0,
    contested: 0,
    score: 0,
    lastResult: null,
    outcome: 'playing',
  }),
  render: () => undefined,
  dispose: () => undefined,
};

const UNIT_A = { x: 200, y: 270 };
const UNIT_B = { x: 200, y: 400 };
const UNIT_C = { x: 200, y: 500 };
const HAZARD = { x: 80, y: 80 };
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
  const unitCSprite =
    hud && mode === 'rts'
      ? scene.add.rectangle(UNIT_C.x, UNIT_C.y, 36, 36, 0xf0c274, 0.95).setStrokeStyle(2, 0xffffff, 0.9).setDepth(20)
      : null;
  const hazardSprite =
    hud && mode === 'rts'
      ? scene.add.rectangle(HAZARD.x, HAZARD.y, 28, 28, 0xe0574f, 0.8).setStrokeStyle(2, 0xffffff, 0.6).setDepth(18)
      : null;
  const redSprite =
    hud && mode === 'zone'
      ? scene.add.rectangle(700, 80, 28, 28, 0xe0574f, 0.95).setStrokeStyle(2, 0xffffff, 0.9).setDepth(20)
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

  interface CommandUnit {
    x: number;
    y: number;
    selected: boolean;
    alive: boolean;
    queue: { x: number; y: number }[];
  }
  const units: CommandUnit[] = [
    { x: start.x, y: start.y, selected: false, alive: true, queue: [] },
    { x: UNIT_B.x, y: UNIT_B.y, selected: false, alive: true, queue: [] },
    { x: UNIT_C.x, y: UNIT_C.y, selected: false, alive: true, queue: [] },
  ];
  let redX = 700;
  let redY = 80;
  let moveX = 0;
  let moveY = 0;
  let holdA = 0;
  let holdB = 0;
  let ownedA = false;
  let ownedB = false;
  let lastResult: string | null = null;
  let outcome: 'playing' | 'complete' = 'playing';
  let nowMs = 0;
  let disposed = false;
  let dragStart: { x: number; y: number } | null = null;
  const boxSprite =
    hud && mode === 'rts'
      ? scene.add.rectangle(0, 0, 1, 1, 0xffffff, 0.12).setStrokeStyle(1, 0xffffff, 0.8).setDepth(30).setVisible(false)
      : null;

  function snapshot(): StarterCommandSnapshot {
    const live = units.filter((unit) => unit.alive);
    const selectedCount = live.filter((unit) => unit.selected).length;
    return {
      active: true,
      mode,
      selected: units[0]!.selected && units[0]!.alive,
      selectedCount,
      unitX: Math.round(units[0]!.x),
      unitY: Math.round(units[0]!.y),
      unit2X: Math.round(units[1]!.x),
      unit2Y: Math.round(units[1]!.y),
      unit3X: Math.round(units[2]!.x),
      unit3Y: Math.round(units[2]!.y),
      queued: live.reduce((sum, unit) => sum + unit.queue.length, 0),
      alive: live.length,
      owned: (ownedA ? 1 : 0) + (ownedB ? 1 : 0),
      contested: territory?.contested().length ?? 0,
      score: territory?.score('player') ?? 0,
      lastResult,
      outcome,
    };
  }

  function paint(): void {
    const snap = snapshot();
    unitASprite?.setPosition(units[0]!.x, units[0]!.y);
    unitASprite?.setStrokeStyle(units[0]!.selected ? 4 : 2, 0xffffff, units[0]!.alive ? 0.95 : 0.3);
    unitBSprite?.setPosition(units[1]!.x, units[1]!.y);
    unitBSprite?.setStrokeStyle(units[1]!.selected ? 4 : 2, 0xffffff, units[1]!.alive ? 0.95 : 0.3);
    unitCSprite?.setPosition(units[2]!.x, units[2]!.y);
    unitCSprite?.setStrokeStyle(units[2]!.selected ? 4 : 2, 0xffffff, units[2]!.alive ? 0.95 : 0.3);
    redSprite?.setPosition(redX, redY);
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
            ? 'WASD OR CLICK-MOVE  ·  SHIFT QUEUES'
            : 'J / CLICK SELECTS  ·  DRAG BOX-SELECTS'
          : 'SEIZED',
      );
    } else {
      title.setText(snap.outcome === 'complete' ? 'OWNED' : 'ZONES');
      status.setText(
        `owned ${snap.owned}/2  ·  score ${snap.score}  ·  contested ${snap.contested}${snap.lastResult ? `  ·  ${snap.lastResult}` : ''}`,
      );
      hint.setText(snap.outcome === 'playing' ? 'STAND IN ZONES  ·  RED CONTESTS' : 'OWNED');
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
      if (!units[0]!.alive) {
        lastResult = 'dead';
        paint();
        return 'already';
      }
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
      nowMs += deltaMs;
      if (mode === 'rts') {
        const step = UNIT_SPEED * (deltaMs / 1000);
        for (const unit of units) {
          if (!unit.alive) {
            unit.selected = false;
            unit.queue = [];
            continue;
          }
          if (dist(unit.x, unit.y, HAZARD.x, HAZARD.y) <= 22) {
            unit.alive = false;
            unit.selected = false;
            unit.queue = [];
            lastResult = 'dead';
            continue;
          }
          if (unit.selected) {
            unit.x = Math.max(24, Math.min(width - 24, unit.x + moveX * step));
            unit.y = Math.max(24, Math.min(height - 24, unit.y + moveY * step));
          }
          const waypoint = unit.queue[0];
          if (waypoint) {
            const dx = waypoint.x - unit.x;
            const dy = waypoint.y - unit.y;
            const d = Math.hypot(dx, dy);
            if (d <= 8) unit.queue.shift();
            else {
              unit.x += (dx / d) * step;
              unit.y += (dy / d) * step;
            }
            lastResult = 'queued';
          }
        }
        if ((moveX !== 0 || moveY !== 0) && units.some((unit) => unit.selected && unit.alive)) lastResult = 'move';
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
              if (!unit.alive) continue;
              if (unit.x >= minX && unit.x <= maxX && unit.y >= minY && unit.y <= maxY) {
                unit.selected = true;
                boxed += 1;
              }
            }
            if (boxed > 0) {
              lastResult = 'boxed';
              context.audio.playCue('ui.confirm');
            }
          } else {
            const hit = units.find((unit) => unit.alive && dist(unit.x, unit.y, ptr.worldX, ptr.worldY) <= 22);
            const additive = context.input.isDown('SECONDARY_ACTION');
            if (hit) {
              if (!additive) for (const unit of units) unit.selected = false;
              hit.selected = true;
              lastResult = 'selected';
            } else {
              for (const unit of units) {
                if (!unit.selected || !unit.alive) continue;
                if (additive) unit.queue.push({ x: ptr.worldX, y: ptr.worldY });
                else unit.queue = [{ x: ptr.worldX, y: ptr.worldY }];
              }
              if (units.some((unit) => unit.selected && unit.alive)) lastResult = 'queued';
            }
          }
          dragStart = null;
          boxSprite?.setVisible(false);
        }
      }
      if (mode === 'zone' && territory?.active()) {
        if (nowMs > 1600) {
          const dx = ZONE_A.x - redX;
          const dy = ZONE_A.y - redY;
          const d = Math.hypot(dx, dy);
          if (d > 4) {
            redX += (dx / d) * 40 * (deltaMs / 1000);
            redY += (dy / d) * 40 * (deltaMs / 1000);
          }
        }
        territory.setOccupants([
          { faction: 'player', x: units[0]!.x, y: units[0]!.y },
          { faction: 'red', x: redX, y: redY },
        ]);
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
        unitCSprite?.destroy();
        hazardSprite?.destroy();
        redSprite?.destroy();
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
