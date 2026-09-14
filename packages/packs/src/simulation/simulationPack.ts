import type {
  EventBus,
  GameContext,
  InstalledSystemPack,
  SaveStore,
  SimulationCatalog,
  SimulationCatchUpResult,
  SimulationCropDef,
  SimulationPlotResult,
  SimulationPlotState,
  SimulationPrestigeResult,
  SystemPackDefinition,
  VersionedRecord,
} from '@sw2d/contracts';
import { CAPABILITY_IDS, PACK_IDS } from '../ids.ts';

/**
 * Simulation pack: a deterministic resource ledger plus a timed-job
 * primitive, stepped through `update(deltaMs)`. Catalog fields opt into
 * persistence, bounded offline catch-up, prestige and a plot framework.
 * No shops, restaurants, colonies or needs AI here.
 *
 * Deliberately distinct from the progression pack: this is moment-to-moment
 * gameplay resource state (a job queue ticking down), not meta-progression
 * carried across runs.
 */

export const SIMULATION_SAVE_SLOT = 'simulation';
const SAVE_VERSION = 1;
const DEFAULT_DISCONTINUITY_MS = 7 * 24 * 60 * 60 * 1000;

export interface SimulationJob {
  readonly id: string;
  readonly remainingMs: number;
  readonly totalMs: number;
}

export class DuplicateSimulationJobError extends Error {
  constructor(jobId: string) {
    super(`Simulation job "${jobId}" is already queued.`);
    this.name = 'DuplicateSimulationJobError';
  }
}

export interface SimulationService {
  resource(resourceId: string): number;
  /** Clamped so a resource never goes negative; returns the new amount. */
  addResource(resourceId: string, delta: number): number;

  queueJob(jobId: string, durationMs: number): void;
  /** True once `update(deltaMs)` has ticked this job's remaining time to 0. Throws for an unknown job id. */
  isJobComplete(jobId: string): boolean;
  cancelJob(jobId: string): boolean;
  listJobs(): readonly SimulationJob[];

  formatAmount(amount: number): string;
  productionRate(resourceId: string): number;
  setProductionRate(resourceId: string, ratePerSecond: number): void;
  prestigeLevel(): number;
  prestigeMultiplier(): number;
  prestige(): SimulationPrestigeResult;
  catchUp(nowMs: number): SimulationCatchUpResult;
  lastSeenWallClockMs(): number;
  recordWallClock(nowMs: number): void;

  plots(): readonly SimulationPlotState[];
  plant(plotIndex: number, cropId?: string): SimulationPlotResult;
  water(plotIndex: number): SimulationPlotResult;
  harvest(plotIndex: number): SimulationPlotResult;
  workPlot(plotIndex: number): SimulationPlotResult;
  season(): string | null;
  harvestTarget(): number;
}

export class UnknownSimulationJobError extends Error {
  constructor(jobId: string) {
    super(`No simulation job queued with id "${jobId}".`);
    this.name = 'UnknownSimulationJobError';
  }
}

interface MutablePlot {
  readonly id: string;
  phase: SimulationPlotState['phase'];
  remainingMs: number;
  cropId: string | null;
}

interface SimulationSave extends VersionedRecord {
  readonly resources: Record<string, number>;
  readonly rates: Record<string, number>;
  readonly prestigeLevel: number;
  readonly lastSeenWallClockMs: number;
  readonly plots: readonly {
    readonly id: string;
    readonly phase: SimulationPlotState['phase'];
    readonly remainingMs: number;
    readonly cropId: string | null;
  }[];
  readonly seasonIndex: number;
  readonly seasonElapsedMs: number;
}

export function formatSimulationAmount(amount: number): string {
  if (!Number.isFinite(amount)) return '0';
  const sign = amount < 0 ? '-' : '';
  const abs = Math.abs(amount);
  if (abs < 1000) {
    const rounded = Math.round(abs * 10) / 10;
    return `${sign}${Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)}`;
  }
  const units = ['', 'K', 'M', 'B', 'T'] as const;
  let value = abs;
  let unit = 0;
  while (value >= 1000 && unit < units.length - 1) {
    value /= 1000;
    unit += 1;
  }
  const digits = value >= 100 ? value.toFixed(0) : value >= 10 ? value.toFixed(1) : value.toFixed(2);
  return `${sign}${digits.replace(/\.?0+$/, '')}${units[unit]}`;
}

