import { RUNS_CAPABILITY_ID, type RunLoadout, type RunSummary, type RunsService } from '@sw2d/contracts';
import { accentStyle, headingStyle, mutedStyle } from '../scenes/theme.ts';
import type { SceneContext } from '../scenes/SceneContext.ts';
import type { StarterEncounterBinding } from './starterEncounters.ts';

/**
 * Bind generated shells to `sw2d.progression` (Category-C Wave 17; the run
 * lifecycle added by the Final Product Completion program, Wave 2 - matrix
 * L06).
 *
 * Inert unless the game installed the pack *and* the generated packConfig
 * names a survive or run starter. The pack stays currency / XP / unlocks /
 * item counts. In survive mode, when `sw2d.runs` is installed with a live
 * catalog and the shell hands over its encounter binding, the scene is one
 * run: the escalating waves are the encounter catalog's escalation, the
 * player's death ends the run (permadeath), the result is banked as meta
 * currency, and K buys the next unlock between runs - the next run starts
 * with that loadout. Overlay survivor kits stay local (P3-C).
 */

const PROGRESSION_CAPABILITY_ID = 'progression.state';

export type ProgressionStarterMode = 'survive' | 'run';

export interface StarterProgressionSnapshot {
  readonly active: boolean;
  readonly mode: ProgressionStarterMode | null;
  readonly xp: number;
  /** Survive mode: kills credited to XP this run (0 in run mode). */
  readonly kills: number;
  readonly currency: number;
  readonly items: readonly string[];
  readonly unlocked: readonly string[];
  readonly nearId: string | null;
  readonly lastResult: string | null;
  readonly outcome: 'playing' | 'complete';
  /** Survive + sw2d.runs: the current wave (escalation) and run lifecycle. */
  readonly wave: number;
  readonly runOver: boolean;
  readonly run: {
    readonly index: number;
    readonly phase: string;
    readonly cause: string | null;
    readonly metaEarned: number;
    readonly metaCurrency: number;
    readonly unlocked: readonly string[];
    readonly nextUnlock: string | null;
    readonly loadout: RunLoadout;
    readonly loadOutcome: string;
    readonly bestWave: number;
  } | null;
}

export interface StarterProgressionBinding {
  readonly active: boolean;
  startX(): number;
  startY(): number;
  setPlayer(x: number, y: number): void;
  act(): void;
  /** Between runs: buy the next affordable unlock (survive + sw2d.runs). */
  secondary(): void;
  tick(deltaMs: number): void;
  snapshot(): StarterProgressionSnapshot;
  render(): void;
  dispose(): void;
}

const INERT: StarterProgressionBinding = {
  active: false,
  startX: () => 0,
  startY: () => 0,
  setPlayer: () => undefined,
  act: () => undefined,
  secondary: () => undefined,
  tick: () => undefined,
  snapshot: () => ({
    active: false,
    mode: null,
    xp: 0,
    kills: 0,
    currency: 0,
    items: [],
    unlocked: [],
    nearId: null,
    lastResult: null,
    outcome: 'playing',
    wave: 0,
    runOver: false,
    run: null,
  }),
  render: () => undefined,
  dispose: () => undefined,
};

interface ProgressionStore {
  currency(): number;
  addCurrency(delta: number): number;
  xp(): number;
  addXp(delta: number): number;
  unlock(flag: string): void;
  isUnlocked(flag: string): boolean;
  unlockedFlags(): readonly string[];
  itemCount(itemId: string): number;
  addItem(itemId: string, delta: number): number;
}

const START_X = 120;
const START_Y = 270;
// Survive mode: XP comes from kills (the encounter loop's combat:entityDied,
// +2 each) and from staying alive (+1 per XP_TICK_MS). The target needs
// real play: the first Wave-17 values (tick 400 ms, target 2) surged 0.8 s
// after install with no input - Category-C convergence bug.
const XP_TICK_MS = 1000;
const XP_PER_KILL = 2;
const XP_TARGET = 6;
const PLAYER_COMBAT_ID = 'player';
const FLAG_SURGE = 'surge';
const FLAG_RUN = 'run-cleared';
const RELICS = [
  { id: 'core', label: 'CORE', x: 280, y: 270, radius: 64 },
  { id: 'spark', label: 'SPARK', x: 620, y: 270, radius: 64 },
] as const;
const MARK_COLOR = 0xf0c274;
const SEEN_COLOR = 0x65d0a8;
const BAR_COLOR = 0x4f9ee0;

function dist(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(ax - bx, ay - by);
}

