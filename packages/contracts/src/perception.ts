/**
 * Stealth perception / suspicion / noise / hiding
 * (Category-C capability program, Wave 4).
 *
 * Renderer-neutral awareness geometry. One reusable service covers the
 * common stealth / heist loop: observer FOV cones, AABB occlusion,
 * suspicion/alert, noise, and cover/visibility. Patrol pathfinding,
 * takedowns and full stealth AI remain content / game-specific.
 *
 * Two bounded modes (not two engines):
 *   - `infiltrate` — spotted in a cone without cover fails immediately.
 *   - `heist`      — looting makes noise / sets alarm; alarm does not fail;
 *                    escape still requires the objective.
 */

export const PERCEPTION_CAPABILITY_ID = 'ai.perception';

export type PerceptionMode = 'infiltrate' | 'heist';
export type PerceptionOutcome = 'playing' | 'complete' | 'failed';

export interface PerceptionVec {
  readonly x: number;
  readonly y: number;
}

export interface PerceptionObserverDef {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  /** Degrees. 0 = east (+x), 90 = south (+y, y-down), 180 = west. */
  readonly facingDeg: number;
  readonly fovDeg: number;
  readonly range: number;
  readonly suspicionRisePerSecond: number;
  readonly suspicionDecayPerSecond: number;
}

export interface PerceptionOccluderDef {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface PerceptionCoverDef {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly radius: number;
}

export interface PerceptionMarkerDef {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly radius: number;
}

/** The validated `content/perception.json` document. */
export interface PerceptionCatalog {
  readonly schemaVersion: number;
  readonly mode: PerceptionMode;
  readonly start: PerceptionVec;
  readonly playerRadius: number;
  /** Visibility while in cover (0 hidden, 1 fully visible). */
  readonly hiddenMultiplier: number;
  readonly observers: readonly PerceptionObserverDef[];
  readonly occluders?: readonly PerceptionOccluderDef[];
  readonly cover?: readonly PerceptionCoverDef[];
  readonly objectives?: readonly PerceptionMarkerDef[];
  readonly exits?: readonly PerceptionMarkerDef[];
}

export interface PerceptionObserverState {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly facingDeg: number;
  readonly fovDeg: number;
  readonly range: number;
  readonly seesPlayer: boolean;
  readonly suspicion: number;
  readonly alert: boolean;
}

export type PerceptionActReason =
  | 'spotted'
  | 'hidden'
  | 'looted'
  | 'escaped'
  | 'blocked'
  | 'alarmed'
  | 'idle'
  | 'not-playing';

export interface PerceptionActResult {
  readonly ok: boolean;
  readonly reason: PerceptionActReason;
}

export interface PerceptionService {
  mode(): PerceptionMode;
  /** False when the catalog has no observers (inert empty document). */
  active(): boolean;
  start(): PerceptionVec;
  playerRadius(): number;
  setPlayer(x: number, y: number): void;
  player(): PerceptionVec;
  hidden(): boolean;
  seen(): boolean;
  alarm(): boolean;
  maxSuspicion(): number;
  observers(): readonly PerceptionObserverState[];
  occluders(): readonly PerceptionOccluderDef[];
  cover(): readonly PerceptionCoverDef[];
  objectives(): readonly (PerceptionMarkerDef & { readonly collected: boolean })[];
  exits(): readonly PerceptionMarkerDef[];
  objectiveCollected(): boolean;
  /** Simulation-time: FOV, suspicion, auto-loot, auto-exit. */
  tick(deltaMs: number): void;
  /** Heist: raise suspicion / alarm without needing LOS. */
  noise(amount: number): PerceptionActResult;
  outcome(): PerceptionOutcome;
  lastResult(): string | null;
  reset(): void;
}

export class DuplicatePerceptionIdError extends Error {
  constructor(id: string) {
    super(`Duplicate perception id "${id}" in content/perception.json.`);
    this.name = 'DuplicatePerceptionIdError';
  }
}

export class UnknownPerceptionObserverError extends Error {
  constructor(id: string) {
    super(`No perception observer defined with id "${id}" in content/perception.json.`);
    this.name = 'UnknownPerceptionObserverError';
  }
}
