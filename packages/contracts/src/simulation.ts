/**
 * Resource ledger, timed jobs, offline catch-up, prestige and plot growth
 * (Final Product Completion Wave 6).
 *
 * Renderer-neutral. The pack remains a resource ledger plus a timed-job
 * primitive; catalog fields opt into persistence, wall-clock catch-up,
 * prestige and a bounded plot framework. No shops, restaurants or colony AI.
 */

export const SIMULATION_CAPABILITY_ID = 'simulation.resources';

export type SimulationPlotPhase = 'empty' | 'dry' | 'growing' | 'ripe';

export interface SimulationResourceDef {
  readonly id: string;
  readonly amount?: number;
  readonly ratePerSecond?: number;
}

export interface SimulationOfflineDef {
  /** Maximum wall-clock ms applied on catch-up. */
  readonly maxMs: number;
  /** Elapsed larger than this is treated as a clock discontinuity and skipped. */
  readonly discontinuityMs?: number;
}

export interface SimulationPrestigeDef {
  readonly resourceId: string;
  readonly cost: number;
  readonly multiplier: number;
}

export interface SimulationPlotDef {
  readonly id: string;
}

export interface SimulationCropDef {
  readonly id: string;
  readonly growMs: number;
  readonly waterRequired?: boolean;
  readonly yield?: number;
  readonly regrow?: boolean;
  readonly resourceId?: string;
}

export interface SimulationSeasonDef {
  readonly id: string;
  readonly durationMs: number;
  readonly growScale?: number;
}

/** The validated `content/simulation.json` document. */
export interface SimulationCatalog {
  readonly schemaVersion: number;
  readonly persist?: boolean;
  readonly resources?: readonly SimulationResourceDef[];
  readonly offline?: SimulationOfflineDef;
  readonly prestige?: SimulationPrestigeDef;
  readonly plots?: readonly SimulationPlotDef[];
  readonly crops?: readonly SimulationCropDef[];
  readonly seasons?: readonly SimulationSeasonDef[];
  readonly harvestTarget?: number;
}

export interface SimulationPlotState {
  readonly id: string;
  readonly phase: SimulationPlotPhase;
  readonly remainingMs: number;
  readonly cropId: string | null;
}

export interface SimulationCatchUpResult {
  readonly appliedMs: number;
  readonly skipped: boolean;
  readonly reason: 'applied' | 'none' | 'backwards' | 'discontinuity' | 'disabled';
}

export interface SimulationPrestigeResult {
  readonly ok: boolean;
  readonly reason: 'prestiged' | 'cannot-afford' | 'no-prestige';
  readonly level: number;
  readonly multiplier: number;
}

export interface SimulationPlotResult {
  readonly ok: boolean;
  readonly reason: string;
}
