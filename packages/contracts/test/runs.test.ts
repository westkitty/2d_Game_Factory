import { describe, expect, it } from 'vitest';
import type {
  RunDefinition,
  RunsDocument,
  RunSeedPolicy,
  RunState,
  RunResetResult,
  RunResetParticipant,
} from '../src/runs.ts';
import { RUNS_CAPABILITY_ID } from '../src/runs.ts';

describe('runs contracts', () => {
  it('defines the canonical capability ID', () => {
    expect(RUNS_CAPABILITY_ID).toBe('progression.runs');
  });

  it('type-checks a valid RunsDocument and RunDefinition', () => {
    const run: RunDefinition = {
      id: 'main',
      displayName: 'Standard Roguelite Run',
      seedPolicy: { kind: 'increment-attempt', baseSeed: 1000, step: 7 },
      startingTransientCurrency: 0,
      startingItems: [{ itemId: 'wooden-sword', quantity: 1 }],
      startingResources: [{ resourceId: 'stamina', quantity: 100 }],
      startingFlags: [{ flagId: 'tutorial_seen', value: true }],
      victoryCondition: { kind: 'encounter-clear', encounterId: 'boss_final' },
      defeatCondition: { kind: 'combat-death' },
      carryoverRules: {
        retainMetaCurrency: true,
        retainPermanentUnlocks: true,
        retainCanonicalItems: false,
        retainStatsAcrossAttempts: true,
      },
      rewardRules: {
        onVictory: { metaCurrency: 100, xp: 500, unlockFlags: ['cleared_normal'] },
        onDefeat: { metaCurrency: 10, xp: 50 },
      },
      resumable: true,
      resetScopes: ['transient-currency', 'transient-upgrades', 'transient-items'],
      upgrades: [
        { id: 'health_boost', displayName: '+10 Max HP', cost: 50, kind: 'transient', effectRef: 'buff_hp' },
        { id: 'start_gold', displayName: '+50 Starting Gold', cost: 100, kind: 'permanent', effectRef: 'meta_gold' },
      ],
    };

    const doc: RunsDocument = {
      schemaVersion: 1,
      runs: [run],
    };

    expect(doc.schemaVersion).toBe(1);
    expect(doc.runs).toHaveLength(1);
    expect(doc.runs[0]!.id).toBe('main');
  });

  it('supports all seed policy variants', () => {
    const fixed: RunSeedPolicy = { kind: 'fixed', seed: 42 };
    const inc: RunSeedPolicy = { kind: 'increment-attempt', baseSeed: 100, step: 5 };
    const derived: RunSeedPolicy = { kind: 'run-counter-derived', baseSeed: 999 };

    expect(fixed.kind).toBe('fixed');
    expect(inc.kind).toBe('increment-attempt');
    expect(derived.kind).toBe('run-counter-derived');
  });

  it('models RunState and RunResetResult faithfully', () => {
    const state: RunState = {
      runId: 'main',
      seed: 12345,
      phase: 'active',
      attempt: 1,
      runDurationMs: 3500,
      transientCurrency: 25,
      transientUpgrades: ['health_boost'],
      stats: {
        kills: 12,
        roomsCleared: 3,
        wavesCleared: 0,
        damageDealt: 150,
        damageTaken: 40,
      },
    };

    expect(state.phase).toBe('active');
    expect(state.stats.kills).toBe(12);

    const participant: RunResetParticipant = {
      id: 'dungeon-gen',
      onRunReset: () => {},
    };
    expect(participant.id).toBe('dungeon-gen');

    const result: RunResetResult = {
      ok: true,
      state: { ...state, phase: 'idle', attempt: 2 },
      failures: [],
    };
    expect(result.ok).toBe(true);
    expect(result.state.attempt).toBe(2);
  });
});
