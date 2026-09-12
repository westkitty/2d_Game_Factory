import { describe, expect, it } from 'vitest';
import type { GameContext, SaveLoadOutcome, SaveSlotOptions, SaveStore, SimulationCatalog, VersionedRecord } from '@sw2d/contracts';
import type { SimulationService } from '../src/simulation/simulationPack.ts';
import {
  DuplicateSimulationJobError,
  UnknownSimulationJobError,
  formatSimulationAmount,
  simulationPack,
} from '../src/simulation/simulationPack.ts';
import { FakeCapabilityRegistry, FakeEventBus, createFakeGameContext } from './testSupport.ts';

class MemorySaves implements SaveStore {
  readonly namespace = 'test';
  readonly store = new Map<string, unknown>();
  load<T extends VersionedRecord>(slot: string, options: SaveSlotOptions<T>): { value: T; outcome: SaveLoadOutcome } {
    const stored = this.store.get(slot) as (VersionedRecord & Record<string, unknown>) | undefined;
    if (!stored) return { value: options.createDefault(), outcome: 'default' };
    if (stored.schemaVersion === options.currentVersion) return { value: stored as T, outcome: 'loaded' };
    return { value: options.createDefault(), outcome: 'invalid' };
  }
  save<T extends VersionedRecord>(slot: string, value: T): void {
    this.store.set(slot, JSON.parse(JSON.stringify(value)));
  }
  clear(slot: string): void {
    this.store.delete(slot);
  }
}

function install(catalog?: SimulationCatalog, saves: SaveStore | undefined = undefined): {
  simulation: SimulationService;
  installed: ReturnType<typeof simulationPack.install>;
  saves: SaveStore | undefined;
} {
  const events = new FakeEventBus();
  const capabilities = new FakeCapabilityRegistry();
  const ctx = {
    events,
    capabilities,
    ...(saves ? { saves } : {}),
    content: catalog ? { data: { simulation: { schemaId: 'x', valid: true, value: catalog } } } : { data: {} },
  } as unknown as GameContext;
  const installed = simulationPack.install(ctx, undefined);
  return { simulation: capabilities.require<SimulationService>('simulation.resources'), installed, saves };
}

