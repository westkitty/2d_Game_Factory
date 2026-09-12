import { describe, expect, it } from 'vitest';
import { validateContentBundleData } from '@sw2d/schemas';
import type { GameContext, RunsCatalog, RunsService, SaveLoadOutcome, SaveSlotOptions, SaveStore, VersionedRecord } from '@sw2d/contracts';
import { RUNS_CAPABILITY_ID } from '@sw2d/contracts';
import { CAPABILITY_IDS } from '../src/ids.ts';
import { RUNS_SAVE_SLOT, runsPack } from '../src/runs/runsPack.ts';
import { FakeCapabilityRegistry, FakeEventBus } from './testSupport.ts';

const CATALOG: RunsCatalog = {
  schemaVersion: 1,
  mode: 'survive',
  metaPerXp: 1,
  metaPerKill: 2,
  metaPerWave: 5,
  metaPerCurrency: 0,
  metaPerClear: 0,
  unlocks: [
    { id: 'sturdy', label: 'Sturdy', cost: 4, effect: { kind: 'max-health', value: 40 } },
    { id: 'keen', label: 'Keen', cost: 10, effect: { kind: 'damage', value: 5 } },
  ],
};

/** A real, in-memory SaveStore with versioning semantics (mirrors the runtime's slot contract). */
class MemorySaves implements SaveStore {
  readonly namespace = 'test';
  readonly store = new Map<string, unknown>();
  outcome: SaveLoadOutcome = 'default';
  load<T extends VersionedRecord>(slot: string, options: SaveSlotOptions<T>): { value: T; outcome: SaveLoadOutcome } {
    const stored = this.store.get(slot) as (VersionedRecord & Record<string, unknown>) | undefined;
    if (!stored) return { value: options.createDefault(), outcome: 'default' };
    if (stored.schemaVersion === options.currentVersion) return { value: stored as T, outcome: 'loaded' };
    const migrated = options.migrate?.(stored, stored.schemaVersion) ?? null;
    return migrated ? { value: migrated, outcome: 'migrated' } : { value: options.createDefault(), outcome: 'invalid' };
  }
  save<T extends VersionedRecord>(slot: string, value: T): void {
    this.store.set(slot, JSON.parse(JSON.stringify(value)));
  }
  clear(slot: string): void {
    this.store.delete(slot);
  }
}

function install(catalog: RunsCatalog | undefined, saves: SaveStore | null = new MemorySaves()) {
  const events = new FakeEventBus();
  const capabilities = new FakeCapabilityRegistry();
  const ctx = {
    events,
    capabilities,
    saves: saves ?? undefined,
    content: catalog ? { data: { runs: { schemaId: 'x', valid: true, value: catalog } } } : { data: {} },
  } as unknown as GameContext;
  const installed = runsPack.install(ctx, undefined);
  const runs = capabilities.require<RunsService>(RUNS_CAPABILITY_ID);
  return { events, capabilities, installed, runs, saves };
}

describe('sw2d.runs - ids and schema', () => {
  it('capability id matches and the catalog validates', () => {
    expect(RUNS_CAPABILITY_ID).toBe(CAPABILITY_IDS.runs);
    expect(runsPack.provides).toEqual([RUNS_CAPABILITY_ID]);
    expect(() => validateContentBundleData({ runs: CATALOG })).not.toThrow();
    expect(() => validateContentBundleData({ runs: { ...CATALOG, unlocks: [{ id: 'x', label: 'x', cost: 1, effect: { kind: 'wings', value: 1 } }] } })).toThrow();
  });

  it('is inert without a catalog and withdraws on dispose', () => {
    const { runs, installed, capabilities } = install(undefined);
    expect(runs.active()).toBe(false);
    expect(runs.loadout()).toEqual({ maxHealthBonus: 0, damageBonus: 0, speedBonus: 0, startCurrency: 0, startXp: 0 });
    installed.dispose();
    expect(capabilities.has(RUNS_CAPABILITY_ID)).toBe(false);
  });
});

