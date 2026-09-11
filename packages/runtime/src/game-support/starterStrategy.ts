import type { TargetingService } from '@sw2d/contracts';
import { TARGETING_CAPABILITY_ID } from '@sw2d/contracts';
import { accentStyle, headingStyle, mutedStyle } from '../scenes/theme.ts';
import type { SceneContext } from '../scenes/SceneContext.ts';

/**
 * Bind generated shells to `sw2d.strategy` (Category-C Wave 18).
 *
 * Inert unless the game installed the pack *and* the generated packConfig
 * names a tactics or battler starter. The pack stays teams / active turn /
 * selection / turn advance — this file is presentation, not pathfinding,
 * attack-range or autonomous combat. Overlay tactics / auto-battler kits
 * stay local (P3-C / P3-B).
 */

const STRATEGY_CAPABILITY_ID = 'strategy.turns';
const COMBAT_CAPABILITY_ID = 'combat.health';

export type StrategyStarterMode = 'tactics' | 'battler';

export interface StarterStrategySnapshot {
  readonly active: boolean;
  readonly mode: StrategyStarterMode | null;
  readonly team: string | null;
  readonly turnNumber: number;
  readonly selected: string | null;
  readonly cursorCol: number;
  readonly cursorRow: number;
  readonly unitCol: number;
  readonly unitRow: number;
  readonly fighter: string | null;
  readonly cpuHealth: number;
  readonly nearId: string | null;
  readonly lastResult: string | null;
  readonly outcome: 'playing' | 'complete';
}

export interface StarterStrategyBinding {
  readonly active: boolean;
  step(dir: 'up' | 'down' | 'left' | 'right'): void;
  select(delta: number): void;
  act(): void;
  confirm(): void;
  tick(deltaMs: number): void;
  snapshot(): StarterStrategySnapshot;
  render(): void;
  dispose(): void;
}

const INERT: StarterStrategyBinding = {
  active: false,
  step: () => undefined,
  select: () => undefined,
  act: () => undefined,
  confirm: () => undefined,
  tick: () => undefined,
  snapshot: () => ({
    active: false,
    mode: null,
    team: null,
    turnNumber: 0,
    selected: null,
    cursorCol: 0,
    cursorRow: 0,
    unitCol: 0,
    unitRow: 0,
    fighter: null,
    cpuHealth: 0,
    nearId: null,
    lastResult: null,
    outcome: 'playing',
  }),
  render: () => undefined,
  dispose: () => undefined,
};

interface StrategyStore {
  registerTeam(teamId: string): void;
  teams(): readonly string[];
  activeTeam(): string | null;
  advanceTurn(): string;
  turnNumber(): number;
  select(entityId: string): void;
  deselect(): void;
  selected(): string | null;
}

interface CombatStore {
  register(entityId: string, maxHealth: number): void;
  has(entityId: string): boolean;
  get(entityId: string): { readonly current: number; readonly max: number };
  damage(entityId: string, amount: number, nowMs: number): { readonly current: number };
  heal(entityId: string, amount: number): { readonly current: number };
}

const CELL = 32;
const SCOUT = { id: 'scout', col: 8, row: 8 };
const GRUNT = { id: 'grunt', col: 20, row: 8 };
const FLAG = { id: 'flag', col: 12, row: 8 };
const MIN_COL = 2;
const MAX_COL = 27;
const MIN_ROW = 3;
const MAX_ROW = 14;
const FIGHTERS = ['FOX', 'BEAR', 'OWL'] as const;
const CPU_PASS_MS = 400;
const CPU_MAX = 2;
const PLAYER_COLOR = 0x65d0a8;
const CPU_COLOR = 0xe05fa0;
const FLAG_COLOR = 0xf0c274;
const EMPTY_COLOR = 0x384054;
const DONE_COLOR = 0x65d0a8;

