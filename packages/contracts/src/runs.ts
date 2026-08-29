/**
 * Run lifecycle and roguelite meta-progression (capability program Phase 13).
 *
 * Renderer-neutral. Owns the active run lifecycle (start, win, defeat, abandon,
 * reset), transient per-run currency/upgrades, deterministic seed progression,
 * carryover/reward rules, and bounded reset participant hooks.
 *
 * Distinct from sw2d.progression (which owns persistent meta-currency, XP, permanent
 * unlock flags) and sw2d.items (which owns canonical item inventory).
 */

import type { GenerationSeed } from './generation.ts';

export const RUNS_CAPABILITY_ID = 'progression.runs';

// --- Run Status / Phase ---
export type RunPhase = 'idle' | 'active' | 'victory' | 'defeat' | 'abandoned';

// --- Seed Policy ---
export type RunSeedPolicy =
  | { readonly kind: 'fixed'; readonly seed?: number }
  | { readonly kind: 'increment-attempt'; readonly baseSeed?: number; readonly step?: number }
  | { readonly kind: 'run-counter-derived'; readonly baseSeed?: number };

// --- Conditions ---
export type RunCondition =
  | { readonly kind: 'explicit' }
  | { readonly kind: 'combat-death' }
  | { readonly kind: 'combat-victory' }
  | { readonly kind: 'encounter-clear'; readonly encounterId?: string }
  | { readonly kind: 'world-flag'; readonly flagId: string; readonly value?: boolean }
  | { readonly kind: 'objective-flag'; readonly flagId: string; readonly value?: boolean };

// --- Starting Grants ---
export interface RunStartingItem {
  readonly itemId: string;
  readonly quantity: number;
}

export interface RunStartingResource {
  readonly resourceId: string;
  readonly quantity: number;
}

export interface RunStartingFlag {
  readonly flagId: string;
  readonly value: boolean;
}

// --- Carryover & Reset Scopes ---
export type RunResetScope =
  | 'transient-currency'
  | 'transient-upgrades'
  | 'transient-items'
  | 'transient-resources'
  | 'world-flags'
  | 'encounters';

export interface RunCarryoverRules {
  readonly retainMetaCurrency?: boolean;
  readonly retainPermanentUnlocks?: boolean;
  readonly retainCanonicalItems?: boolean;
  readonly retainStatsAcrossAttempts?: boolean;
}

// --- Reward Rules ---
export interface RunRewardRules {
  readonly onVictory?: {
    readonly metaCurrency?: number;
    readonly xp?: number;
    readonly unlockFlags?: readonly string[];
    readonly items?: readonly RunStartingItem[];
  };
  readonly onDefeat?: {
    readonly metaCurrency?: number;
    readonly xp?: number;
    readonly unlockFlags?: readonly string[];
    readonly items?: readonly RunStartingItem[];
  };
}

// --- Upgrades (Optional supporting functionality) ---
export interface RunUpgradeDefinition {
  readonly id: string;
  readonly displayName: string;
  readonly cost: number;
  readonly kind: 'transient' | 'permanent';
  readonly effectRef?: string;
}

// --- Run Definition ---
export interface RunDefinition {
  readonly id: string;
  readonly displayName?: string;
  readonly seedPolicy: RunSeedPolicy;
  readonly startingTransientCurrency?: number;
  readonly startingItems?: readonly RunStartingItem[];
  readonly startingResources?: readonly RunStartingResource[];
  readonly startingFlags?: readonly RunStartingFlag[];
  readonly victoryCondition?: RunCondition;
  readonly defeatCondition?: RunCondition;
  readonly carryoverRules?: RunCarryoverRules;
  readonly rewardRules?: RunRewardRules;
  readonly resumable?: boolean;
  readonly resetScopes?: readonly RunResetScope[];
  readonly upgrades?: readonly RunUpgradeDefinition[];
}

// --- Document Shape ---
export interface RunsDocument {
  readonly schemaVersion: 1;
  readonly runs: readonly RunDefinition[];
}

// --- Run Statistics ---
export interface RunStats {
  readonly kills: number;
  readonly roomsCleared: number;
  readonly wavesCleared: number;
  readonly damageDealt: number;
  readonly damageTaken: number;
}

// --- Run State ---
export interface RunState {
  readonly runId: string;
  readonly seed: GenerationSeed;
  readonly phase: RunPhase;
  readonly attempt: number;
  readonly runDurationMs: number;
  readonly transientCurrency: number;
  readonly transientUpgrades: readonly string[];
  readonly stats: RunStats;
}

// --- Reset Participant ---
export interface RunResetParticipant {
  readonly id: string;
  onRunReset(state: RunState, nextSeed: GenerationSeed): void;
}

export interface RunResetFailure {
  readonly participantId: string;
  readonly error: string;
}

export interface RunResetResult {
  readonly ok: boolean;
  readonly state: RunState;
  readonly failures: readonly RunResetFailure[];
}

// --- Run Service ---
export interface RunService {
  state(): RunState;
  definition(): RunDefinition | undefined;
  startRun(options?: { seed?: number; runId?: string }): RunState;
  endRun(outcome: 'victory' | 'defeat' | 'abandoned'): RunState;
  winRun(): RunState;
  loseRun(): RunState;
  abandonRun(): RunState;
  resetRun(nextSeed?: number): RunResetResult;
  addTransientCurrency(delta: number): number;
  purchaseUpgrade(upgradeId: string): boolean;
  recordKill(): void;
  recordRoomCleared(): void;
  recordWaveCleared(): void;
  recordDamage(dealt: number, taken: number): void;
  registerResetParticipant(participant: RunResetParticipant): { dispose(): void };
}
