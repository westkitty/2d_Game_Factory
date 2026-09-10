import { accentStyle, headingStyle, mutedStyle } from '../scenes/theme.ts';
import type { SceneContext } from '../scenes/SceneContext.ts';

/**
 * Bind the generated ui-simulation shell to `sw2d.simulation` (Category-C Wave 13).
 *
 * Inert unless the game installed the pack *and* the generated packConfig
 * names a farm or colony starter. The pack stays a resource ledger plus
 * timed jobs — this file is presentation, not a crop/season or colony-AI
 * framework. Overlay farming/colony kits stay local (P3-J).
 */

const SIMULATION_CAPABILITY_ID = 'simulation.resources';

export type SimulationStarterMode = 'farm' | 'colony';

export interface StarterSimulationPlot {
  readonly phase: 'empty' | 'growing' | 'ripe';
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
  readonly plots: readonly StarterSimulationPlot[];
  readonly workers: readonly StarterSimulationWorker[];
  readonly constructing: boolean;
  readonly constructRemainingMs: number;
  readonly built: boolean;
  readonly lastResult: string | null;
  readonly outcome: 'playing' | 'complete';
  readonly jobCount: number;
}

export interface StarterSimulationBinding {
  readonly active: boolean;
  select(delta: number): void;
  confirm(): void;
  tick(deltaMs: number): void;
  snapshot(): StarterSimulationSnapshot;
  render(): void;
  dispose(): void;
}

const INERT: StarterSimulationBinding = {
  active: false,
  select: () => undefined,
  confirm: () => undefined,
  tick: () => undefined,
  snapshot: () => ({
    active: false,
    mode: null,
    selectedIndex: 0,
    crops: 0,
    materials: 0,
    plots: [],
    workers: [],
    constructing: false,
    constructRemainingMs: 0,
    built: false,
    lastResult: null,
    outcome: 'playing',
    jobCount: 0,
  }),
  render: () => undefined,
  dispose: () => undefined,
};

interface SimulationLedger {
  resource(resourceId: string): number;
  addResource(resourceId: string, delta: number): number;
  queueJob(jobId: string, durationMs: number): void;
  isJobComplete(jobId: string): boolean;
  cancelJob(jobId: string): boolean;
  listJobs(): readonly { readonly id: string; readonly remainingMs: number; readonly totalMs: number }[];
}

const GROW_MS = 480;
const GATHER_MS = 400;
const CONSTRUCT_MS = 480;
const HARVEST_TARGET = 3;
const BUILD_COST = 2;
const PLOT_IDS = ['grow-0', 'grow-1', 'grow-2'] as const;
const WORKER_IDS = ['gather-0', 'gather-1'] as const;
const CONSTRUCT_ID = 'construct';

const EMPTY_COLOR = 0x384054;
const GROWING_COLOR = 0xf0c274;
const RIPE_COLOR = 0x65d0a8;
const IDLE_COLOR = 0x4f9ee0;
const BUILD_COLOR = 0x39415a;

interface SlotSprite {
  setFillStyle(color: number, alpha?: number): unknown;
  setStrokeStyle(width: number, color: number, alpha?: number): unknown;
  destroy(): void;
}

function jobDone(sim: SimulationLedger, jobId: string): boolean {
  try {
    return sim.isJobComplete(jobId);
  } catch {
    return false;
  }
}

function jobRemaining(sim: SimulationLedger, jobId: string): number {
  return Math.round(sim.listJobs().find((job) => job.id === jobId)?.remainingMs ?? 0);
}

function zeroResource(sim: SimulationLedger, resourceId: string): void {
  const amount = sim.resource(resourceId);
  if (amount !== 0) sim.addResource(resourceId, -amount);
}

function wrap(index: number, length: number): number {
  return ((index % length) + length) % length;
}

