import { describe, expect, it } from 'vitest';
import type { CombatService } from '../src/combat/combatPack.ts';
import { combatPack, DuplicateCombatEntityError, UnknownCombatEntityError } from '../src/combat/combatPack.ts';
import { createFakeGameContext } from './testSupport.ts';

describe('combatPack', () => {
  it('installs and publishes the combat capability', () => {
    const context = createFakeGameContext();
    const installed = combatPack.install(context, undefined);

    expect(context.capabilities.has('combat')).toBe(true);
    expect(context.capabilities.require<CombatService>('combat')).toBeDefined();
    expect(installed.id).toBe('sw2d.combat');
  });

  it('registers an entity at full health and rejects a duplicate', () => {
    const context = createFakeGameContext();
    combatPack.install(context, undefined);
    const combat = context.capabilities.require<CombatService>('combat');

    combat.register('goblin-1', 10);
    expect(combat.get('goblin-1')).toEqual({ current: 10, max: 10, invulnerableUntilMs: 0 });
    expect(() => combat.register('goblin-1', 5)).toThrow(DuplicateCombatEntityError);
  });

  it('clamps damage at 0 and heal at max - bounded and deterministic', () => {
    const context = createFakeGameContext();
    combatPack.install(context, undefined);
    const combat = context.capabilities.require<CombatService>('combat');
    combat.register('goblin-1', 10);

    expect(combat.damage('goblin-1', 4, 0).current).toBe(6);
    expect(combat.damage('goblin-1', 100, 0).current).toBe(0);
    expect(combat.heal('goblin-1', 100).current).toBe(10);

    // Same inputs, same outputs - no RNG, no hidden state.
    combat.register('goblin-2', 10);
    expect(combat.damage('goblin-2', 4, 0)).toEqual(combat.damage('goblin-1', 4, 999));
  });

  it('rejects damage while invulnerable, without mutating state or emitting an event', () => {
    const context = createFakeGameContext();
    combatPack.install(context, undefined);
    const combat = context.capabilities.require<CombatService>('combat');
    combat.register('player', 10);
    combat.setInvulnerableFor('player', 500, 1000);

    let damagedEvents = 0;
    context.events.on('combat:entityDamaged', () => {
      damagedEvents += 1;
    });

    const result = combat.damage('player', 5, 1200); // still within [1000, 1500)
    expect(result.current).toBe(10);
    expect(damagedEvents).toBe(0);

    const afterWindow = combat.damage('player', 5, 1600);
    expect(afterWindow.current).toBe(5);
    expect(damagedEvents).toBe(1);
  });

  it('emits combat:entityDamaged and combat:entityDied at the right moments', () => {
    const context = createFakeGameContext();
    combatPack.install(context, undefined);
    const combat = context.capabilities.require<CombatService>('combat');
    combat.register('goblin', 5);

    const damaged: unknown[] = [];
    const died: unknown[] = [];
    context.events.on('combat:entityDamaged', (payload) => damaged.push(payload));
    context.events.on('combat:entityDied', (payload) => died.push(payload));

    combat.damage('goblin', 3, 0);
    expect(damaged).toEqual([{ entityId: 'goblin', amount: 3, current: 2 }]);
    expect(died).toEqual([]);

    combat.damage('goblin', 10, 0);
    expect(died).toEqual([{ entityId: 'goblin' }]);
    // Already dead: further damage clamps at 0 but does not re-emit death.
    combat.damage('goblin', 1, 0);
    expect(died).toHaveLength(1);
  });

  it('rejects negative or non-finite amounts', () => {
    const context = createFakeGameContext();
    combatPack.install(context, undefined);
    const combat = context.capabilities.require<CombatService>('combat');
    combat.register('goblin', 10);

    expect(() => combat.damage('goblin', -1, 0)).toThrow(RangeError);
    expect(() => combat.damage('goblin', Number.NaN, 0)).toThrow(RangeError);
    expect(() => combat.register('x', -5)).toThrow(RangeError);
  });

  it('throws a named error for an unknown entity, and lets remove() be idempotent', () => {
    const context = createFakeGameContext();
    combatPack.install(context, undefined);
    const combat = context.capabilities.require<CombatService>('combat');

    expect(() => combat.get('ghost')).toThrow(UnknownCombatEntityError);
    expect(() => combat.remove('ghost')).not.toThrow();
  });

  it('list() is sorted and reflects removal', () => {
    const context = createFakeGameContext();
    combatPack.install(context, undefined);
    const combat = context.capabilities.require<CombatService>('combat');
    combat.register('b', 5);
    combat.register('a', 5);

    expect(combat.list()).toEqual(['a', 'b']);
    combat.remove('a');
    expect(combat.list()).toEqual(['b']);
  });

  it('withdraws the capability on dispose', () => {
    const context = createFakeGameContext();
    const installed = combatPack.install(context, undefined);
    expect(context.capabilities.has('combat')).toBe(true);

    installed.dispose();

    expect(context.capabilities.has('combat')).toBe(false);
  });
});