class SimulationServiceImpl implements SimulationService {
  readonly #resources = new Map<string, number>();
  readonly #rates = new Map<string, number>();
  readonly #jobs = new Map<string, SimulationJob>();
  readonly #completed = new Set<string>();
  readonly #events: EventBus;
  readonly #catalog: SimulationCatalog | undefined;
  readonly #saves: SaveStore | undefined;
  readonly #plots: MutablePlot[] = [];
  readonly #crops: readonly SimulationCropDef[];
  #prestigeLevel = 0;
  #lastSeenWallClockMs: number | null = null;
  #seasonIndex = 0;
  #seasonElapsedMs = 0;

  constructor(events: EventBus, catalog: SimulationCatalog | undefined, saves: SaveStore | undefined) {
    this.#events = events;
    this.#catalog = catalog;
    this.#saves = catalog?.persist === true ? saves : undefined;
    this.#crops = catalog?.crops ?? [];
    for (const resource of catalog?.resources ?? []) {
      this.#resources.set(resource.id, Math.max(0, resource.amount ?? 0));
      if (resource.ratePerSecond !== undefined) this.#rates.set(resource.id, resource.ratePerSecond);
    }
    for (const plot of catalog?.plots ?? []) {
      this.#plots.push({ id: plot.id, phase: 'empty', remainingMs: 0, cropId: null });
    }
    this.#restore();
  }

  resource(resourceId: string): number {
    return this.#resources.get(resourceId) ?? 0;
  }

  addResource(resourceId: string, delta: number): number {
    const next = Math.max(0, this.resource(resourceId) + delta);
    this.#resources.set(resourceId, next);
    this.#events.emit('simulation:resourceChanged', { resourceId, amount: next, delta });
    this.#persist();
    return next;
  }

