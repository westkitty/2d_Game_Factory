import {
  NEEDS_CAPABILITY_ID,
  NAV_CAPABILITY_ID,
  createRouteFollower,
  type NeedsService,
  type NavGrid,
  type NavService,
  type RouteFollower,
} from '@sw2d/contracts';
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
  readonly id: string;
  readonly busy: boolean;
  readonly remainingMs: number;
  readonly phase: 'idle' | 'traveling' | 'working' | 'building';
  readonly job: string | null;
  readonly assignmentReason: string;
  readonly x: number;
  readonly y: number;
  readonly hunger: number;
  readonly rest: number;
  readonly pathLength: number;
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
  readonly outcome: 'playing' | 'complete' | 'failed';
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
const GATHER_MS_COLONY = 320;
const CONSTRUCT_MS = 480;
const BUILD_WOOD_COST = 2;
const BUILD_STONE_COST = 1;

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

interface ColonyWorker {
  readonly id: string;
  readonly follower: RouteFollower;
  phase: StarterSimulationWorker['phase'];
  job: 'wood' | 'stone' | 'construct' | null;
  assignmentReason: string;
  x: number;
  y: number;
  pathLength: number;
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
  const colonyNeeds = mode === 'colony' && context.capabilities.has(NEEDS_CAPABILITY_ID)
    ? context.capabilities.require<NeedsService>(NEEDS_CAPABILITY_ID)
    : null;
  const navigation = mode === 'colony' && context.capabilities.has(NAV_CAPABILITY_ID)
    ? context.capabilities.require<NavService>(NAV_CAPABILITY_ID)
    : null;

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

  const colonyGrid: NavGrid | null = navigation?.defineGrid('starter-colony', {
    cols: 12,
    rows: 6,
    cellSize: 64,
    originX: 110,
    originY: 100,
    blocked: [[5, 2], [5, 3]],
  }) ?? null;
  const colonyWorkers: ColonyWorker[] = (colonyNeeds?.creatures() ?? []).map((creature) => ({
    id: creature.id,
    follower: createRouteFollower(),
    phase: 'idle',
    job: null,
    assignmentReason: 'ready',
    x: creature.x,
    y: creature.y,
    pathLength: 0,
  }));
  const workerVisuals = hud && mode === 'colony'
    ? colonyWorkers.map((worker, index) => ({
        body: scene.add.circle(worker.x, worker.y, 16, [0x65d0a8, 0x7aa2f7, 0xf0c274][index % 3]!, 1).setDepth(30),
        label: scene.add.text(worker.x, worker.y + 24, worker.id.toUpperCase(), mutedStyle(11)).setOrigin(0.5).setDepth(31),
      }))
    : [];
  let selectedIndex = 0;
  let constructing = false;
  let built = false;
  let lastResult: string | null = null;
  let outcome: 'playing' | 'complete' | 'failed' = 'playing';
  let disposed = false;
  let gatherActive = false;
  const offlineAppliedMs = sim.catchUp(Date.now()).appliedMs;

