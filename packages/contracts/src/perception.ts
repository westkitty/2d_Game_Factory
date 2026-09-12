/**
 * Stealth perception / suspicion / noise / hiding / patrol / stealth AI
 * (Category-C capability program, Wave 4; patrol routes, the observer state
 * machine, chase / catch, investigation, return-to-patrol and takedowns added
 * by the Final Product Completion program, Wave 2 - matrix L09).
 *
 * Renderer-neutral awareness geometry plus a bounded deterministic observer
 * state machine:
 *
 *   patrol -> suspicious (partial sight: hidden in cover inside the cone)
 *   patrol / suspicious -> chase (clear sight)  -> caught (within catchRadius)
 *   chase -> investigate (sight lost for memoryMs: walk to the last known
 *            position, look around for investigateMs)
 *   investigate -> return (walk back to the route) -> patrol
 *   noise -> every observer investigates the noise position
 *   takedown (from outside the observer's cone, inside takedownRadius) -> downed
 *
 * Two bounded modes (not two engines):
 *   - `infiltrate` — being caught by a chasing observer fails the run.
 *   - `heist`      — looting makes noise / sets alarm; alarm does not fail;
 *                    being caught still does; escape requires the objective.
 */

export const PERCEPTION_CAPABILITY_ID = 'ai.perception';

export type PerceptionMode = 'infiltrate' | 'heist';
export type PerceptionOutcome = 'playing' | 'complete' | 'failed';

export interface PerceptionVec {
  readonly x: number;
  readonly y: number;
}

export type PerceptionObserverState = 'patrol' | 'suspicious' | 'chase' | 'investigate' | 'return' | 'downed';

export interface PerceptionPatrolDef {
  /** Route waypoints, walked in order and looped (the observer's start is not implied). */
  readonly waypoints: readonly PerceptionVec[];
  /** px/s while patrolling. */
  readonly speed: number;
  /** Pause at each waypoint. */
  readonly waitMs: number;
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
  /** Optional patrol route; a stationary observer stands at (x, y) facing `facingDeg`. */
  readonly patrol?: PerceptionPatrolDef;
  /** px/s while chasing / investigating. Default 90. */
  readonly chaseSpeed?: number;
  /** Distance at which a chasing observer catches the player. Default 24. */
  readonly catchRadius?: number;
  /** How long a chaser keeps chasing after losing sight before investigating. Default 1200. */
  readonly memoryMs?: number;
  /** How long an investigating observer looks around before returning. Default 1500. */
  readonly investigateMs?: number;
  /** Distance inside which a takedown from outside the cone downs this observer. Default 40. */
  readonly takedownRadius?: number;
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

export interface PerceptionObserverStateSnapshot {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly facingDeg: number;
  readonly fovDeg: number;
  readonly range: number;
  readonly seesPlayer: boolean;
  readonly suspicion: number;
  readonly alert: boolean;
  readonly state: PerceptionObserverState;
  readonly lastKnown: PerceptionVec | null;
  /** True while the observer's route has waypoints. */
  readonly patrolling: boolean;
}

/** @deprecated name kept for the Wave 4 consumers; identical to PerceptionObserverStateSnapshot. */
export type PerceptionObserverState_ = PerceptionObserverStateSnapshot;

export type PerceptionActReason =
  | 'spotted'
  | 'hidden'
  | 'looted'
  | 'escaped'
  | 'blocked'
  | 'alarmed'
  | 'idle'
  | 'not-playing'
  | 'takedown'
  | 'no-target'
  | 'in-view';

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
  observers(): readonly PerceptionObserverStateSnapshot[];
  /** Silent takedown of the nearest observer inside its takedownRadius that cannot see the player. */
  takedown(): PerceptionActResult;
  takedowns(): number;
  /** Observer state transition counts this run (HUD / proof). */
  transitions(): readonly { readonly observerId: string; readonly from: PerceptionObserverState; readonly to: PerceptionObserverState }[];
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