export function bindStarterProgression(
  context: SceneContext,
  options?: { readonly mode?: ProgressionStarterMode | null; readonly hud?: boolean; readonly battle?: StarterEncounterBinding },
): StarterProgressionBinding {
  const mode = options?.mode ?? null;
  if (mode !== 'survive' && mode !== 'run') return INERT;
  if (!context.capabilities.has(PROGRESSION_CAPABILITY_ID)) return INERT;
  const progression = context.capabilities.require<ProgressionStore>(PROGRESSION_CAPABILITY_ID);
  const battle = options?.battle?.active ? options.battle : null;
  const runsService = mode === 'survive' ? context.capabilities.get<RunsService>(RUNS_CAPABILITY_ID) ?? null : null;
  const runs = runsService?.active() ? runsService : null;
  const loadout: RunLoadout = runs?.loadout() ?? { maxHealthBonus: 0, damageBonus: 0, speedBonus: 0, startCurrency: 0, startXp: 0 };
  let runIndex = 0;
  let runSummary: RunSummary | null = null;
  let runElapsedMs = 0;
  if (runs) runIndex = runs.beginRun();

  const existingXp = progression.xp();
  if (existingXp !== loadout.startXp) progression.addXp(loadout.startXp - existingXp);
  const existingCurrency = progression.currency();
  if (existingCurrency !== loadout.startCurrency) progression.addCurrency(loadout.startCurrency - existingCurrency);

  const hud = options?.hud !== false;
  const scene = context.scene;
  const { width, height } = context.definition.viewport;

  const title = hud ? scene.add.text(width * 0.5, 28, '', headingStyle(20)).setOrigin(0.5).setScrollFactor(0).setDepth(50) : null;
  const status = hud ? scene.add.text(width * 0.5, 54, '', mutedStyle(14)).setOrigin(0.5).setScrollFactor(0).setDepth(50) : null;
  const hint = hud ? scene.add.text(width * 0.5, height - 28, '', accentStyle(14)).setOrigin(0.5).setScrollFactor(0).setDepth(50) : null;

  const barBack =
    hud && mode === 'survive'
      ? scene.add.rectangle(width * 0.5, 86, 280, 16, 0x384054, 0.95).setStrokeStyle(2, 0x8a93a6, 0.9).setScrollFactor(0).setDepth(49)
      : null;
  const barFill =
    hud && mode === 'survive'
      ? scene.add.rectangle(width * 0.5 - 136, 86, 8, 10, BAR_COLOR, 0.95).setOrigin(0, 0.5).setScrollFactor(0).setDepth(50)
      : null;

  const markers: { setFillStyle(color: number, alpha?: number): unknown; destroy(): void }[] = [];
  const labels: { setText(value: string): unknown; destroy(): void }[] = [];
  if (hud && mode === 'run') {
    for (const relic of RELICS) {
      markers.push(scene.add.rectangle(relic.x, relic.y, 36, 36, MARK_COLOR, 0.95).setStrokeStyle(2, 0xffffff, 0.9).setDepth(20));
      labels.push(scene.add.text(relic.x, relic.y - 32, relic.label, mutedStyle(12)).setOrigin(0.5).setDepth(21));
    }
  }

  let playerX = START_X;
  let playerY = START_Y;
  let tickAcc = 0;
  let lastResult: string | null = null;
  let outcome: 'playing' | 'complete' = 'playing';
  let kills = 0;
  let disposed = false;

  // Survive: a kill in the encounter loop is worth more than waiting it out.
  const onDeath =
    mode === 'survive'
      ? context.events.on('combat:entityDied', ({ entityId }) => {
          if (disposed || entityId === PLAYER_COMBAT_ID || runOver()) return;
          kills += 1;
          progression.addXp(XP_PER_KILL);
          lastResult = 'kill';
          if (outcome === 'playing') finishSurvive();
          paint();
        })
      : null;

  function nearId(): string | null {
    if (mode !== 'run') return null;
    for (const relic of RELICS) {
      if (dist(playerX, playerY, relic.x, relic.y) <= relic.radius) return relic.id;
    }
    return null;
  }

  function itemsHeld(): string[] {
    return RELICS.filter((relic) => progression.itemCount(relic.id) > 0).map((relic) => relic.id);
  }

  function runOver(): boolean {
    return battle?.snapshot()?.over ?? false;
  }

  function endRun(): void {
    if (!runs || runSummary) return;
    const b = battle?.snapshot();
    runSummary = runs.endRun({
      cause: b?.outcome === 'complete' ? 'cleared' : 'death',
      xp: progression.xp(),
      kills,
      wave: b?.wavesCleared ?? 0,
      currency: progression.currency(),
      durationMs: Math.round(runElapsedMs),
    });
    lastResult = `run over +${runSummary.metaEarned}`;
  }

  function snapshot(): StarterProgressionSnapshot {
    const meta = runs?.meta();
    return {
      active: true,
      mode,
      xp: progression.xp(),
      kills,
      currency: progression.currency(),
      items: itemsHeld(),
      unlocked: progression.unlockedFlags(),
      nearId: nearId(),
      lastResult,
      outcome,
      wave: battle?.snapshot()?.wave ?? 0,
      runOver: runOver(),
      run:
        runs && meta
          ? {
              index: runIndex,
              phase: runs.phase(),
              cause: runSummary?.cause ?? null,
              metaEarned: runSummary?.metaEarned ?? 0,
              metaCurrency: meta.metaCurrency,
              unlocked: meta.unlocked,
              nextUnlock: runs.nextAffordable()?.id ?? null,
              loadout,
              loadOutcome: runs.loadOutcome(),
              bestWave: meta.bestWave,
            }
          : null,
    };
  }

  function paint(): void {
    const snap = snapshot();
    if (mode === 'run') {
      for (let i = 0; i < RELICS.length; i++) {
        const relic = RELICS[i]!;
        const taken = progression.itemCount(relic.id) > 0;
        markers[i]?.setFillStyle(taken ? SEEN_COLOR : MARK_COLOR, 0.95);
        labels[i]?.setText(taken ? `${relic.label} TAKEN` : relic.label);
      }
    } else {
      const widthPx = 8 + Math.min(1, snap.xp / XP_TARGET) * 264;
      barFill?.setSize(widthPx, 10);
      barFill?.setFillStyle(snap.outcome === 'complete' ? SEEN_COLOR : BAR_COLOR, 0.95);
    }
    if (!title || !status || !hint) return;
    if (mode === 'survive') {
      const over = snap.runOver;
      title.setText(over ? 'RUN OVER' : snap.outcome === 'complete' ? 'SURGED' : snap.run ? `RUN ${snap.run.index}` : 'SURVIVE');
      const waveText = battle ? `  ·  wave ${snap.wave + 1}` : '';
      const metaText = snap.run ? `  ·  meta ${snap.run.metaCurrency}${snap.run.unlocked.length ? ` [${snap.run.unlocked.join(' ')}]` : ''}` : '';
      status.setText(
        `xp ${snap.xp}/${XP_TARGET}${waveText}${metaText}${snap.lastResult ? `  ·  ${snap.lastResult}` : ''}${
          snap.outcome === 'complete' && !over ? '  ·  surged' : ''
        }`,
      );
      if (over && runs) {
        const next = runs.nextAffordable();
        hint.setText(
          `BANKED +${snap.run?.metaEarned ?? 0}${next ? `   K BUYS ${next.label.toUpperCase()} (${next.cost})` : '   NO UNLOCK AFFORDABLE'}   P THEN K STARTS A NEW RUN`,
        );
      } else if (over) {
        hint.setText('DOWN   P THEN K RESTARTS');
      } else {
        hint.setText(snap.outcome === 'complete' ? 'SURGE UNLOCKED  -  WAVES KEEP ESCALATING' : 'STAY ALIVE  -  KILLS BUILD XP  -  FIRE J/X  -  WAVES ESCALATE');
      }
    } else {
      title.setText(snap.outcome === 'complete' ? 'CLEARED' : 'RUN');
      status.setText(
        `relics ${snap.items.length}/${RELICS.length}  ·  coin ${snap.currency}${snap.nearId ? `  ·  near ${snap.nearId}` : ''}${
          snap.lastResult ? `  ·  ${snap.lastResult}` : ''
        }`,
      );
      hint.setText(snap.outcome === 'complete' ? 'RUN CLEARED' : 'WALK TO A RELIC   J TAKES');
    }
  }

  function finishSurvive(): void {
    if (progression.xp() < XP_TARGET) return;
    progression.unlock(FLAG_SURGE);
    outcome = 'complete';
    lastResult = 'surged';
  }

  function actRun(): void {
    const id = nearId();
    if (!id) {
      lastResult = 'too-far';
      return;
    }
    if (progression.itemCount(id) > 0) {
      lastResult = 'already';
      return;
    }
    progression.addItem(id, 1);
    progression.addCurrency(1);
    progression.addXp(5);
    lastResult = 'taken';
    if (itemsHeld().length >= RELICS.length) {
      progression.unlock(FLAG_RUN);
      outcome = 'complete';
      lastResult = 'cleared';
    }
  }

  paint();

  return {
    active: true,
    startX: () => START_X,
    startY: () => START_Y,
    setPlayer(x: number, y: number): void {
      if (disposed) return;
      playerX = x;
      playerY = y;
    },
    act(): void {
      if (disposed || outcome !== 'playing' || mode !== 'run') return;
      actRun();
      context.audio.playCue('ui.confirm');
      paint();
    },
    secondary(): void {
      if (disposed || !runs || !runOver()) return;
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
    tick(deltaMs: number): void {
      if (disposed || mode !== 'survive') return;
      if (runOver()) {
        endRun();
        paint();
        return;
      }
      runElapsedMs += deltaMs;
      if (outcome !== 'playing') {
        paint();
        return;
      }
      tickAcc += deltaMs;
      while (tickAcc >= XP_TICK_MS && outcome === 'playing') {
        tickAcc -= XP_TICK_MS;
        progression.addXp(1);
        lastResult = 'ticked';
        finishSurvive();
      }
      paint();
    },
    snapshot,
    render: paint,
    dispose(): void {
      if (disposed) return;
      disposed = true;
      try {
        onDeath?.dispose();
        title?.destroy();
        status?.destroy();
        hint?.destroy();
        barBack?.destroy();
        barFill?.destroy();
        for (const marker of markers) marker.destroy();
        for (const label of labels) label.destroy();
      } catch {
        /* scene already tearing down */
      }
    },
  };
}
