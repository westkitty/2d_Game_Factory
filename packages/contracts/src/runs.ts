/**
 * Run lifecycle and between-run meta progression (Final Product Completion,
 * Wave 2 - matrix L06 / L08).
 *
 * A *run* is one attempt: it begins, accumulates in-run results (XP, kills,
 * waves, currency), and ends by death (permadeath), by clearing, or by being
 * abandoned. What survives a run is *meta* state: runs played, bests, a meta
 * currency banked from run results at the catalog's exchange rates, and the
 * unlocks bought with it. Unlocks aggregate into a `RunLoadout` the next run
 * starts with. Meta state persists through `GameContext.saves` (local-first,
 * versioned; an invalid or foreign-version record falls back to defaults).
 *
 * Consumers: survivor-like (endless waves, death ends the run), action-
 * roguelite (generated rooms, clearing the exit or dying ends the run).
 * Deliberately not an inventory, skill tree or quest system - it is the run
 * boundary and the meta ledger, nothing more.
 */

export const RUNS_CAPABILITY_ID = 'progression.runs';

export type RunsMode = 'survive' | 'roguelite';
export type RunPhase = 'idle' | 'in-run' | 'ended';
export type RunEndCause = 'death' | 'cleared' | 'abandoned';

export type RunUnlockEffectKind = 'max-health' | 'damage' | 'speed' | 'start-currency' | 'start-xp';

export interface RunUnlockDef {
  readonly id: string;
  readonly label: string;
  /** Meta currency cost. */
  readonly cost: number;
  readonly effect: { readonly kind: RunUnlockEffectKind; readonly value: number };
}

/** The validated `content/runs.json` document. */
export interface RunsCatalog {
  readonly schemaVersion: number;
  readonly mode: RunsMode;
  /** Meta currency earned per in-run XP point. */
  readonly metaPerXp: number;
  /** Meta currency earned per kill. */
  readonly metaPerKill: number;
  /** Meta currency earned per wave cleared. */
  readonly metaPerWave: number;
  /** Meta currency earned per in-run currency banked at the end. */
  readonly metaPerCurrency: number;
  /** Flat bonus for clearing a run. */
  readonly metaPerClear: number;
  readonly unlocks: readonly RunUnlockDef[];
}

export interface RunResultInput {
  readonly cause: RunEndCause;
  readonly xp: number;
  readonly kills: number;
  readonly wave: number;
  readonly currency: number;
  readonly durationMs: number;
}

export interface RunSummary extends RunResultInput {
  readonly runIndex: number;
  readonly metaEarned: number;
}

export interface RunsMeta {
  readonly schemaVersion: number;
  readonly runsPlayed: number;
  readonly bestWave: number;
  readonly bestXp: number;
  readonly bestKills: number;
  readonly metaCurrency: number;
  readonly unlocked: readonly string[];
  readonly lastRun: RunSummary | null;
}

export interface RunLoadout {
  readonly maxHealthBonus: number;
  readonly damageBonus: number;
  readonly speedBonus: number;
  readonly startCurrency: number;
  readonly startXp: number;
}

export type RunBuyResult = 'bought' | 'owned' | 'unaffordable' | 'unknown';

export interface RunsService {
  mode(): RunsMode;
  /** False for the inert empty catalog (no unlocks and zero exchange rates). */
  active(): boolean;
  phase(): RunPhase;
  /** Starts a run; returns its index (1-based, persisted count + 1). Idempotent while a run is open. */
  beginRun(): number;
  /** Ends the open run, banks meta currency, persists. Returns the summary (or the last one if no run is open). */
  endRun(result: RunResultInput): RunSummary;
  current(): RunSummary | null;
  meta(): RunsMeta;
  unlocks(): readonly (RunUnlockDef & { readonly owned: boolean; readonly affordable: boolean })[];
  buy(unlockId: string): RunBuyResult;
  /** The cheapest unowned, affordable unlock - the between-run default purchase. */
  nextAffordable(): RunUnlockDef | null;
  loadout(): RunLoadout;
  /** How the persisted meta resolved at install (debug/QA). */
  loadOutcome(): string;
  /** Wipe persisted meta (settings-style reset). */
  wipe(): void;
}