describe('simulationPack', () => {
  it('installs and publishes the simulation capability', () => {
    const context = createFakeGameContext();
    const installed = simulationPack.install(context, undefined);

    expect(context.capabilities.has('simulation.resources')).toBe(true);
    expect(installed.id).toBe('sw2d.simulation');
  });

  it('addResource clamps at 0 and emits simulation:resourceChanged', () => {
    const context = createFakeGameContext();
    simulationPack.install(context, undefined);
    const simulation = context.capabilities.require<SimulationService>('simulation.resources');

    const changes: unknown[] = [];
    context.events.on('simulation:resourceChanged', (payload) => changes.push(payload));

    expect(simulation.addResource('wood', 10)).toBe(10);
    expect(simulation.addResource('wood', -100)).toBe(0);
    expect(changes).toEqual([
      { resourceId: 'wood', amount: 10, delta: 10 },
      { resourceId: 'wood', amount: 0, delta: -100 },
    ]);
  });

  it('rejects a duplicate job id and a negative duration', () => {
    const context = createFakeGameContext();
    simulationPack.install(context, undefined);
    const simulation = context.capabilities.require<SimulationService>('simulation.resources');

    simulation.queueJob('smelt-iron', 1000);
    expect(() => simulation.queueJob('smelt-iron', 500)).toThrow(DuplicateSimulationJobError);
    expect(() => simulation.queueJob('bad', -1)).toThrow(RangeError);
  });

  it('completes a job deterministically after enough update(deltaMs) ticks, not before', () => {
    const context = createFakeGameContext();
    const installed = simulationPack.install(context, undefined);
    const simulation = context.capabilities.require<SimulationService>('simulation.resources');
    simulation.queueJob('smelt-iron', 100);

    installed.update?.(40);
    expect(simulation.isJobComplete('smelt-iron')).toBe(false);
    installed.update?.(40);
    expect(simulation.isJobComplete('smelt-iron')).toBe(false);
    installed.update?.(40); // 120ms total >= 100ms duration
    expect(simulation.isJobComplete('smelt-iron')).toBe(true);
  });

  it('a cancelled job never completes', () => {
    const context = createFakeGameContext();
    const installed = simulationPack.install(context, undefined);
    const simulation = context.capabilities.require<SimulationService>('simulation.resources');
    simulation.queueJob('smelt-iron', 100);

    expect(simulation.cancelJob('smelt-iron')).toBe(true);
    installed.update?.(1000);
    expect(() => simulation.isJobComplete('smelt-iron')).toThrow(UnknownSimulationJobError);
  });

  it('listJobs() is sorted and reflects only active (not completed) jobs', () => {
    const context = createFakeGameContext();
    const installed = simulationPack.install(context, undefined);
    const simulation = context.capabilities.require<SimulationService>('simulation.resources');
    simulation.queueJob('b-job', 100);
    simulation.queueJob('a-job', 100);

    expect(simulation.listJobs().map((job) => job.id)).toEqual(['a-job', 'b-job']);
    installed.update?.(200);
    expect(simulation.listJobs()).toEqual([]);
  });

  it('withdraws the capability on dispose', () => {
    const context = createFakeGameContext();
    const installed = simulationPack.install(context, undefined);

    installed.dispose();

    expect(context.capabilities.has('simulation.resources')).toBe(false);
  });

  it('formats large amounts', () => {
    expect(formatSimulationAmount(12)).toBe('12');
    expect(formatSimulationAmount(12.4)).toBe('12.4');
    expect(formatSimulationAmount(1500)).toBe('1.5K');
    expect(formatSimulationAmount(2_000_000)).toBe('2M');
  });

  it('ticks catalog production, prestiges, and applies a capped catch-up', () => {
    const catalog: SimulationCatalog = {
      schemaVersion: 1,
      persist: true,
      resources: [{ id: 'gold', amount: 0, ratePerSecond: 10 }],
      offline: { maxMs: 2000, discontinuityMs: 10_000 },
      prestige: { resourceId: 'gold', cost: 20, multiplier: 2 },
    };
    const { simulation, installed } = install(catalog, new MemorySaves());
    installed.update?.(1000);
    expect(simulation.resource('gold')).toBeCloseTo(10, 5);
    simulation.addResource('gold', 10);
    const first = simulation.prestige();
    expect(first.ok).toBe(true);
    expect(first.level).toBe(1);
    expect(simulation.resource('gold')).toBe(0);
    expect(simulation.prestigeMultiplier()).toBe(2);
    installed.update?.(1000);
    expect(simulation.resource('gold')).toBeCloseTo(20, 5);

    simulation.recordWallClock(1000);
    const capped = simulation.catchUp(1000 + 8000);
    expect(capped.reason).toBe('applied');
    expect(capped.appliedMs).toBe(2000);
    const skipped = simulation.catchUp(1000);
    expect(skipped.reason).toBe('backwards');
    simulation.recordWallClock(0);
    const jump = simulation.catchUp(50_000);
    expect(jump.reason).toBe('discontinuity');
  });

  it('plants, waters, grows and harvests catalog plots', () => {
    const catalog: SimulationCatalog = {
      schemaVersion: 1,
      resources: [{ id: 'crops', amount: 0 }],
      plots: [{ id: 'p0' }, { id: 'p1' }],
      crops: [{ id: 'wheat', growMs: 100, waterRequired: true, yield: 1, resourceId: 'crops' }],
      seasons: [{ id: 'spring', durationMs: 2000, growScale: 1 }],
      harvestTarget: 2,
    };
    const { simulation, installed } = install(catalog);
    expect(simulation.workPlot(0)).toEqual({ ok: true, reason: 'planted' });
    expect(simulation.plots()[0]?.phase).toBe('dry');
    expect(simulation.workPlot(0)).toEqual({ ok: true, reason: 'watered' });
    expect(simulation.plots()[0]?.phase).toBe('growing');
    expect(simulation.workPlot(0).reason).toBe('growing');
    installed.update?.(120);
    expect(simulation.plots()[0]?.phase).toBe('ripe');
    expect(simulation.workPlot(0)).toEqual({ ok: true, reason: 'harvested' });
    expect(simulation.resource('crops')).toBe(1);
    expect(simulation.plots()[0]?.phase).toBe('empty');
    expect(simulation.season()).toBe('spring');
    expect(simulation.harvestTarget()).toBe(2);
  });
});
