import type { SimulationService } from '@sw2d/packs';
import { accentStyle, headingStyle, mutedStyle } from '../scenes/theme.ts';
import type { SceneContext } from '../scenes/SceneContext.ts';

/**
 * Bind the generated ui-simulation shell to `sw2d.simulation`.
 *
 * Idle uses catalog production, prestige and offline catch-up. Farm uses the
 * pack's plot framework. Colony keeps the ledger/jobs presentation. Overlay
 * kits stay local.
 */

const SIMULATION_CAPABILITY_ID = 'simulation.resources';

export type SimulationStarterMode = 'idle' | 'farm' | 'colony';

export interface StarterSimulationPlot {
  readonly phase: 'empty' | 'dry' | 'growing' | 'ripe';
  readonly remainingMs: number;
}

export interface StarterSimulationWorker {
  readonly busy: boolean;
  readonly remainingMs: number;
}

export interface StarterSimulationSnapshot {
  readonly active: boolean;
  readonly mode: SimulationStarterMode | null;
  readonly selectedIndex: number;
  readonly crops: number;
  readonly materials: number;
  readonly gold: number;
  readonly goldLabel: string;
  readonly currency: number;
  readonly rate: number;
  readonly prestigeLevel: number;
  readonly prestigeMultiplier: number;
  readonly plots: readonly StarterSimulationPlot[];
  readonly workers: readonly StarterSimulationWorker[];
  readonly constructing: boolean;
  readonly constructRemainingMs: number;
  readonly built: boolean;
  readonly lastResult: string | null;
  readonly outcome: 'playing' | 'complete';
  readonly jobCount: number;
  readonly season: string | null;
  readonly offlineAppliedMs: number;
}

export interface StarterSimulationBinding {
  readonly active: boolean;
  select(delta: number): void;
  confirm(): void;
  secondary(): void;
  prestige(): void;
  tick(deltaMs: number): void;
  snapshot(): StarterSimulationSnapshot;
  render(): void;
  dispose(): void;
}

const EMPTY_SNAPSHOT: StarterSimulationSnapshot = {
  active: false,
  mode: null,
  selectedIndex: 0,
  crops: 0,
  materials: 0,
  gold: 0,
  goldLabel: '0',
  currency: 0,
  rate: 0,
  prestigeLevel: 0,
  prestigeMultiplier: 1,
  plots: [],
  workers: [],
  constructing: false,
  constructRemainingMs: 0,
  built: false,
  lastResult: null,
  outcome: 'playing',
  jobCount: 0,
  season: null,
  offlineAppliedMs: 0,
};

const INERT: StarterSimulationBinding = {
  active: false,
  select: () => undefined,
  confirm: () => undefined,
  secondary: () => undefined,
  prestige: () => undefined,
  tick: () => undefined,
  snapshot: () => EMPTY_SNAPSHOT,
  render: () => undefined,
  dispose: () => undefined,
};

const GATHER_ID = 'gather';
const GATHER_MS = 400;
const GATHER_BONUS = 10;
const UPGRADE_COST = 20;
const GATHER_MS_COLONY = 400;
const CONSTRUCT_MS = 480;
const BUILD_COST = 2;
const WORKER_IDS = ['gather-0', 'gather-1'] as const;
const CONSTRUCT_ID = 'construct';

const EMPTY_COLOR = 0x384054;
const GROWING_COLOR = 0xf0c274;
const RIPE_COLOR = 0x65d0a8;
const DRY_COLOR = 0xc47b4a;
const IDLE_COLOR = 0x4f9ee0;
const BUILD_COLOR = 0x39415a;

interface SlotSprite {
  setFillStyle(color: number, alpha?: number): unknown;
  setStrokeStyle(width: number, color: number, alpha?: number): unknown;
  destroy(): void;
}

function jobDone(sim: SimulationService, jobId: string): boolean {
  try {
    return sim.isJobComplete(jobId);
  } catch {
    return false;
  }
}

function jobRemaining(sim: SimulationService, jobId: string): number {
  return Math.round(sim.listJobs().find((job) => job.id === jobId)?.remainingMs ?? 0);
}

function wrap(index: number, length: number): number {
  return ((index % length) + length) % length;
}

