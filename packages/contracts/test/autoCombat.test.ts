import { describe, expect, it } from 'vitest';
import { moveToward, selectAutoCombatTarget, validateAutoCombatDocument } from '../src/autoCombat.ts';

describe('auto combat contracts', () => {
  const candidates = [
    { id: 'brute', teamId: 'blue', x: 8, y: 0, health: 10, threat: 8, roleTags: ['tank'] },
    { id: 'mage-b', teamId: 'blue', x: 4, y: 0, health: 2, threat: 4, roleTags: ['mage'] },
    { id: 'mage-a', teamId: 'blue', x: 4, y: 0, health: 2, threat: 4, roleTags: ['mage'] },
  ];
  it('uses policy then distance then stable id', () => {
    expect(selectAutoCombatTarget('lowest-health', undefined, { x: 0, y: 0 }, candidates)?.id).toBe('mage-a');
    expect(selectAutoCombatTarget('highest-threat', undefined, { x: 0, y: 0 }, candidates)?.id).toBe('brute');
    expect(selectAutoCombatTarget('preferred-role', 'mage', { x: 0, y: 0 }, candidates)?.id).toBe('mage-a');
  });
  it('moves without overshooting', () => {
    expect(moveToward({ x: 0, y: 0 }, { x: 3, y: 4 }, 2)).toEqual({ x: 1.2, y: 1.6 });
    expect(moveToward({ x: 0, y: 0 }, { x: 3, y: 4 }, 8)).toEqual({ x: 3, y: 4 });
  });
  it('rejects duplicate deployment slots', () => {
    expect(() => validateAutoCombatDocument({ schemaVersion: 1, archetypes: [], slots: [{ id: 'a', teamId: 'red', x: 0, y: 0 }, { id: 'a', teamId: 'blue', x: 1, y: 0 }] })).toThrow('defined more than once');
  });
});
