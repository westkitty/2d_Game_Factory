import { describe, expect, it } from 'vitest';
import type { AiService } from '../src/ai/aiPack.ts';
import { aiPack, DuplicateAiAgentError, InvalidAiStateError, UnknownAiAgentError } from '../src/ai/aiPack.ts';
import type { CombatService } from '../src/combat/combatPack.ts';
import { combatPack } from '../src/combat/combatPack.ts';
import { createFakeGameContext } from './testSupport.ts';

function installAiWithCombat(context: ReturnType<typeof createFakeGameContext>) {
  combatPack.install(context, undefined);
  return aiPack.install(context, undefined);
}

describe('aiPack', () => {
  it('installs and publishes the ai capability, defaulting to idle', () => {
    const context = createFakeGameContext();
    const installed = installAiWithCombat(context);
    const ai = context.capabilities.require<AiService>('ai.state');

    ai.register('goblin');
    expect(ai.state('goblin')).toBe('idle');
    expect(installed.id).toBe('sw2d.ai');
  });

  it('accepts an explicit initial state and rejects a duplicate registration', () => {
    const context = createFakeGameContext();
    installAiWithCombat(context);
    const ai = context.capabilities.require<AiService>('ai.state');

    ai.register('goblin', 'patrol');
    expect(ai.state('goblin')).toBe('patrol');
    expect(() => ai.register('goblin')).toThrow(DuplicateAiAgentError);
  });

  it('transitions state and emits ai:stateChanged only on an actual change', () => {
    const context = createFakeGameContext();
    installAiWithCombat(context);
    const ai = context.capabilities.require<AiService>('ai.state');
    ai.register('goblin');

    const changes: unknown[] = [];
    context.events.on('ai:stateChanged', (payload) => changes.push(payload));

    ai.setState('goblin', 'chase');
    expect(ai.state('goblin')).toBe('chase');
    expect(changes).toEqual([{ agentId: 'goblin', from: 'idle', to: 'chase' }]);

    ai.setState('goblin', 'chase'); // no-op: same state
    expect(changes).toHaveLength(1);
  });

  it('rejects an invalid state at the runtime boundary, not just via the TS union', () => {
    const context = createFakeGameContext();
    installAiWithCombat(context);
    const ai = context.capabilities.require<AiService>('ai.state');
    ai.register('goblin');

    expect(() => ai.setState('goblin', 'berserk' as never)).toThrow(InvalidAiStateError);
  });

  it('throws for an unknown agent', () => {
    const context = createFakeGameContext();
    installAiWithCombat(context);
    const ai = context.capabilities.require<AiService>('ai.state');

    expect(() => ai.state('ghost')).toThrow(UnknownAiAgentError);
  });

  it('list() is sorted and removal drops the agent', () => {
    const context = createFakeGameContext();
    installAiWithCombat(context);
    const ai = context.capabilities.require<AiService>('ai.state');
    ai.register('b');
    ai.register('a');

    expect(ai.list()).toEqual(['a', 'b']);
    ai.remove('a');
    expect(ai.list()).toEqual(['b']);
  });

  it('isAgentAlive() consumes combat by capability id, not by importing its module', () => {
    const context = createFakeGameContext();
    installAiWithCombat(context);
    const ai = context.capabilities.require<AiService>('ai.state');
    const combat = context.capabilities.require<CombatService>('combat.health');
    ai.register('goblin');
    combat.register('goblin', 5);

    expect(ai.isAgentAlive('goblin')).toBe(true);
    combat.damage('goblin', 5, 0);
    expect(ai.isAgentAlive('goblin')).toBe(false);
  });

  it('fails to install without the combat capability already present', () => {
    const context = createFakeGameContext();
    expect(() => aiPack.install(context, undefined)).toThrow(/combat/);
  });

  it('withdraws the ai capability on dispose, leaving combat untouched', () => {
    const context = createFakeGameContext();
    combatPack.install(context, undefined);
    const installed = aiPack.install(context, undefined);

    installed.dispose();

    expect(context.capabilities.has('ai.state')).toBe(false);
    expect(context.capabilities.has('combat.health')).toBe(true);
  });
});