  queueJob(jobId: string, durationMs: number): void {
    if (this.#jobs.has(jobId)) throw new DuplicateSimulationJobError(jobId);
    if (!Number.isFinite(durationMs) || durationMs < 0) {
      throw new RangeError(`durationMs must be a finite number >= 0, got ${durationMs}.`);
    }
    this.#completed.delete(jobId);
    this.#jobs.set(jobId, { id: jobId, remainingMs: durationMs, totalMs: durationMs });
  }

  isJobComplete(jobId: string): boolean {
    if (!this.#jobs.has(jobId) && !this.#completed.has(jobId)) throw new UnknownSimulationJobError(jobId);
    return this.#completed.has(jobId);
  }

  cancelJob(jobId: string): boolean {
    return this.#jobs.delete(jobId) || this.#completed.delete(jobId);
  }

  listJobs(): readonly SimulationJob[] {
    return [...this.#jobs.values()].sort((a, b) => a.id.localeCompare(b.id));
  }

  formatAmount(amount: number): string {
    return formatSimulationAmount(amount);
  }

  productionRate(resourceId: string): number {
    return this.#rates.get(resourceId) ?? 0;
  }

  setProductionRate(resourceId: string, ratePerSecond: number): void {
    this.#rates.set(resourceId, Math.max(0, ratePerSecond));
    this.#persist();
  }

  prestigeLevel(): number {
    return this.#prestigeLevel;
  }

  prestigeMultiplier(): number {
    const step = this.#catalog?.prestige?.multiplier ?? 2;
    return step ** this.#prestigeLevel;
  }

  prestige(): SimulationPrestigeResult {
    const rule = this.#catalog?.prestige;
    if (!rule) return { ok: false, reason: 'no-prestige', level: this.#prestigeLevel, multiplier: this.prestigeMultiplier() };
    if (this.resource(rule.resourceId) < rule.cost) {
      return { ok: false, reason: 'cannot-afford', level: this.#prestigeLevel, multiplier: this.prestigeMultiplier() };
    }
    this.addResource(rule.resourceId, -this.resource(rule.resourceId));
    this.#prestigeLevel += 1;
    this.#events.emit('simulation:prestiged', {
      level: this.#prestigeLevel,
      multiplier: this.prestigeMultiplier(),
    });
    this.#persist();
    return { ok: true, reason: 'prestiged', level: this.#prestigeLevel, multiplier: this.prestigeMultiplier() };
  }

  catchUp(nowMs: number): SimulationCatchUpResult {
    if (!this.#catalog?.offline || !this.#saves) {
      this.#lastSeenWallClockMs = nowMs;
      return { appliedMs: 0, skipped: false, reason: 'disabled' };
    }
    if (this.#lastSeenWallClockMs === null) {
      this.#lastSeenWallClockMs = nowMs;
      this.#persist();
      return { appliedMs: 0, skipped: false, reason: 'none' };
    }
    const elapsed = nowMs - this.#lastSeenWallClockMs;
    if (elapsed < 0) {
      this.#lastSeenWallClockMs = nowMs;
      this.#persist();
      return { appliedMs: 0, skipped: true, reason: 'backwards' };
    }
    const discontinuity = this.#catalog.offline.discontinuityMs ?? DEFAULT_DISCONTINUITY_MS;
    if (elapsed > discontinuity) {
      this.#lastSeenWallClockMs = nowMs;
      this.#persist();
      return { appliedMs: 0, skipped: true, reason: 'discontinuity' };
    }
    if (elapsed === 0) return { appliedMs: 0, skipped: false, reason: 'none' };
    const appliedMs = Math.min(elapsed, this.#catalog.offline.maxMs);
    this.#produce(appliedMs);
    this.#growPlots(appliedMs);
    this.#lastSeenWallClockMs = nowMs;
    this.#persist();
    return { appliedMs, skipped: false, reason: 'applied' };
  }

  lastSeenWallClockMs(): number {
    return this.#lastSeenWallClockMs ?? 0;
  }

  recordWallClock(nowMs: number): void {
    this.#lastSeenWallClockMs = nowMs;
    this.#persist();
  }

  plots(): readonly SimulationPlotState[] {
    return this.#plots.map((plot) => ({
      id: plot.id,
      phase: plot.phase,
      remainingMs: Math.round(plot.remainingMs),
      cropId: plot.cropId,
    }));
  }

  plant(plotIndex: number, cropId?: string): SimulationPlotResult {
    const plot = this.#plots[plotIndex];
    if (!plot) return { ok: false, reason: 'invalid-plot' };
    if (plot.phase !== 'empty') return { ok: false, reason: plot.phase };
    const crop = this.#crop(cropId) ?? this.#crops[0];
    if (!crop) return { ok: false, reason: 'no-crop' };
    plot.cropId = crop.id;
    const growMs = crop.growMs * this.#growScale();
    if (crop.waterRequired) {
      plot.phase = 'dry';
      plot.remainingMs = growMs;
      this.#persist();
      return { ok: true, reason: 'planted' };
    }
    plot.phase = 'growing';
    plot.remainingMs = growMs;
    this.#persist();
    return { ok: true, reason: 'planted' };
  }

  water(plotIndex: number): SimulationPlotResult {
    const plot = this.#plots[plotIndex];
    if (!plot) return { ok: false, reason: 'invalid-plot' };
    if (plot.phase !== 'dry') return { ok: false, reason: plot.phase };
    plot.phase = 'growing';
    this.#persist();
    return { ok: true, reason: 'watered' };
  }

  harvest(plotIndex: number): SimulationPlotResult {
    const plot = this.#plots[plotIndex];
    if (!plot) return { ok: false, reason: 'invalid-plot' };
    if (plot.phase === 'growing' || plot.phase === 'dry') return { ok: false, reason: 'growing' };
    if (plot.phase !== 'ripe') return { ok: false, reason: plot.phase };
    const crop = this.#crop(plot.cropId ?? undefined);
    const resourceId = crop?.resourceId ?? 'crops';
    this.addResource(resourceId, crop?.yield ?? 1);
    if (crop?.regrow) {
      plot.phase = 'growing';
      plot.remainingMs = (crop.growMs ?? 0) * this.#growScale();
    } else {
      plot.phase = 'empty';
      plot.remainingMs = 0;
      plot.cropId = null;
    }
    this.#persist();
    return { ok: true, reason: 'harvested' };
  }

  workPlot(plotIndex: number): SimulationPlotResult {
    const plot = this.#plots[plotIndex];
    if (!plot) return { ok: false, reason: 'invalid-plot' };
    if (plot.phase === 'empty') return this.plant(plotIndex);
    if (plot.phase === 'dry') return this.water(plotIndex);
    if (plot.phase === 'ripe') return this.harvest(plotIndex);
    return { ok: false, reason: 'growing' };
  }

  season(): string | null {
    return this.#catalog?.seasons?.[this.#seasonIndex]?.id ?? null;
  }

  harvestTarget(): number {
    return this.#catalog?.harvestTarget ?? 3;
  }

  tick(deltaMs: number): void {
    const dt = Number.isFinite(deltaMs) && deltaMs > 0 ? deltaMs : 0;
    this.#produce(dt);
    this.#tickJobs(dt);
    this.#growPlots(dt);
    this.#tickSeasons(dt);
  }

  #produce(deltaMs: number): void {
    if (deltaMs <= 0 || this.#rates.size === 0) return;
    const scale = this.prestigeMultiplier() * (deltaMs / 1000);
    for (const [id, rate] of this.#rates) {
      if (rate <= 0) continue;
      const current = this.resource(id);
      const next = current + rate * scale;
      this.#resources.set(id, next);
      this.#events.emit('simulation:resourceChanged', { resourceId: id, amount: next, delta: next - current });
    }
  }

  #tickJobs(deltaMs: number): void {
    for (const job of this.#jobs.values()) {
      const remainingMs = Math.max(0, job.remainingMs - deltaMs);
      if (remainingMs === 0) {
        this.#jobs.delete(job.id);
        this.#completed.add(job.id);
      } else {
        this.#jobs.set(job.id, { ...job, remainingMs });
      }
    }
  }

  #growPlots(deltaMs: number): void {
    if (this.#plots.length === 0 || deltaMs <= 0) return;
    const scale = this.#growScale();
    for (const plot of this.#plots) {
      if (plot.phase !== 'growing') continue;
      plot.remainingMs = Math.max(0, plot.remainingMs - deltaMs * scale);
      if (plot.remainingMs === 0) plot.phase = 'ripe';
    }
  }

  #tickSeasons(deltaMs: number): void {
    const seasons = this.#catalog?.seasons;
    if (!seasons || seasons.length === 0 || deltaMs <= 0) return;
    this.#seasonElapsedMs += deltaMs;
    let current = seasons[this.#seasonIndex];
    while (current && this.#seasonElapsedMs >= current.durationMs) {
      this.#seasonElapsedMs -= current.durationMs;
      this.#seasonIndex = (this.#seasonIndex + 1) % seasons.length;
      current = seasons[this.#seasonIndex];
    }
  }

  #growScale(): number {
    return this.#catalog?.seasons?.[this.#seasonIndex]?.growScale ?? 1;
  }

  #crop(cropId: string | undefined): SimulationCropDef | undefined {
    if (cropId) return this.#crops.find((crop) => crop.id === cropId);
    return this.#crops[0];
  }