  function snapshot(): StarterSimulationSnapshot {
    const packPlots = sim.plots();
    const creatureById = new Map((colonyNeeds?.creatures() ?? []).map((creature) => [creature.id, creature]));
    return {
      active: true,
      mode,
      selectedIndex,
      crops: sim.resource('crops'),
      materials: mode === 'colony' ? sim.resource('wood') + sim.resource('stone') : sim.resource('materials'),
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
      workers: colonyWorkers.map((worker) => {
        const creature = creatureById.get(worker.id);
        const values = new Map(creature?.needs.map((need) => [need.id, need.value]) ?? []);
        const jobId = worker.job ? `${worker.id}-${worker.job}` : '';
        return {
          id: worker.id,
          busy: worker.phase !== 'idle',
          remainingMs: jobId ? jobRemaining(sim, jobId) : 0,
          phase: worker.phase,
          job: worker.job,
          assignmentReason: worker.assignmentReason,
          x: worker.x,
          y: worker.y,
          hunger: values.get('hunger') ?? 0,
          rest: values.get('rest') ?? 0,
          pathLength: worker.pathLength,
        };
      }),
      constructing,
      constructRemainingMs: Math.max(0, ...colonyWorkers.filter((worker) => worker.job === 'construct').map((worker) => jobRemaining(sim, `${worker.id}-construct`))),
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
      } else if (mode === 'colony') {
        const names = ['WOOD PRIORITY', 'STONE PRIORITY', snap.built ? 'HALL BUILT' : snap.constructing ? 'BUILDING HALL' : 'PLACE HALL'];
        slot.setFillStyle(i === 2 ? (snap.built ? RIPE_COLOR : snap.constructing ? GROWING_COLOR : BUILD_COLOR) : IDLE_COLOR, 0.95);
        labels[i]?.setText(names[i] ?? 'COLONY');
      }
    }
    for (let index = 0; index < workerVisuals.length; index++) {
      const visual = workerVisuals[index];
      const worker = snap.workers[index];
      if (!visual || !worker) continue;
      visual.body.setPosition(worker.x, worker.y);
      visual.label.setPosition(worker.x, worker.y + 24).setText(`${worker.id.toUpperCase()} ${worker.job ?? 'ready'}`);
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
      `wood ${sim.resource('wood')}  ·  stone ${sim.resource('stone')}  ·  ${snap.workers.map((worker) => `${worker.id}:${worker.phase}`).join(' ')}${snap.lastResult ? `  ·  ${snap.lastResult}` : ''}${
        snap.outcome === 'complete' ? '  ·  complete' : ''
      }`,
    );
    hint.setText('ARROWS SET JOB PRIORITY   ENTER ASSIGNS OR PLACES THE HALL');
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
    if (!colonyGrid || colonyWorkers.length === 0) {
      lastResult = 'missing-colony-systems';
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
    const idle = colonyWorkers
      .filter((worker) => worker.phase === 'idle')
      .sort((a, b) => {
        const creatures = colonyNeeds?.creatures() ?? [];
        const an = creatures.find((creature) => creature.id === a.id)?.needs.reduce((sum, need) => sum + need.value, 0) ?? 0;
        const bn = creatures.find((creature) => creature.id === b.id)?.needs.reduce((sum, need) => sum + need.value, 0) ?? 0;
        return bn - an || a.id.localeCompare(b.id);
      })[0];
    if (!idle) {
      lastResult = 'busy';
      return;
    }
    const job: ColonyWorker['job'] = selectedIndex === 0 ? 'wood' : selectedIndex === 1 ? 'stone' : 'construct';
    if (job === 'construct') {
      if (sim.resource('wood') < BUILD_WOOD_COST || sim.resource('stone') < BUILD_STONE_COST) {
        lastResult = 'need-resources';
        return;
      }
      sim.addResource('wood', -BUILD_WOOD_COST);
      sim.addResource('stone', -BUILD_STONE_COST);
      constructing = true;
    }
    const target = job === 'wood' ? { col: 1, row: 1 } : job === 'stone' ? { col: 10, row: 1 } : { col: 6, row: 3 };
    const found = idle.follower.setDestination(colonyGrid, idle.x, idle.y, target.col, target.row);
    if (!found) {
      lastResult = 'path-blocked';
      constructing = false;
      if (job === 'construct') {
        sim.addResource('wood', BUILD_WOOD_COST);
        sim.addResource('stone', BUILD_STONE_COST);
      }
      return;
    }
    idle.job = job;
    idle.phase = 'traveling';
    idle.pathLength = idle.follower.path?.points.length ?? 0;
    idle.assignmentReason = `priority:${job}`;
    lastResult = 'assigned';
  }

  function poll(deltaMs: number): void {
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
    for (const worker of colonyWorkers) {
      if (worker.phase === 'traveling') {
        const step = worker.follower.step(worker.x, worker.y, 150 * Math.max(0, deltaMs) / 1000);
        worker.x = step.x;
        worker.y = step.y;
        if (step.arrived && worker.job) {
          worker.phase = worker.job === 'construct' ? 'building' : 'working';
          sim.queueJob(`${worker.id}-${worker.job}`, worker.job === 'construct' ? CONSTRUCT_MS : GATHER_MS_COLONY);
          lastResult = 'working';
        }
      } else if ((worker.phase === 'working' || worker.phase === 'building') && worker.job) {
        const jobId = `${worker.id}-${worker.job}`;
        if (jobDone(sim, jobId)) {
          sim.cancelJob(jobId);
          if (worker.job === 'construct') {
            constructing = false;
            built = true;
            outcome = 'complete';
            lastResult = 'built';
          } else {
            sim.addResource(worker.job, 1);
            lastResult = `gathered-${worker.job}`;
          }
          worker.phase = 'idle';
          worker.job = null;
        }
      }
    }
    if ((colonyNeeds?.creatures() ?? []).some((creature) => creature.needs.some((need) => need.value <= 5))) {
      outcome = 'failed';
      lastResult = 'colonist-need-failed';
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
      poll(deltaMs);
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
        for (const visual of workerVisuals) {
          visual.body.destroy();
          visual.label.destroy();
        }
        navigation?.remove('starter-colony');
      } catch {
        /* scene already tearing down */
      }
    },
  };
}
