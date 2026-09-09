/**
 * Creature / habitat / companion needs
 * (Category-C capability program, Wave 2).
 *
 * Renderer-neutral, simulation-time. One reusable service covers the common
 * care loop: named needs that decay, care actions that raise them, optional
 * affinity, a wellbeing hold-to-win, and an optional fail-below. Theme,
 * presentation and full creature behaviour AI remain content / game-specific.
 *
 * Three bounded modes (not three engines):
 *   - `creature`   — hunger/mood (or any pair); hold-to-win; fail at empty.
 *   - `habitat`    — water/food (or any pair); longer hold; fail below a floor.
 *   - `companion`  — hunger/happiness; instant win once both are high enough
 *                    after enough actions; no fail-below.
 */

export const NEEDS_CAPABILITY_ID = 'simulation.needs';

export type NeedsMode = 'creature' | 'habitat' | 'companion';
export type NeedsOutcome = 'playing' | 'complete' | 'failed';

export interface NeedDefinition {
  readonly id: string;
  readonly displayName: string;
  readonly value: number;
  readonly min: number;
  readonly max: number;
  /** Subtracted from `value` each simulation second. */
  readonly decayPerSecond: number;
}

export interface NeedEffect {
  readonly needId: string;
  readonly delta: number;
}

export interface NeedAction {
  readonly id: string;
  readonly displayName: string;
  readonly effects: readonly NeedEffect[];
  readonly affinityDelta?: number;
}

export interface NeedsWin {
  /** Every need must be at or above this to count as "well". */
  readonly minValue: number;
  /** How long every need must stay at/above `minValue` before complete. 0 = instant. */
  readonly holdMs: number;
  /** Care actions required in addition to the hold. */
  readonly minActions: number;
}

export interface NeedsSubject {
  readonly id: string;
  readonly displayName: string;
}

/** The validated `content/needs.json` document. */
export interface NeedsCatalog {
  readonly schemaVersion: number;
  readonly mode: NeedsMode;
  readonly subject: NeedsSubject;
  readonly needs: readonly NeedDefinition[];
  readonly actions: readonly NeedAction[];
  readonly win: NeedsWin;
  /** Fail when any need is at or below this. Omit for no fail. */
  readonly loseBelow?: number;
  readonly affinity?: number;
}

export interface NeedState {
  readonly id: string;
  readonly displayName: string;
  readonly value: number;
  readonly min: number;
  readonly max: number;
}

export type NeedsActReason = 'acted' | 'unknown-action' | 'not-playing' | 'no-actions';

export interface NeedsActResult {
  readonly ok: boolean;
  readonly reason: NeedsActReason;
  readonly actionId?: string;
}

export interface NeedsService {
  mode(): NeedsMode;
  /** False when the catalog has no needs (inert empty document). */
  active(): boolean;
  subject(): NeedsSubject;
  needs(): readonly NeedState[];
  need(id: string): number;
  actions(): readonly NeedAction[];
  selectedIndex(): number;
  selectByDelta(delta: number): number;
  /** Apply `actionId`, or the currently selected action when omitted. */
  act(actionId?: string): NeedsActResult;
  actByIndex(index: number): NeedsActResult;
  affinity(): number;
  holdMs(): number;
  actionsTaken(): number;
  outcome(): NeedsOutcome;
  lastResult(): string | null;
  /** Restore catalog initials (a new care session). */
  reset(): void;
}

export class DuplicateNeedError extends Error {
  constructor(id: string) {
    super(`Duplicate needs id \"${id}\" in content/needs.json.`);
    this.name = 'DuplicateNeedError';
  }
}

export class UnknownNeedError extends Error {
  constructor(id: string) {
    super(`No need defined with id \"${id}\" in content/needs.json.`);
    this.name = 'UnknownNeedError';
  }
}

export class UnknownNeedActionError extends Error {
  constructor(id: string) {
    super(`No need action defined with id \"${id}\" in content/needs.json.`);
    this.name = 'UnknownNeedActionError';
  }
}
