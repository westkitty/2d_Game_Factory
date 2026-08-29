import { describe, expect, it } from 'vitest';
import type {
  GameContext,
  RunsDocument,
  RunService,
  RunResetParticipant,
  SaveStore,
  VersionedRecord,
  ItemCatalog,
} from '@sw2d/contracts';
import { createFakeGameContext } from './testSupport.ts';
import {
  runsPack,
  DuplicateRunIdError,
  DuplicateResetParticipantError,
  RunAlreadyActiveError,
  MissingCapabilityRequirementError,
} from '../src/runs/runsPack.ts';
import { progressionPack } from '../src/progression/progressionPack.ts';
import { itemsPack } from '../src/items/itemsPack.ts';

class FakeSaveStore implements SaveStore {
  readonly namespace = 'test';
  readonly store = new Map<string, unknown>();

  load<T extends VersionedRecord>(slot: string, options: { currentVersion: number; createDefault: () => T }) {
    const stored = this.store.get(slot) as T | undefined;
    if (stored && stored.schemaVersion === options.currentVersion) {
      return { value: stored, outcome: 'loaded' as const };
    }
    return { value: options.createDefault(), outcome: 'default' as const };
  }

  save<T extends VersionedRecord>(slot: string, value: T): void {
    this.store.set(slot, value);
  }

  clear(slot: string): void {
    this.store.delete(slot);
  }
}

const SAMPLE_RUNS_DOC: RunsDocument = {
  schemaVersion: 1,
  runs: [
    {
      id: 'dungeon-run',
      displayName: 'Dungeon Run',
      seedPolicy: { kind: 'increment-attempt', baseSeed: 100, step: 10 },
      startingTransientCurrency: 20,
      resumable: true,
      rewardRules: {
        onVictory: { metaCurrency: 50, xp: 200, unlockFlags: ['cleared_dungeon'] },
        onDefeat: { metaCurrency: 5, xp: 20 },
      },
      upgrades: [
        { id: 'transient_armor', displayName: 'Iron Armor', cost: 15, kind: 'transient' },
        { id: 'perm_vitality', displayName: 'Vitality', cost: 30, kind: 'permanent', effectRef: 'meta_vitality' },
      ],
    },
    {
      id: 'fixed-run',
      displayName: 'Fixed Seed Challenge',
      seedPolicy: { kind: 'fixed', seed: 42 },
      startingTransientCurrency: 0,
      resumable: false,
    },
    {
      id: 'counter-run',
      displayName: 'Counter Derived Challenge',
      seedPolicy: { kind: 'run-counter-derived', baseSeed: 777 },
      startingTransientCurrency: 0,
    },
  ],
};

function createContext(runsDoc?: RunsDocument, saves?: SaveStore, itemsCatalog?: ItemCatalog): GameContext {
  const base = createFakeGameContext();
  const data: Record<string, { schemaId: string; valid: true; value: unknown }> = {};
  if (runsDoc) data['runs'] = { schemaId: 'runs', valid: true, value: runsDoc };
  if (itemsCatalog) data['items'] = { schemaId: 'items', valid: true, value: itemsCatalog };
  return {
    ...base,
    content: {
      ...base.content,
      data,
    },
    ...(saves ? { saves } : {}),
  };
}