describe('sw2d.runs - run lifecycle and meta', () => {
  it('begins a run, ends it with banked meta at the catalog rates, and persists', () => {
    const { runs, events, saves } = install(CATALOG);
    const log: string[] = [];
    events.on('runs:started', (p) => log.push(`start ${p.runIndex}`));
    events.on('runs:ended', (p) => log.push(`end ${p.runIndex} ${p.cause} +${p.metaEarned}`));
    expect(runs.phase()).toBe('idle');
    expect(runs.beginRun()).toBe(1);
    expect(runs.beginRun()).toBe(1);
    expect(runs.phase()).toBe('in-run');
    const summary = runs.endRun({ cause: 'death', xp: 6, kills: 3, wave: 2, currency: 0, durationMs: 9000 });
    expect(summary).toMatchObject({ runIndex: 1, cause: 'death', metaEarned: 6 + 6 + 10 });
    expect(runs.phase()).toBe('ended');
    expect(runs.meta()).toMatchObject({ runsPlayed: 1, bestWave: 2, bestXp: 6, bestKills: 3, metaCurrency: 22 });
    expect(log).toEqual(['start 1', 'end 1 death +22']);
    expect((saves as MemorySaves).store.get(RUNS_SAVE_SLOT)).toMatchObject({ metaCurrency: 22, runsPlayed: 1 });
  });

  it('meta survives a reinstall (a restart) through the save store, and the next run index advances', () => {
    const saves = new MemorySaves();
    const first = install(CATALOG, saves);
    first.runs.beginRun();
    first.runs.endRun({ cause: 'death', xp: 4, kills: 0, wave: 0, currency: 0, durationMs: 1 });
    first.installed.dispose();
    const second = install(CATALOG, saves);
    expect(second.runs.loadOutcome()).toBe('loaded');
    expect(second.runs.meta().metaCurrency).toBe(4);
    expect(second.runs.beginRun()).toBe(2);
  });

  it('buys unlocks with meta currency, aggregates the loadout, persists it, and refuses what it cannot afford', () => {
    const saves = new MemorySaves();
    const { runs, events } = install(CATALOG, saves);
    const unlocked: string[] = [];
    events.on('runs:unlocked', (p) => unlocked.push(p.unlockId));
    expect(runs.buy('sturdy')).toBe('unaffordable');
    expect(runs.buy('nope')).toBe('unknown');
    runs.beginRun();
    runs.endRun({ cause: 'death', xp: 5, kills: 0, wave: 0, currency: 0, durationMs: 1 });
    expect(runs.nextAffordable()?.id).toBe('sturdy');
    expect(runs.buy('sturdy')).toBe('bought');
    expect(runs.buy('sturdy')).toBe('owned');
    expect(runs.meta().metaCurrency).toBe(1);
    expect(runs.loadout().maxHealthBonus).toBe(40);
    expect(runs.unlocks().find((u) => u.id === 'sturdy')?.owned).toBe(true);
    expect(runs.nextAffordable()).toBeNull();
    expect(unlocked).toEqual(['sturdy']);
    const again = install(CATALOG, saves);
    expect(again.runs.loadout()).toMatchObject({ maxHealthBonus: 40, damageBonus: 0 });
  });

  it('falls back to a fresh ledger on a corrupted or foreign-version record, and drops unknown unlocks', () => {
    const saves = new MemorySaves();
    saves.store.set(RUNS_SAVE_SLOT, { schemaVersion: 1, garbage: true });
    const corrupt = install(CATALOG, saves);
    expect(corrupt.runs.meta().runsPlayed).toBe(0);
    const old = new MemorySaves();
    old.store.set(RUNS_SAVE_SLOT, { schemaVersion: 0, runsPlayed: 3, metaCurrency: 9, unlocked: ['sturdy', 'ghost'], bestWave: 1, bestXp: 1 });
    const migrated = install(CATALOG, old);
    expect(migrated.runs.loadOutcome()).toBe('migrated');
    expect(migrated.runs.meta()).toMatchObject({ runsPlayed: 3, metaCurrency: 9, unlocked: ['sturdy'] });
    const none = install(CATALOG, null);
    expect(none.runs.loadOutcome()).toBe('unavailable');
    none.runs.beginRun();
    expect(none.runs.endRun({ cause: 'cleared', xp: 0, kills: 0, wave: 0, currency: 0, durationMs: 1 }).runIndex).toBe(1);
  });

  it('wipe() clears the persisted ledger', () => {
    const saves = new MemorySaves();
    const { runs } = install(CATALOG, saves);
    runs.beginRun();
    runs.endRun({ cause: 'death', xp: 5, kills: 0, wave: 0, currency: 0, durationMs: 1 });
    runs.wipe();
    expect(runs.meta().metaCurrency).toBe(0);
    expect(saves.store.has(RUNS_SAVE_SLOT)).toBe(false);
  });
});
