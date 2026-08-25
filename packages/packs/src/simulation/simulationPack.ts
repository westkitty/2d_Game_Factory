import type { EventBus, GameContext, InstalledSystemPack, SystemPackDefinition } from '@sw2d/contracts';
import { CAPABILITY_IDS, PACK_IDS } from '../ids.ts';

/**
 * Simulation pack: a deterministic resource ledger plus a timed-job
 * primitive, stepped through `update(deltaMs)`. No farms, shops,
 * restaurants, colonies, needs AI or tycoon UI here.
 *
 * Deliberately distinct from the progression pack: this is moment-to-moment
 * gameplay resource state (a job queue ticking down), not meta-progression
 * carried across runs.
 */

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
}

export class UnknownSimulationJobError extends Error {
  constructor(jobId: string) {
    super(`No simulation job queued with id "${jobId}".`);
    this.name = 'UnknownSimulationJobError';
  }
}

class SimulationServiceImpl implements SimulationService {
  readonly #resources = new Map<string, number>();
  readonly #jobs = new Map<string, SimulationJob>();
  readonly #completed = new Set<string>();
  readonly #events: EventBus;

  constructor(events: EventBus) {
    this.#events = events;
  }

  resource(resourceId: string): number {
    return this.#resources.get(resourceId) ?? 0;
  }

  addResource(resourceId: string, delta: number): number {
    const next = Math.max(0, this.resource(resourceId) + delta);
    this.#resources.set(resourceId, next);
    this.#events.emit('simulation:resourceChanged', { resourceId, amount: next, delta });
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

  tick(deltaMs: number): void {
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
}

export const simulationPack: SystemPackDefinition<undefined, GameContext> = {
  id: PACK_IDS.simulation,
  version: '0.1.0',
  provides: [CAPABILITY_IDS.simulation],
  dependencies: [],

  install(context: GameContext): InstalledSystemPack {
    const service = new SimulationServiceImpl(context.events);
    const handle = context.capabilities.provide(CAPABILITY_IDS.simulation, service);

    return {
      id: PACK_IDS.simulation,
      update(deltaMs: number): void {
        service.tick(deltaMs);
      },
      dispose(): void {
        handle.dispose();
      },
    };
  },
};