export function bindStarterSimulation(
  context: SceneContext,
  options?: { readonly mode?: SimulationStarterMode | null; readonly hud?: boolean },
): StarterSimulationBinding {
  const mode = options?.mode ?? null;
  if (mode !== 'farm' && mode !== 'colony' && mode !== 'idle') return INERT;
  if (!context.capabilities.has(SIMULATION_CAPABILITY_ID)) return INERT;
  const sim = context.capabilities.require<SimulationService>(SIMULATION_CAPABILITY_ID);

  const hud = options?.hud !== false;
  const scene = context.scene;
  const { width, height } = context.definition.viewport;
  const slotCount = mode === 'idle' ? 0 : 3;

  const title = hud ? scene.add.text(width * 0.5, 28, '', headingStyle(20)).setOrigin(0.5).setScrollFactor(0).setDepth(50) : null;
  const status = hud ? scene.add.text(width * 0.5, 54, '', mutedStyle(14)).setOrigin(0.5).setScrollFactor(0).setDepth(50) : null;
  const hint = hud ? scene.add.text(width * 0.5, height - 28, '', accentStyle(14)).setOrigin(0.5).setScrollFactor(0).setDepth(50) : null;

  const slots: SlotSprite[] = [];
  const labels: { setText(value: string): unknown; destroy(): void }[] = [];
  if (hud && slotCount > 0) {
    for (let i = 0; i < slotCount; i++) {
      const x = width * 0.5 + (i - 1) * 220;
      const rect = scene.add.rectangle(x, height * 0.5, 160, 120, EMPTY_COLOR, 0.95).setStrokeStyle(2, 0x8a93a6, 0.9).setScrollFactor(0).setDepth(20);
      slots.push(rect);
      labels.push(scene.add.text(x, height * 0.5 + 88, '', mutedStyle(14)).setOrigin(0.5).setScrollFactor(0).setDepth(21));
    }
  }

  const workers: Array<{ busy: boolean }> = [{ busy: false }, { busy: false }];
  let selectedIndex = 0;
  let constructing = false;
  let built = false;
  let lastResult: string | null = null;
  let outcome: 'playing' | 'complete' = 'playing';
  let disposed = false;
  let gatherActive = false;
  const offlineAppliedMs = sim.catchUp(Date.now()).appliedMs;

  function snapshot(): StarterSimulationSnapshot {
    const packPlots = sim.plots();
    return {
      active: true,
      mode,
      selectedIndex,
      crops: sim.resource('crops'),
      materials: sim.resource('materials'),
      gold: sim.resource('gold'),
      goldLabel: sim.formatAmount(sim.resource('gold')),
      currency: sim.resource('currency'),
      rate: sim.productionRate('gold') * sim.prestigeMultiplier(),
      prestigeLevel: sim.prestigeLevel(),
      prestigeMultiplier: sim.prestigeMultiplier(),
      plots: packPlots.map((plot) => ({
        phase: plot.phase,
        remainingMs: plot.remainingMs,
      })),
      workers: workers.map((worker, index) => ({
        busy: worker.busy,
        remainingMs: jobRemaining(sim, WORKER_IDS[index]!),
      })),
      constructing,
      constructRemainingMs: jobRemaining(sim, CONSTRUCT_ID),
      built,
      lastResult,
      outcome,
      jobCount: sim.listJobs().length,
      season: mode === 'farm' ? sim.season() : null,
      offlineAppliedMs,
    };
  }

  function paint(): void {
    const snap = snapshot();
    for (let i = 0; i < slots.length; i++) {
      const slot = slots[i]!;
      const selected = i === selectedIndex;
      slot.setStrokeStyle(selected ? 4 : 2, selected ? 0xffffff : 0x8a93a6, 0.95);
      if (mode === 'farm') {
        const plot = snap.plots[i];
        const fill =
          plot?.phase === 'ripe' ? RIPE_COLOR : plot?.phase === 'growing' ? GROWING_COLOR : plot?.phase === 'dry' ? DRY_COLOR : EMPTY_COLOR;
        slot.setFillStyle(fill, 0.95);
        labels[i]?.setText(
          plot?.phase === 'ripe'
            ? `PLOT ${i + 1} RIPE`
            : plot?.phase === 'growing'
              ? `PLOT ${i + 1} GROWING`
              : plot?.phase === 'dry'
                ? `PLOT ${i + 1} DRY`
                : `PLOT ${i + 1} EMPTY`,
        );
      } else if (mode === 'colony' && i < 2) {
        const worker = snap.workers[i];
        slot.setFillStyle(worker?.busy ? GROWING_COLOR : IDLE_COLOR, 0.95);
        labels[i]?.setText(worker?.busy ? `WORKER ${i + 1} BUSY` : `WORKER ${i + 1} IDLE`);
      } else if (mode === 'colony') {
        slot.setFillStyle(snap.built ? RIPE_COLOR : snap.constructing ? GROWING_COLOR : BUILD_COLOR, 0.95);
        labels[i]?.setText(snap.built ? 'HALL BUILT' : snap.constructing ? 'BUILDING' : 'BUILD HALL');
      }
    }
    if (!title || !status || !hint) return;
    if (mode === 'idle') {
      title.setText(snap.outcome === 'complete' ? 'PRESTIGED' : 'IDLE');
      status.setText(
        `gold ${snap.goldLabel}  ·  bank ${sim.formatAmount(snap.currency)}  ·  x${snap.prestigeMultiplier}${
          snap.lastResult ? `  ·  ${snap.lastResult}` : ''
        }`,
      );
      hint.setText('J GATHERS   K UPGRADES RATE   BACKSPACE PRESTIGES');
      return;
    }
    if (mode === 'farm') {
      title.setText(snap.outcome === 'complete' ? 'HARVESTED' : 'FARM');
      status.setText(
        `crops ${snap.crops}/${sim.harvestTarget()}  ·  ${snap.season ?? 'spring'}${snap.lastResult ? `  ·  ${snap.lastResult}` : ''}${
          snap.outcome === 'complete' ? '  ·  complete' : ''
        }`,
      );
      hint.setText('ARROWS PICK A PLOT   ENTER PLANTS, WATERS, OR HARVESTS');
      return;
    }
    title.setText(snap.outcome === 'complete' ? 'BUILT' : 'COLONY');
    status.setText(
      `materials ${snap.materials}${snap.lastResult ? `  ·  ${snap.lastResult}` : ''}${
        snap.outcome === 'complete' ? '  ·  complete' : ''
      }`,
    );
    hint.setText('ARROWS PICK A JOB   ENTER ASSIGNS OR BUILDS');
  }

  function gather(): void {
    if (gatherActive) {
      lastResult = 'busy';
      return;
    }
    sim.queueJob(GATHER_ID, GATHER_MS);
    gatherActive = true;
    lastResult = 'gathering';
  }

  function upgrade(): void {
    if (sim.resource('currency') < UPGRADE_COST) {
      lastResult = 'cannot-afford';
      return;
    }
    sim.addResource('currency', -UPGRADE_COST);
    sim.setProductionRate('gold', Math.max(1, sim.productionRate('gold')) * 2);
    lastResult = 'upgraded';
  }

  function plantOrHarvest(): void {
    const result = sim.workPlot(selectedIndex);
    lastResult = result.reason;
    if (result.reason === 'harvested' && sim.resource('crops') >= sim.harvestTarget()) outcome = 'complete';
  }

  function assignOrBuild(): void {
    if (selectedIndex < 2) {
      const worker = workers[selectedIndex];
      if (!worker) return;
      if (worker.busy) {
        lastResult = 'busy';
        return;
      }
      sim.queueJob(WORKER_IDS[selectedIndex]!, GATHER_MS_COLONY);
      worker.busy = true;
      lastResult = 'assigned';
      return;
    }
    if (built) {
      lastResult = 'built';
      return;
    }
    if (constructing) {
      lastResult = 'building';
      return;
    }
    if (sim.resource('materials') < BUILD_COST) {
      lastResult = 'need-materials';
      return;
    }
    sim.addResource('materials', -BUILD_COST);
    sim.queueJob(CONSTRUCT_ID, CONSTRUCT_MS);
    constructing = true;
    lastResult = 'building';
  }

  function poll(): void {
    if (mode === 'idle') {
      if (gatherActive && jobDone(sim, GATHER_ID)) {
        gatherActive = false;
        sim.cancelJob(GATHER_ID);
        sim.addResource('currency', GATHER_BONUS);
        lastResult = 'gathered';
      }
      return;
    }
    if (mode === 'farm') return;
    for (let i = 0; i < workers.length; i++) {
      const worker = workers[i]!;
      if (worker.busy && jobDone(sim, WORKER_IDS[i]!)) {
        worker.busy = false;
        sim.addResource('materials', 1);
        sim.cancelJob(WORKER_IDS[i]!);
        lastResult = 'gathered';
      }
    }
    if (constructing && jobDone(sim, CONSTRUCT_ID)) {
      constructing = false;
      built = true;
      outcome = 'complete';
      lastResult = 'built';
    }
  }

  paint();

  return {
    active: true,
    select(delta: number): void {
      if (disposed || slotCount === 0) return;
      selectedIndex = wrap(selectedIndex + delta, slotCount);
      paint();
    },
    confirm(): void {
      if (disposed) return;
      if (mode === 'idle') gather();
      else if (mode === 'farm') plantOrHarvest();
      else assignOrBuild();
      context.audio.playCue('ui.confirm');
      paint();
    },
    secondary(): void {
      if (disposed) return;
      if (mode === 'idle') upgrade();
      context.audio.playCue('ui.confirm');
      paint();
    },
    prestige(): void {
      if (disposed) return;
      const result = sim.prestige();
      lastResult = result.reason;
      if (result.ok) outcome = 'complete';
      context.audio.playCue('ui.confirm');
      paint();
    },
    tick(deltaMs: number): void {
      if (disposed) return;
      void deltaMs;
      poll();
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
        for (const slot of slots) slot.destroy();
        for (const label of labels) label.destroy();
      } catch {
        /* scene already tearing down */
      }
    },
  };
}
