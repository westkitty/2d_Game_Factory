import { describe, expect, it } from 'vitest';
import type { AutoCombatDocument, AutoCombatService } from '@sw2d/contracts';
import { autoCombatPack } from '../src/autoCombat/autoCombatPack.ts';
import { combatPack } from '../src/combat/combatPack.ts';
import { weaponsPack } from '../src/weapons/weaponsPack.ts';
import { createFakeGameContext } from './testSupport.ts';

const document: AutoCombatDocument = {
  schemaVersion: 1,
  archetypes: [
    { id: 'red-duelist', teamId: 'red', weaponId: 'red-dart', range: 3, moveSpeed: 8, maxHealth: 10, targetPolicy: 'nearest', reassessMs: 250 },
    { id: 'blue-guard', teamId: 'blue', weaponId: 'blue-dart', range: 3, moveSpeed: 2, maxHealth: 10, targetPolicy: 'highest-threat', threat: 4, roleTags: ['tank'] },
  ],
  slots: [{ id: 'red-a', teamId: 'red', x: 0, y: 0 }, { id: 'blue-a', teamId: 'blue', x: 10, y: 0 }],
};

function context() {
  const base = createFakeGameContext();
  return { ...base, content: { ...base.content, data: {
    'auto-combat': { schemaId: 'auto-combat', valid: true as const, value: document },
    weapons: { schemaId: 'weapons', valid: true as const, value: { schemaVersion: 1, weapons: [
      { id: 'red-dart', displayName: 'Red Dart', cooldownMs: 100, fireMode: 'single', team: 'red', projectile: { speed: 1, lifetimeMs: 1, damage: 3 } },
      { id: 'blue-dart', displayName: 'Blue Dart', cooldownMs: 100, fireMode: 'single', team: 'blue', projectile: { speed: 1, lifetimeMs: 1, damage: 2 } },
    ] } },
  } } };
}

describe('auto-combat pack', () => {
  it('deploys bounded slots, advances autonomously, resolves and resets', () => {
    const game = context(); combatPack.install(game, undefined); const weapons = weaponsPack.install(game, undefined);
    const installed = autoCombatPack.install(game, {});
    const service = game.capabilities.require<AutoCombatService>('strategy.auto-combat');
    expect(service.deploy('red-duelist', 'blue-a')).toMatchObject({ ok: false, reason: 'wrong-team' });
    expect(service.deploy('red-duelist', 'red-a').ok).toBe(true);
    expect(service.deploy('blue-guard', 'blue-a').ok).toBe(true);
    expect(service.start()).toBe(true);
    // The host advances every installed pack. Keep weapon cooldowns progressing
    // while the auto-combat orchestrator makes decisions.
    for (let i = 0; i < 50 && service.phase() === 'battle'; i++) {
      weapons.update?.(100);
      installed.update?.(100);
    }
    expect(service.phase()).toBe('resolve');
    expect(service.winner()).toBe('red');
    expect(service.drainEvents().some((event) => event.kind === 'round-complete')).toBe(true);
    service.reset();
    expect(service.phase()).toBe('deploy');
    expect(service.units()).toEqual([]);
  });
});