function wrap(index: number, length: number): number {
  return ((index % length) + length) % length;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function bindStarterStrategy(
  context: SceneContext,
  options?: { readonly mode?: StrategyStarterMode | null; readonly hud?: boolean },
): StarterStrategyBinding {
  const mode = options?.mode ?? null;
  if (mode !== 'tactics' && mode !== 'battler') return INERT;
  if (!context.capabilities.has(STRATEGY_CAPABILITY_ID)) return INERT;
  const strategy = context.capabilities.require<StrategyStore>(STRATEGY_CAPABILITY_ID);
  const combat = context.capabilities.has(COMBAT_CAPABILITY_ID)
    ? context.capabilities.require<CombatStore>(COMBAT_CAPABILITY_ID)
    : null;
  const targeting = context.capabilities.get<TargetingService>(TARGETING_CAPABILITY_ID);

  if (strategy.teams().length === 0) {
    strategy.registerTeam('player');
    strategy.registerTeam('cpu');
    strategy.advanceTurn();
  } else if (strategy.activeTeam() !== 'player') {
    strategy.advanceTurn();
  }
  strategy.deselect();

  // Wave 30: in battler-auto mode `sw2d.targeting` owns both fighters' health
  // and resolves the fight. Registering a `cpu` entity in `combat.health` too
  // would create a second, never-damaged owner the HUD then reports at full
  // health while declaring victory (Category-C convergence bug). Only the
  // manual battler / tactics paths register the combat entity.
  const autoTargeting = mode === 'battler' && targeting?.active() === true && targeting.mode() === 'auto';
  const cpuMax = autoTargeting ? targeting!.health('cpu') : CPU_MAX;
  if (combat && !autoTargeting) {
    if (!combat.has('cpu')) combat.register('cpu', CPU_MAX);
    else {
      const state = combat.get('cpu');
      if (state.current < state.max) combat.heal('cpu', state.max - state.current);
    }
  }

  const hud = options?.hud !== false;
  const scene = context.scene;
  const { width, height } = context.definition.viewport;

  const title = hud ? scene.add.text(width * 0.5, 28, '', headingStyle(20)).setOrigin(0.5).setScrollFactor(0).setDepth(50) : null;
  const status = hud ? scene.add.text(width * 0.5, 54, '', mutedStyle(14)).setOrigin(0.5).setScrollFactor(0).setDepth(50) : null;
  const hint = hud ? scene.add.text(width * 0.5, height - 28, '', accentStyle(14)).setOrigin(0.5).setScrollFactor(0).setDepth(50) : null;

  const cursorMark =
    hud && mode === 'tactics'
      ? scene.add.rectangle(SCOUT.col * CELL, SCOUT.row * CELL, 36, 36).setStrokeStyle(3, 0xffffff, 0.95).setFillStyle(0xffffff, 0).setDepth(22)
      : null;
  const scoutMark =
    hud && mode === 'tactics'
      ? scene.add.rectangle(SCOUT.col * CELL, SCOUT.row * CELL, 28, 28, PLAYER_COLOR, 0.95).setStrokeStyle(2, 0xffffff, 0.9).setDepth(20)
      : null;
  const gruntMark =
    hud && mode === 'tactics'
      ? scene.add.rectangle(GRUNT.col * CELL, GRUNT.row * CELL, 28, 28, CPU_COLOR, 0.95).setStrokeStyle(2, 0xffffff, 0.9).setDepth(20)
      : null;
  const flagMark =
    hud && mode === 'tactics'
      ? scene.add.rectangle(FLAG.col * CELL, FLAG.row * CELL, 24, 40, FLAG_COLOR, 0.95).setStrokeStyle(2, 0xffffff, 0.9).setDepth(19)
      : null;
  const scoutLabel =
    hud && mode === 'tactics'
      ? scene.add.text(SCOUT.col * CELL, SCOUT.row * CELL - 28, 'SCOUT', mutedStyle(12)).setOrigin(0.5).setDepth(21)
      : null;
  const flagLabel =
    hud && mode === 'tactics'
      ? scene.add.text(FLAG.col * CELL, FLAG.row * CELL - 36, 'FLAG', mutedStyle(12)).setOrigin(0.5).setDepth(21)
      : null;

  const slots: { setFillStyle(color: number, alpha?: number): unknown; setStrokeStyle(width: number, color: number, alpha?: number): unknown; destroy(): void }[] =
    [];
  const labels: { setText(value: string): unknown; destroy(): void }[] = [];
  if (hud && mode === 'battler') {
    for (let i = 0; i < FIGHTERS.length; i++) {
      const x = width * 0.5 + (i - 1) * 220;
      slots.push(scene.add.rectangle(x, height * 0.5, 160, 120, EMPTY_COLOR, 0.95).setStrokeStyle(2, 0x8a93a6, 0.9).setScrollFactor(0).setDepth(20));
      labels.push(scene.add.text(x, height * 0.5, FIGHTERS[i]!, mutedStyle(16)).setOrigin(0.5).setScrollFactor(0).setDepth(21));
    }
  }

  let cursorCol = SCOUT.col;
  let cursorRow = SCOUT.row;
  let scoutCol = SCOUT.col;
  let scoutRow = SCOUT.row;
  let selectedIndex = 0;
  let lastResult: string | null = null;
  let outcome: 'playing' | 'complete' = 'playing';
  let nowMs = 0;
  let cpuWait = 0;
  // Battler-auto: the lineup pick is a phase. The autonomous fight starts on
  // CONFIRM, not at install, so a player really gets to pick first.
  let fightStarted = false;
  let disposed = false;

  function playerTurn(): boolean {
    return strategy.activeTeam() === 'player';
  }

  function cpuHealth(): number {
    if (autoTargeting) return targeting!.health('cpu');
    if (!combat || !combat.has('cpu')) return 0;
    return combat.get('cpu').current;
  }

  function nearId(): string | null {
    if (mode !== 'tactics') return null;
    if (cursorCol === scoutCol && cursorRow === scoutRow) return 'scout';
    if (cursorCol === FLAG.col && cursorRow === FLAG.row) return 'flag';
    if (cursorCol === GRUNT.col && cursorRow === GRUNT.row) return 'grunt';
    return null;
  }

  function snapshot(): StarterStrategySnapshot {
    return {
      active: true,
      mode,
      team: strategy.activeTeam(),
      turnNumber: strategy.turnNumber(),
      selected: strategy.selected(),
      cursorCol,
      cursorRow,
      unitCol: scoutCol,
      unitRow: scoutRow,
      fighter: mode === 'battler' ? FIGHTERS[selectedIndex] ?? null : null,
      cpuHealth: cpuHealth(),
      nearId: nearId(),
      lastResult,
      outcome,
    };
  }

  function paint(): void {
    const snap = snapshot();
    if (mode === 'tactics') {
      scoutMark?.setPosition(scoutCol * CELL, scoutRow * CELL);
      scoutLabel?.setPosition(scoutCol * CELL, scoutRow * CELL - 28);
      cursorMark?.setPosition(cursorCol * CELL, cursorRow * CELL);
      flagMark?.setFillStyle(snap.outcome === 'complete' ? DONE_COLOR : FLAG_COLOR, 0.95);
      scoutMark?.setFillStyle(snap.selected === 'scout' ? DONE_COLOR : PLAYER_COLOR, 0.95);
    } else {
      for (let i = 0; i < slots.length; i++) {
        const selected = i === selectedIndex;
        slots[i]?.setStrokeStyle(selected ? 4 : 2, selected ? 0xffffff : 0x8a93a6, 0.95);
        slots[i]?.setFillStyle(selected ? FLAG_COLOR : EMPTY_COLOR, 0.95);
        labels[i]?.setText(FIGHTERS[i]!);
      }
    }
    if (!title || !status || !hint) return;
    if (mode === 'tactics') {
      title.setText(snap.outcome === 'complete' ? 'SEIZED' : 'TACTICS');
      status.setText(
        `turn ${snap.turnNumber}  ·  ${snap.team ?? 'none'}${snap.selected ? `  ·  ${snap.selected}` : ''}${
          snap.nearId ? `  ·  near ${snap.nearId}` : ''
        }${
          targeting?.active() && targeting.mode() === 'range'
            ? targeting.canStrike('scout', 'grunt')
              ? '  ·  in range'
              : '  ·  out of range'
            : ''
        }${snap.lastResult ? `  ·  ${snap.lastResult}` : ''}`,
      );
      hint.setText(snap.outcome === 'complete' ? 'FLAG SEIZED' : 'ARROWS MOVE   J SELECTS   REACH THE FLAG');
    } else {
      title.setText(snap.outcome === 'complete' ? 'WON' : 'BATTLER');
      status.setText(
        `turn ${snap.turnNumber}  ·  ${snap.team ?? 'none'}  ·  cpu ${snap.cpuHealth}/${cpuMax}${
          snap.fighter ? `  ·  ${snap.fighter}` : ''
        }${snap.lastResult ? `  ·  ${snap.lastResult}` : ''}`,
      );
      hint.setText(
        snap.outcome === 'complete'
          ? 'ROUND WON'
          : autoTargeting
            ? fightStarted
              ? 'AUTO-STRIKING'
              : 'ARROWS PICK   ENTER FIGHTS'
            : 'ARROWS PICK   ENTER STRIKES',
      );
    }
  }

  function passCpu(): void {
    if (strategy.activeTeam() !== 'cpu' || outcome !== 'playing') return;
    strategy.advanceTurn();
    lastResult = 'cpu-pass';
  }

  paint();

  return {
    active: true,
    step(dir: 'up' | 'down' | 'left' | 'right'): void {
      if (disposed || mode !== 'tactics' || outcome !== 'playing') return;
      if (!playerTurn()) {
        lastResult = 'wait';
        paint();
        return;
      }
      const dCol = dir === 'left' ? -1 : dir === 'right' ? 1 : 0;
      const dRow = dir === 'up' ? -1 : dir === 'down' ? 1 : 0;
      if (strategy.selected() === 'scout') {
        const nextCol = clamp(scoutCol + dCol, MIN_COL, MAX_COL);
        const nextRow = clamp(scoutRow + dRow, MIN_ROW, MAX_ROW);
        if (nextCol === GRUNT.col && nextRow === GRUNT.row) {
          lastResult = 'blocked';
          paint();
          return;
        }
        scoutCol = nextCol;
        scoutRow = nextRow;
        cursorCol = scoutCol;
        cursorRow = scoutRow;
        lastResult = 'moved';
        if (scoutCol === FLAG.col && scoutRow === FLAG.row) {
          strategy.advanceTurn();
          outcome = 'complete';
          lastResult = 'seized';
        }
      } else {
        cursorCol = clamp(cursorCol + dCol, MIN_COL, MAX_COL);
        cursorRow = clamp(cursorRow + dRow, MIN_ROW, MAX_ROW);
        lastResult = 'aim';
      }
      paint();
    },
    select(delta: number): void {
      if (disposed || mode !== 'battler' || outcome !== 'playing' || fightStarted) return;
      selectedIndex = wrap(selectedIndex + delta, FIGHTERS.length);
      paint();
    },
    act(): void {
      if (disposed || mode !== 'tactics' || outcome !== 'playing') return;
      if (!playerTurn()) {
        lastResult = 'wait';
        paint();
        return;
      }
      if (cursorCol === scoutCol && cursorRow === scoutRow) {
        strategy.select('scout');
        lastResult = 'selected';
      } else {
        lastResult = 'empty';
      }
      context.audio.playCue('ui.confirm');
      paint();
    },
    confirm(): void {
      if (disposed || outcome !== 'playing') return;
      if (autoTargeting) {
        if (!fightStarted) {
          fightStarted = true;
          lastResult = 'fight';
          context.audio.playCue('ui.confirm');
        } else {
          lastResult = 'auto';
        }
        paint();
        return;
      }
      if (mode === 'tactics') {
        if (!playerTurn()) {
          lastResult = 'wait';
          paint();
          return;
        }
        if (strategy.selected() === null) {
          lastResult = 'no-unit';
          paint();
          return;
        }
        strategy.deselect();
        strategy.advanceTurn();
        cpuWait = 0;
        lastResult = 'ended';
        context.audio.playCue('ui.confirm');
        paint();
        return;
      }
      if (!playerTurn()) {
        lastResult = 'wait';
        paint();
        return;
      }
      const fighter = FIGHTERS[selectedIndex]!;
      strategy.select(fighter.toLowerCase());
      if (combat && combat.has('cpu')) combat.damage('cpu', 1, nowMs);
      lastResult = 'hit';
      if (combat && cpuHealth() <= 0) {
        outcome = 'complete';
        lastResult = 'won';
      } else {
        strategy.advanceTurn();
        cpuWait = 0;
      }
      context.audio.playCue('ui.confirm');
      paint();
    },
    tick(deltaMs: number): void {
      if (disposed || outcome !== 'playing') return;
      nowMs += deltaMs;
      if (mode === 'tactics' && targeting?.active() && targeting.mode() === 'range') {
        targeting.setPos('scout', scoutCol * CELL, scoutRow * CELL);
        targeting.setPos('grunt', GRUNT.col * CELL, GRUNT.row * CELL);
      }
      if (autoTargeting) {
        if (!fightStarted) return;
        targeting!.tick(deltaMs, nowMs);
        if (targeting!.outcome() === 'complete') {
          outcome = 'complete';
          lastResult = 'won';
        }
        paint();
        return;
      }
      if (strategy.activeTeam() === 'cpu') {
        cpuWait += deltaMs;
        if (cpuWait >= CPU_PASS_MS) {
          cpuWait = 0;
          passCpu();
          paint();
        }
      }
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
        cursorMark?.destroy();
        scoutMark?.destroy();
        gruntMark?.destroy();
        flagMark?.destroy();
        scoutLabel?.destroy();
        flagLabel?.destroy();
        for (const slot of slots) slot.destroy();
        for (const label of labels) label.destroy();
      } catch {
        /* scene already tearing down */
      }
    },
  };
}