  #restore(): void {
    if (!this.#saves) return;
    const loaded = this.#saves.load<SimulationSave>(SIMULATION_SAVE_SLOT, {
      currentVersion: SAVE_VERSION,
      createDefault: () => this.#snapshot(),
    });
    if (loaded.outcome !== 'loaded' && loaded.outcome !== 'migrated') return;
    const saved = loaded.value;
    this.#resources.clear();
    for (const [id, amount] of Object.entries(saved.resources)) this.#resources.set(id, amount);
    this.#rates.clear();
    for (const [id, rate] of Object.entries(saved.rates)) this.#rates.set(id, rate);
    this.#prestigeLevel = saved.prestigeLevel;
    this.#lastSeenWallClockMs = saved.lastSeenWallClockMs;
    this.#seasonIndex = saved.seasonIndex;
    this.#seasonElapsedMs = saved.seasonElapsedMs;
    for (const plot of this.#plots) {
      const match = saved.plots.find((entry) => entry.id === plot.id);
      if (!match) continue;
      plot.phase = match.phase;
      plot.remainingMs = match.remainingMs;
      plot.cropId = match.cropId;
    }
  }

  #snapshot(): SimulationSave {
    const resources: Record<string, number> = {};
    for (const [id, amount] of this.#resources) resources[id] = amount;
    const rates: Record<string, number> = {};
    for (const [id, rate] of this.#rates) rates[id] = rate;
    return {
      schemaVersion: SAVE_VERSION,
      resources,
      rates,
      prestigeLevel: this.#prestigeLevel,
      lastSeenWallClockMs: this.#lastSeenWallClockMs ?? 0,
      plots: this.#plots.map((plot) => ({
        id: plot.id,
        phase: plot.phase,
        remainingMs: plot.remainingMs,
        cropId: plot.cropId,
      })),
      seasonIndex: this.#seasonIndex,
      seasonElapsedMs: this.#seasonElapsedMs,
    };
  }

  #persist(): void {
    this.#saves?.save<SimulationSave>(SIMULATION_SAVE_SLOT, this.#snapshot());
  }
}

export const simulationPack: SystemPackDefinition<undefined, GameContext> = {
  id: PACK_IDS.simulation,
  version: '0.1.0',
  provides: [CAPABILITY_IDS.simulation],
  dependencies: [],

  install(context: GameContext): InstalledSystemPack {
    const catalog = context.content?.data?.['simulation']?.value as SimulationCatalog | undefined;
    const service = new SimulationServiceImpl(context.events, catalog, context.saves);
    if (catalog?.offline && context.saves) service.catchUp(Date.now());
    const handle = context.capabilities.provide(CAPABILITY_IDS.simulation, service);

    return {
      id: PACK_IDS.simulation,
      update(deltaMs: number): void {
        service.tick(deltaMs);
      },
      dispose(): void {
        if (catalog?.persist === true) service.recordWallClock(Date.now());
        handle.dispose();
      },
    };
  },
};
