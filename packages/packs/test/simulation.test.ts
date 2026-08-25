import { describe, expect, it } from 'vitest';
import type { SimulationService } from '../src/simulation/simulationPack.ts';
import {
  DuplicateSimulationJobError,
  UnknownSimulationJobError,
  simulationPack,
} from '../src/simulation/simulationPack.ts';
import { createFakeGameContext } from './testSupport.ts';

describe('simulationPack', () => {
  it('installs and publishes the simulation capability', () => {
    const context = createFakeGameContext();
    const installed = simulationPack.install(context, undefined);

    expect(context.capabilities.has('simulation')).toBe(true);
    expect(installed.id).toBe('sw2d.simulation');
  });

  it('addResource clamps at 0 and emits simulation:resourceChanged', () => {
    const context = createFakeGameContext();
    simulationPack.install(context, undefined);
    const simulation = context.capabilities.require<SimulationService>('simulation');

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
    const simulation = context.capabilities.require<SimulationService>('simulation');

    simulation.queueJob('smelt-iron', 1000);
    expect(() => simulation.queueJob('smelt-iron', 500)).toThrow(DuplicateSimulationJobError);
    expect(() => simulation.queueJob('bad', -1)).toThrow(RangeError);
  });

  it('completes a job deterministically after enough update(deltaMs) ticks, not before', () => {
    const context = createFakeGameContext();
    const installed = simulationPack.install(context, undefined);
    const simulation = context.capabilities.require<SimulationService>('simulation');
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
    const simulation = context.capabilities.require<SimulationService>('simulation');
    simulation.queueJob('smelt-iron', 100);

    expect(simulation.cancelJob('smelt-iron')).toBe(true);
    installed.update?.(1000);
    expect(() => simulation.isJobComplete('smelt-iron')).toThrow(UnknownSimulationJobError);
  });

  it('listJobs() is sorted and reflects only active (not completed) jobs', () => {
    const context = createFakeGameContext();
    const installed = simulationPack.install(context, undefined);
    const simulation = context.capabilities.require<SimulationService>('simulation');
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

    expect(context.capabilities.has('simulation')).toBe(false);
  });
});
