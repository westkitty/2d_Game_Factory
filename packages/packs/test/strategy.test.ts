import { describe, expect, it } from 'vitest';
import type { StrategyService } from '../src/strategy/strategyPack.ts';
import { DuplicateTeamError, NoTeamsRegisteredError, strategyPack } from '../src/strategy/strategyPack.ts';
import { createFakeGameContext } from './testSupport.ts';

describe('strategyPack', () => {
  it('installs and publishes the strategy capability with no active team yet', () => {
    const context = createFakeGameContext();
    const installed = strategyPack.install(context, undefined);
    const strategy = context.capabilities.require<StrategyService>('strategy');

    expect(strategy.activeTeam()).toBeNull();
    expect(strategy.turnNumber()).toBe(0);
    expect(installed.id).toBe('sw2d.strategy');
  });

  it('rejects a duplicate team id', () => {
    const context = createFakeGameContext();
    strategyPack.install(context, undefined);
    const strategy = context.capabilities.require<StrategyService>('strategy');
    strategy.registerTeam('red');

    expect(() => strategy.registerTeam('red')).toThrow(DuplicateTeamError);
  });

  it('fails to advance a turn with no registered teams', () => {
    const context = createFakeGameContext();
    strategyPack.install(context, undefined);
    const strategy = context.capabilities.require<StrategyService>('strategy');

    expect(() => strategy.advanceTurn()).toThrow(NoTeamsRegisteredError);
  });

  it('round-robins turns in registration order and emits strategy:turnChanged', () => {
    const context = createFakeGameContext();
    strategyPack.install(context, undefined);
    const strategy = context.capabilities.require<StrategyService>('strategy');
    strategy.registerTeam('red');
    strategy.registerTeam('blue');

    const changes: unknown[] = [];
    context.events.on('strategy:turnChanged', (payload) => changes.push(payload));

    expect(strategy.advanceTurn()).toBe('red');
    expect(strategy.advanceTurn()).toBe('blue');
    expect(strategy.advanceTurn()).toBe('red'); // wraps around
    expect(strategy.turnNumber()).toBe(3);
    expect(changes).toEqual([
      { team: 'red', turnNumber: 1 },
      { team: 'blue', turnNumber: 2 },
      { team: 'red', turnNumber: 3 },
    ]);
  });

  it('tracks selection independently of turn state', () => {
    const context = createFakeGameContext();
    strategyPack.install(context, undefined);
    const strategy = context.capabilities.require<StrategyService>('strategy');

    expect(strategy.selected()).toBeNull();
    strategy.select('unit-7');
    expect(strategy.selected()).toBe('unit-7');
    strategy.deselect();
    expect(strategy.selected()).toBeNull();
  });

  it('withdraws the capability on dispose', () => {
    const context = createFakeGameContext();
    const installed = strategyPack.install(context, undefined);

    installed.dispose();

    expect(context.capabilities.has('strategy')).toBe(false);
  });
});
