/**
 * Reusable race / checkpoint / lap state (capability program Phase 10).
 *
 * Renderer-neutral, simulation-time (never wall-clock). Separate from vehicle
 * motion (vehicles.ts): this owns ordered checkpoints, laps, the countdown,
 * and time-trial timing. Crossing checkpoints out of order never advances the
 * race - no shortcut completion.
 */

export const RACE_STATE_CAPABILITY_ID = 'race.state';

export type RaceMode = 'race' | 'time-trial';

export interface RaceCheckpointDefinition {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  /** Trigger radius. */
  readonly radius: number;
}

export interface RaceStartPosition {
  readonly x: number;
  readonly y: number;
  readonly heading: number;
}

export interface RaceDefinition {
  readonly schemaVersion: number;
  readonly id: string;
  readonly mode: RaceMode;
  readonly startPositions: readonly RaceStartPosition[];
  readonly countdownMs: number;
  /** Ordered. The last one crossed validly completes a lap. */
  readonly checkpoints: readonly RaceCheckpointDefinition[];
  readonly laps: number;
}

export type RacePhase = 'idle' | 'countdown' | 'racing' | 'finished';

export interface RaceState {
  readonly phase: RacePhase;
  readonly countdownRemainingMs: number;
  readonly currentLap: number;
  /** Index into `checkpoints` of the next checkpoint that will count. */
  readonly expectedCheckpointIndex: number;
  /** Simulation ms since the countdown reached zero. */
  readonly elapsedMs: number;
  readonly lapTimes: readonly number[];
  readonly bestLapMs: number | null;
  readonly bestTotalMs: number | null;
  readonly finished: boolean;
}

export interface RaceCheckpointResult {
  /** True when the checkpoint was the expected one and the race state advanced. */
  readonly counted: boolean;
  readonly lapCompleted: boolean;
  readonly finished: boolean;
}

export interface RaceService {
  definitionIds(): readonly string[];
  load(raceId: string): void;
  startRace(): void;
  /** Advance the countdown / elapsed timer by `deltaMs` of simulation time. */
  tick(deltaMs: number): void;
  /** Report a checkpoint the vehicle entered. Only the expected next one counts. */
  checkpointEntered(checkpointId: string): RaceCheckpointResult;
  raceState(): RaceState;
  /** The checkpoint the vehicle must cross next, or null once finished. */
  expectedCheckpoint(): RaceCheckpointDefinition | null;
  currentLap(): number;
  elapsedMs(): number;
  lapTimes(): readonly number[];
  finished(): boolean;
  /** Reset the current attempt (keeps the loaded definition and best results). */
  restartRace(): void;
}

export class UnknownRaceError extends Error {
  constructor(id: string) {
    super(`No race defined with id "${id}" in content/races.json.`);
    this.name = 'UnknownRaceError';
  }
}

export interface RaceCatalog {
  readonly schemaVersion: number;
  readonly races: readonly RaceDefinition[];
}

/** Best-time persistence shape (opt-in), ids only. */
export interface RaceSave {
  readonly schemaVersion: number;
  readonly bestByRaceId: Readonly<Record<string, { readonly bestLapMs: number | null; readonly bestTotalMs: number | null }>>;
}