describe('runsPack and RunService', () => {
  it('installs with default values when no runs document present', () => {
    const context = createContext();
    const installed = runsPack.install(context, {});
    const runs = context.capabilities.require<RunService>('progression.runs');

    const state = runs.state();
    expect(state.phase).toBe('idle');
    expect(state.attempt).toBe(1);
    expect(state.transientCurrency).toBe(0);
    expect(installed.id).toBe('sw2d.runs');

    installed.dispose();
    expect(context.capabilities.has('progression.runs')).toBe(false);
  });

  it('rejects duplicate run IDs in document', () => {
    const badDoc: RunsDocument = {
      schemaVersion: 1,
      runs: [
        { id: 'dup', seedPolicy: { kind: 'fixed', seed: 1 } },
        { id: 'dup', seedPolicy: { kind: 'fixed', seed: 2 } },
      ],
    };
    const context = createContext(badDoc);
    expect(() => runsPack.install(context, {})).toThrow(DuplicateRunIdError);
  });

  it('starts run with deterministic seed policy and prevents double start', () => {
    const context = createContext(SAMPLE_RUNS_DOC);
    runsPack.install(context, {});
    const runs = context.capabilities.require<RunService>('progression.runs');

    const state1 = runs.startRun();
    expect(state1.phase).toBe('active');
    expect(state1.runId).toBe('dungeon-run');
    expect(state1.attempt).toBe(1);
    expect(state1.seed).toBe(100); // 100 + (1 - 1) * 10 = 100
    expect(state1.transientCurrency).toBe(20);

    expect(() => runs.startRun()).toThrow(RunAlreadyActiveError);
  });

  it('advances run duration via update(deltaMs)', () => {
    const context = createContext(SAMPLE_RUNS_DOC);
    const installed = runsPack.install(context, {});
    const runs = context.capabilities.require<RunService>('progression.runs');

    runs.startRun();
    expect(runs.state().runDurationMs).toBe(0);

    installed.update?.(16);
    installed.update?.(34);
    expect(runs.state().runDurationMs).toBe(50);
  });

  it('handles winRun and loseRun with rewardRules into ProgressionService', () => {
    const context = createContext(SAMPLE_RUNS_DOC);
    progressionPack.install(context, {});
    runsPack.install(context, {});

    const runs = context.capabilities.require<RunService>('progression.runs');
    const progression = context.capabilities.require<any>('progression.state');

    runs.startRun();
    runs.winRun();

    expect(runs.state().phase).toBe('victory');
    expect(progression.currency()).toBe(50);
    expect(progression.xp()).toBe(200);
    expect(progression.isUnlocked('cleared_dungeon')).toBe(true);

    // Reset and lose run
    runs.resetRun();
    runs.startRun();
    runs.loseRun();

    expect(runs.state().phase).toBe('defeat');
    expect(progression.currency()).toBe(55); // 50 + 5
    expect(progression.xp()).toBe(220); // 200 + 20
  });

  it('wipes transient currency on reset but retains progression state', () => {
    const context = createContext(SAMPLE_RUNS_DOC);
    progressionPack.install(context, {});
    runsPack.install(context, {});

    const runs = context.capabilities.require<RunService>('progression.runs');
    const progression = context.capabilities.require<any>('progression.state');

    runs.startRun();
    runs.addTransientCurrency(35);
    expect(runs.state().transientCurrency).toBe(55); // 20 starting + 35

    runs.loseRun();
    const resetResult = runs.resetRun();

    expect(resetResult.ok).toBe(true);
    expect(resetResult.state.attempt).toBe(2);
    expect(resetResult.state.phase).toBe('idle');
    expect(resetResult.state.transientCurrency).toBe(0);
    expect(resetResult.state.seed).toBe(110); // 100 + (2 - 1) * 10 = 110

    // Meta progression survives
    expect(progression.currency()).toBe(5);
  });

  it('supports fixed and run-counter-derived seed policies deterministically', () => {
    const context = createContext(SAMPLE_RUNS_DOC);
    runsPack.install(context, { defaultRunId: 'fixed-run' });
    const runs = context.capabilities.require<RunService>('progression.runs');

    runs.startRun();
    expect(runs.state().seed).toBe(42);
    runs.endRun('defeat');
    runs.resetRun();
    runs.startRun();
    expect(runs.state().seed).toBe(42); // fixed seed stays identical across attempts

    runs.endRun('defeat');
    runs.resetRun();
    runs.startRun({ runId: 'counter-run' });
    const seed1 = runs.state().seed;
    runs.endRun('defeat');
    runs.resetRun();
    runs.startRun({ runId: 'counter-run' });
    const seed2 = runs.state().seed;
    expect(seed1).not.toBe(seed2); // counter-derived advances deterministically
  });

  it('manages transient vs permanent upgrades cleanly', () => {
    const context = createContext(SAMPLE_RUNS_DOC);
    progressionPack.install(context, { startingCurrency: 50 });
    runsPack.install(context, {});

    const runs = context.capabilities.require<RunService>('progression.runs');
    const progression = context.capabilities.require<any>('progression.state');

    runs.startRun();

    // Buy transient upgrade (costs 15 transient currency)
    expect(runs.purchaseUpgrade('transient_armor')).toBe(true);
    expect(runs.state().transientCurrency).toBe(5); // 20 - 15
    expect(runs.state().transientUpgrades).toEqual(['transient_armor']);

    // Cannot rebuy if insufficient transient currency
    expect(runs.purchaseUpgrade('transient_armor')).toBe(false);

    // Buy permanent upgrade (costs 30 meta currency)
    expect(runs.purchaseUpgrade('perm_vitality')).toBe(true);
    expect(progression.currency()).toBe(20); // 50 - 30
    expect(progression.isUnlocked('meta_vitality')).toBe(true);

    // Reset wipes transient upgrades, permanent unlock stays in progression
    runs.loseRun();
    runs.resetRun();
    expect(runs.state().transientUpgrades).toEqual([]);
    expect(progression.isUnlocked('meta_vitality')).toBe(true);
  });

  it('manages RunResetParticipant registration, disposal, and duplicate detection', () => {
    const context = createContext(SAMPLE_RUNS_DOC);
    runsPack.install(context, {});
    const runs = context.capabilities.require<RunService>('progression.runs');

    let resetCount = 0;
    const participant: RunResetParticipant = {
      id: 'test-listener',
      onRunReset: () => {
        resetCount++;
      },
    };

    const handle = runs.registerResetParticipant(participant);
    expect(() => runs.registerResetParticipant(participant)).toThrow(DuplicateResetParticipantError);

    runs.startRun();
    runs.resetRun();
    expect(resetCount).toBe(1);

    handle.dispose();
    runs.startRun();
    runs.resetRun();
    expect(resetCount).toBe(1); // not called after disposal
  });

  it('captures participant failures without swallowing errors', () => {
    const context = createContext(SAMPLE_RUNS_DOC);
    runsPack.install(context, {});
    const runs = context.capabilities.require<RunService>('progression.runs');

    runs.registerResetParticipant({
      id: 'failing-participant',
      onRunReset: () => {
        throw new Error('Simulation state corrupt');
      },
    });

    runs.startRun();
    const result = runs.resetRun();

    expect(result.ok).toBe(false);
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0]!.participantId).toBe('failing-participant');
    expect(result.failures[0]!.error).toBe('Simulation state corrupt');
  });

  it('handles starting items requirement when items capability missing', () => {
    const docWithItems: RunsDocument = {
      schemaVersion: 1,
      runs: [
        {
          id: 'item-run',
          seedPolicy: { kind: 'fixed', seed: 1 },
          startingItems: [{ itemId: 'sword', quantity: 1 }],
        },
      ],
    };
    const context = createContext(docWithItems);
    runsPack.install(context, {});
    const runs = context.capabilities.require<RunService>('progression.runs');

    expect(() => runs.startRun()).toThrow(MissingCapabilityRequirementError);
  });

  it('applies starting items when items capability is present', () => {
    const itemCatalog: ItemCatalog = {
      schemaVersion: 1,
      items: [{ id: 'sword', displayName: 'Iron Sword', category: 'weapon', stackable: false, consumable: false }],
    };
    const docWithItems: RunsDocument = {
      schemaVersion: 1,
      runs: [
        {
          id: 'item-run',
          seedPolicy: { kind: 'fixed', seed: 1 },
          startingItems: [{ itemId: 'sword', quantity: 1 }],
        },
      ],
    };
    const context = createContext(docWithItems, undefined, itemCatalog);
    itemsPack.install(context, {});
    runsPack.install(context, {});

    const runs = context.capabilities.require<RunService>('progression.runs');
    const items = context.capabilities.require<any>('items.state');

    runs.startRun();
    expect(items.count('sword')).toBe(1);
  });

  it('supports resumable run saving and reloading from SaveStore', () => {
    const saves = new FakeSaveStore();
    const context1 = createContext(SAMPLE_RUNS_DOC, saves);
    const inst1 = runsPack.install(context1, {});
    const runs1 = context1.capabilities.require<RunService>('progression.runs');

    runs1.startRun();
    runs1.addTransientCurrency(15);
    inst1.update?.(1000);
    inst1.dispose();

    // Save should exist
    expect(saves.store.has('sw2d.runs.active')).toBe(true);

    // Reconstruct into context2
    const context2 = createContext(SAMPLE_RUNS_DOC, saves);
    runsPack.install(context2, {});
    const runs2 = context2.capabilities.require<RunService>('progression.runs');

    const loadedState = runs2.state();
    expect(loadedState.phase).toBe('active');
    expect(loadedState.transientCurrency).toBe(35); // 20 + 15
    expect(loadedState.runDurationMs).toBe(1000);
  });

  /**
   * The full resumability contract, exercised only through public behaviour:
   * SaveStore + the RunService constructor the pack itself uses. Nothing here
   * reaches past the service to poke private state, and nothing asserts an
   * unconditional truth - the previous Phase 13 proof step asserted `true`
   * because SaveStore has no `has()`, but a store that reports its load
   * outcome never needed one.
   */
  it('persists an active resumable run, restores it into a fresh RunService, and stops restoring it once the run ends', () => {
    const saves = new FakeSaveStore();

    // 1. Start a resumable active run.
    const context1 = createContext(SAMPLE_RUNS_DOC, saves);
    const inst1 = runsPack.install(context1, {});
    const runs1 = context1.capabilities.require<RunService>('progression.runs');
    const started = runs1.startRun();
    expect(started.phase).toBe('active');
    expect(started.runId).toBe('dungeon-run');

    // 2. Mutate meaningful transient run state: currency, an upgrade, stats, duration.
    runs1.addTransientCurrency(40); // 20 starting + 40 = 60
    expect(runs1.purchaseUpgrade('transient_armor')).toBe(true); // 60 - 15 = 45
    runs1.recordKill();
    runs1.recordKill();
    runs1.recordRoomCleared();
    runs1.recordDamage(70, 25);
    // Stats and duration are coalesced, so they reach the store on the next
    // checkpoint tick rather than on each mutation. One second of run time.
    inst1.update?.(600);
    inst1.update?.(600);

    const live = runs1.state();
    expect(live.transientCurrency).toBe(45);
    expect(live.transientUpgrades).toEqual(['transient_armor']);
    expect(live.stats).toEqual({ kills: 2, roomsCleared: 1, wavesCleared: 0, damageDealt: 70, damageTaken: 25 });
    expect(live.runDurationMs).toBe(1200);

    // 3. Confirm the active-run state really is in the persistence store.
    const persisted = saves.load('sw2d.runs.active', {
      currentVersion: 1,
      createDefault: () => ({ schemaVersion: -1 }) as never,
    });
    expect(persisted.outcome).toBe('loaded');
    const record = persisted.value as unknown as {
      runId: string;
      phase: string;
      attempt: number;
      seed: number;
      transientCurrency: number;
      transientUpgrades: readonly string[];
      runDurationMs: number;
      stats: Record<string, number>;
    };
    expect(record.phase).toBe('active');
    expect(record.runId).toBe('dungeon-run');
    expect(record.transientUpgrades).toEqual(['transient_armor']);

    // 4. Recreate the RunService against the same persistence store.
    const context2 = createContext(SAMPLE_RUNS_DOC, saves);
    runsPack.install(context2, {});
    const runs2 = context2.capabilities.require<RunService>('progression.runs');

    // 5/6. The active run restores, with the fields that matter intact.
    const restored = runs2.state();
    expect(restored.phase).toBe('active');
    expect(restored.runId).toBe(live.runId);
    expect(restored.attempt).toBe(live.attempt);
    expect(restored.seed).toBe(live.seed);
    expect(restored.transientCurrency).toBe(live.transientCurrency);
    expect(restored.transientUpgrades).toEqual(live.transientUpgrades);
    expect(restored.stats).toEqual(live.stats);
    expect(restored.runDurationMs).toBe(live.runDurationMs);
    expect(runs2.definition()?.id).toBe('dungeon-run');

    // 7. Complete the run; the active slot is cleared.
    runs2.winRun();
    const afterEnd = saves.load('sw2d.runs.active', {
      currentVersion: 1,
      createDefault: () => ({ schemaVersion: -1 }) as never,
    });
    expect(afterEnd.outcome).toBe('default');

    // 8/9. A third RunService over the same store must NOT restore the finished run.
    const context3 = createContext(SAMPLE_RUNS_DOC, saves);
    runsPack.install(context3, {});
    const runs3 = context3.capabilities.require<RunService>('progression.runs');
    const fresh = runs3.state();
    expect(fresh.phase).toBe('idle');
    expect(fresh.attempt).toBe(1);
    expect(fresh.transientCurrency).toBe(20); // back to the definition's starting grant
    expect(fresh.transientUpgrades).toEqual([]);
    expect(fresh.stats).toEqual({ kills: 0, roomsCleared: 0, wavesCleared: 0, damageDealt: 0, damageTaken: 0 });
    expect(fresh.runDurationMs).toBe(0);
  });

  it('does not restore an abandoned or defeated run into a fresh RunService', () => {
    for (const outcome of ['defeat', 'abandoned'] as const) {
      const saves = new FakeSaveStore();
      const contextA = createContext(SAMPLE_RUNS_DOC, saves);
      runsPack.install(contextA, {});
      const runsA = contextA.capabilities.require<RunService>('progression.runs');
      runsA.startRun();
      runsA.addTransientCurrency(5);
      expect(saves.store.has('sw2d.runs.active')).toBe(true);

      runsA.endRun(outcome);
      expect(saves.store.has('sw2d.runs.active')).toBe(false);

      const contextB = createContext(SAMPLE_RUNS_DOC, saves);
      runsPack.install(contextB, {});
      const runsB = contextB.capabilities.require<RunService>('progression.runs');
      expect(runsB.state().phase).toBe('idle');
    }
  });

  it('clears the active save on resetRun so the abandoned attempt is not resumed', () => {
    const saves = new FakeSaveStore();
    const contextA = createContext(SAMPLE_RUNS_DOC, saves);
    runsPack.install(contextA, {});
    const runsA = contextA.capabilities.require<RunService>('progression.runs');
    runsA.startRun();
    runsA.addTransientCurrency(5);
    runsA.resetRun();
    expect(saves.store.has('sw2d.runs.active')).toBe(false);

    const contextB = createContext(SAMPLE_RUNS_DOC, saves);
    runsPack.install(contextB, {});
    expect(contextB.capabilities.require<RunService>('progression.runs').state().phase).toBe('idle');
  });

  it('checkpoints frame-rate run state at a bounded interval rather than on every mutation', () => {
    const saves = new FakeSaveStore();
    const context = createContext(SAMPLE_RUNS_DOC, saves);
    const installed = runsPack.install(context, {});
    const runs = context.capabilities.require<RunService>('progression.runs');

    runs.startRun(); // flushes immediately
    const atStart = saves.store.get('sw2d.runs.active') as { runDurationMs: number; stats: { kills: number } };
    expect(atStart.runDurationMs).toBe(0);

    runs.recordKill();
    installed.update?.(500);
    // Inside the coalescing window: the store still holds the start-of-run checkpoint.
    const midWindow = saves.store.get('sw2d.runs.active') as { runDurationMs: number; stats: { kills: number } };
    expect(midWindow.runDurationMs).toBe(0);
    expect(midWindow.stats.kills).toBe(0);

    installed.update?.(500); // crosses RUNS_PERSIST_INTERVAL_MS
    const afterWindow = saves.store.get('sw2d.runs.active') as { runDurationMs: number; stats: { kills: number } };
    expect(afterWindow.runDurationMs).toBe(1000);
    expect(afterWindow.stats.kills).toBe(1);

    // dispose() flushes whatever accrued since the last checkpoint.
    runs.recordKill();
    installed.update?.(120);
    installed.dispose();
    const atDispose = saves.store.get('sw2d.runs.active') as { runDurationMs: number; stats: { kills: number } };
    expect(atDispose.runDurationMs).toBe(1120);
    expect(atDispose.stats.kills).toBe(2);
  });

  it('does not save active state when resumable is false', () => {
    const saves = new FakeSaveStore();
    const context = createContext(SAMPLE_RUNS_DOC, saves);
    runsPack.install(context, { defaultRunId: 'fixed-run' });
    const runs = context.capabilities.require<RunService>('progression.runs');

    runs.startRun();
    expect(saves.store.has('sw2d.runs.active')).toBe(false);
  });
});