export function bindStarterSimulation(
  context: SceneContext,
  options?: { readonly mode?: SimulationStarterMode | null; readonly hud?: boolean },
): StarterSimulationBinding {
  const mode = options?.mode ?? null;
  if (mode !== 'farm' && mode !== 'colony') return INERT;
  if (!context.capabilities.has(SIMULATION_CAPABILITY_ID)) return INERT;
  const sim = context.capabilities.require<SimulationLedger>(SIMULATION_CAPABILITY_ID);

  const jobIds = mode === 'farm' ? [...PLOT_IDS] : [...WORKER_IDS, CONSTRUCT_ID];
  for (const id of jobIds) sim.cancelJob(id);
  zeroResource(sim, 'crops');
  zeroResource(sim, 'materials');

  const hud = options?.hud !== false;
  const scene = context.scene;
  const { width, height } = context.definition.viewport;
  const slotCount = 3;

  const title = hud ? scene.add.text(width * 0.5, 28, '', headingStyle(20)).setOrigin(0.5).setScrollFactor(0).setDepth(50) : null;
  const status = hud ? scene.add.text(width * 0.5, 54, '', mutedStyle(14)).setOrigin(0.5).setScrollFactor(0).setDepth(50) : null;
  const hint = hud ? scene.add.text(width * 0.5, height - 28, '', accentStyle(14)).setOrigin(0.5).setScrollFactor(0).setDepth(50) : null;

  const slots: SlotSprite[] = [];
  const labels: { setText(value: string): unknown; destroy(): void }[] = [];
  if (hud) {
    for (let i = 0; i < slotCount; i++) {
      const x = width * 0.5 + (i - 1) * 220;
      const rect = scene.add.rectangle(x, height * 0.5, 160, 120, EMPTY_COLOR, 0.95).setStrokeStyle(2, 0x8a93a6, 0.9).setScrollFactor(0).setDepth(20);
      slots.push(rect);
      labels.push(scene.add.text(x, height * 0.5 + 88, '', mutedStyle(14)).setOrigin(0.5).setScrollFactor(0).setDepth(21));
    }
  }

  const plots: Array<{ phase: StarterSimulationPlot['phase'] }> = [
    { phase: 'empty' },
    { phase: 'empty' },
    { phase: 'empty' },
  ];
  const workers: Array<{ busy: boolean }> = [{ busy: false }, { busy: false }];
  let selectedIndex = 0;
  let constructing = false;
  let built = false;
  let lastResult: string | null = null;
  let outcome: 'playing' | 'complete' = 'playing';
  let disposed = false;

  function snapshot(): StarterSimulationSnapshot {
    return {
      active: true,
      mode,
      selectedIndex,
      crops: sim.resource('crops'),
      materials: sim.resource('materials'),
      plots: plots.map((plot, index) => ({
        phase: plot.phase,
        remainingMs: jobRemaining(sim, PLOT_IDS[index]!),
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
        slot.setFillStyle(plot?.phase === 'ripe' ? RIPE_COLOR : plot?.phase === 'growing' ? GROWING_COLOR : EMPTY_COLOR, 0.95);
        labels[i]?.setText(
          plot?.phase === 'ripe' ? `PLOT ${i + 1} RIPE` : plot?.phase === 'growing' ? `PLOT ${i + 1} GROWING` : `PLOT ${i + 1} EMPTY`,
        );
      } else if (i < 2) {
        const worker = snap.workers[i];
        slot.setFillStyle(worker?.busy ? GROWING_COLOR : IDLE_COLOR, 0.95);
        labels[i]?.setText(worker?.busy ? `WORKER ${i + 1} BUSY` : `WORKER ${i + 1} IDLE`);
      } else {
        slot.setFillStyle(snap.built ? RIPE_COLOR : snap.constructing ? GROWING_COLOR : BUILD_COLOR, 0.95);
        labels[i]?.setText(snap.built ? 'HALL BUILT' : snap.constructing ? 'BUILDING' : 'BUILD HALL');
      }
    }
    if (!title || !status || !hint) return;
    if (mode === 'farm') {
      title.setText(snap.outcome === 'complete' ? 'HARVESTED' : 'FARM');
      status.setText(
        `crops ${snap.crops}/${HARVEST_TARGET}${snap.lastResult ? `  ·  ${snap.lastResult}` : ''}${
          snap.outcome === 'complete' ? '  ·  complete' : ''
        }`,
      );
      hint.setText('ARROWS PICK A PLOT   ENTER PLANTS OR HARVESTS');
    } else {
      title.setText(snap.outcome === 'complete' ? 'BUILT' : 'COLONY');
      status.setText(
        `materials ${snap.materials}${snap.lastResult ? `  ·  ${snap.lastResult}` : ''}${
          snap.outcome === 'complete' ? '  ·  complete' : ''
        }`,
      );
      hint.setText('ARROWS PICK A JOB   ENTER ASSIGNS OR BUILDS');
    }
  }

  function plantOrHarvest(): void {
    const plot = plots[selectedIndex];
    if (!plot) return;
    if (plot.phase === 'growing') {
      lastResult = 'growing';
      return;
    }
    if (plot.phase === 'ripe') {
      sim.addResource('crops', 1);
      sim.cancelJob(PLOT_IDS[selectedIndex]!);
      plot.phase = 'empty';
      lastResult = 'harvested';
      if (sim.resource('crops') >= HARVEST_TARGET) outcome = 'complete';
      return;
    }
    sim.queueJob(PLOT_IDS[selectedIndex]!, GROW_MS);
    plot.phase = 'growing';
    lastResult = 'planted';
  }

  function assignOrBuild(): void {
    if (selectedIndex < 2) {
      const worker = workers[selectedIndex];
      if (!worker) return;
      if (worker.busy) {
        lastResult = 'busy';
        return;
      }
      sim.queueJob(WORKER_IDS[selectedIndex]!, GATHER_MS);
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
    if (mode === 'farm') {
      for (let i = 0; i < plots.length; i++) {
        const plot = plots[i]!;
        if (plot.phase === 'growing' && jobDone(sim, PLOT_IDS[i]!)) plot.phase = 'ripe';
      }
      return;
    }
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
      if (disposed) return;
      selectedIndex = wrap(selectedIndex + delta, slotCount);
      paint();
    },
    confirm(): void {
      if (disposed) return;
      if (mode === 'farm') plantOrHarvest();
      else assignOrBuild();
      context.audio.playCue('ui.confirm');
      paint();
    },
    tick(_deltaMs: number): void {
      if (disposed) return;
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
