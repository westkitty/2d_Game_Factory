import { describe, expect, it } from 'vitest';
import {
  InvalidStrategyActionsError,
  ORDER_KINDS,
  ORDER_QUEUE_MODES,
  ORDER_TARGET_KINDS,
  STRATEGY_ORDERS_CAPABILITY_ID,
  STRATEGY_TACTICS_CAPABILITY_ID,
  isResolvedOrderStatus,
  orderTargetDistance,
  orderTargetPoint,
  validateStrategyActionsDocument,
  type StrategyActionsDocument,
} from '../src/index.ts';

describe('strategy orders contract', () => {
  it('publishes the two Phase 14 capability ids', () => {
    expect(STRATEGY_ORDERS_CAPABILITY_ID).toBe('strategy.orders');
    expect(STRATEGY_TACTICS_CAPABILITY_ID).toBe('strategy.tactics');
  });

  it('enumerates order kinds, target kinds and queue modes', () => {
    expect(ORDER_KINDS).toContain('attack-move');
    expect(ORDER_KINDS).toHaveLength(8);
    expect(ORDER_TARGET_KINDS).toEqual(['none', 'position', 'entity', 'region', 'direction']);
    expect(ORDER_QUEUE_MODES).toEqual(['replace', 'append', 'front']);
  });

  it('classifies terminal order statuses', () => {
    expect(isResolvedOrderStatus('queued')).toBe(false);
    expect(isResolvedOrderStatus('active')).toBe(false);
    expect(isResolvedOrderStatus('completed')).toBe(true);
    expect(isResolvedOrderStatus('cancelled')).toBe(true);
    expect(isResolvedOrderStatus('failed')).toBe(true);
  });

  it('resolves target centre points, and returns null where there is none', () => {
    expect(orderTargetPoint({ kind: 'position', x: 10, y: 20 })).toEqual({ x: 10, y: 20 });
    expect(orderTargetPoint({ kind: 'region', x: 0, y: 0, width: 40, height: 20 })).toEqual({ x: 20, y: 10 });
    expect(orderTargetPoint({ kind: 'none' })).toBeNull();
    expect(orderTargetPoint({ kind: 'direction', dx: 1, dy: 0 })).toBeNull();
    expect(orderTargetPoint({ kind: 'entity', entityId: 'e1' })).toBeNull();
  });

  it('measures distance to a target, resolving entity targets through the locator', () => {
    const from = { x: 0, y: 0 };
    const locate = (id: string) => (id === 'e1' ? { x: 3, y: 4 } : undefined);
    expect(orderTargetDistance(from, { kind: 'entity', entityId: 'e1' }, locate)).toBe(5);
    expect(orderTargetDistance(from, { kind: 'entity', entityId: 'missing' }, locate)).toBeNull();
    expect(orderTargetDistance(from, { kind: 'position', x: 0, y: 8 }, locate)).toBe(8);
    expect(orderTargetDistance(from, { kind: 'none' }, locate)).toBeNull();
    expect(orderTargetDistance(from, { kind: 'direction', dx: 1, dy: 1 }, locate)).toBeNull();
  });
});

describe('validateStrategyActionsDocument', () => {
  const ok: StrategyActionsDocument = {
    schemaVersion: 1,
    actionPointsPerTurn: 2,
    actions: [
      { id: 'strike', targeting: 'entity', range: 80, cost: 1, targetFilter: 'enemy' },
      { id: 'brace', targeting: 'none', range: 0, cost: 1, usesPerTurn: 1 },
    ],
  };

  it('accepts a well-formed document', () => {
    expect(() => validateStrategyActionsDocument(ok)).not.toThrow();
  });

  it('rejects duplicate action ids', () => {
    expect(() =>
      validateStrategyActionsDocument({
        schemaVersion: 1,
        actions: [
          { id: 'strike', targeting: 'entity', range: 10 },
          { id: 'strike', targeting: 'entity', range: 20 },
        ],
      }),
    ).toThrow(InvalidStrategyActionsError);
  });

  it('rejects a negative range, cost or actionPointsPerTurn', () => {
    expect(() =>
      validateStrategyActionsDocument({ schemaVersion: 1, actions: [{ id: 'a', targeting: 'position', range: -1 }] }),
    ).toThrow(/range must be >= 0/);
    expect(() =>
      validateStrategyActionsDocument({ schemaVersion: 1, actions: [{ id: 'a', targeting: 'position', range: 5, cost: -2 }] }),
    ).toThrow(/cost must be >= 0/);
    expect(() =>
      validateStrategyActionsDocument({ schemaVersion: 1, actionPointsPerTurn: -1, actions: [] }),
    ).toThrow(/actionPointsPerTurn must be >= 0/);
  });

  it('rejects minRange greater than range', () => {
    expect(() =>
      validateStrategyActionsDocument({
        schemaVersion: 1,
        actions: [{ id: 'mortar', targeting: 'position', range: 40, minRange: 90 }],
      }),
    ).toThrow(/must not exceed range/);
  });

  it('rejects a non-integer cooldown and a usesPerTurn below 1', () => {
    expect(() =>
      validateStrategyActionsDocument({
        schemaVersion: 1,
        actions: [{ id: 'a', targeting: 'position', range: 5, cooldownTicks: 1.5 }],
      }),
    ).toThrow(/cooldownTicks must be a non-negative integer/);
    expect(() =>
      validateStrategyActionsDocument({
        schemaVersion: 1,
        actions: [{ id: 'a', targeting: 'position', range: 5, usesPerTurn: 0 }],
      }),
    ).toThrow(/usesPerTurn must be an integer >= 1/);
  });

  it('rejects a targetless action that also declares a range', () => {
    expect(() =>
      validateStrategyActionsDocument({ schemaVersion: 1, actions: [{ id: 'brace', targeting: 'none', range: 50 }] }),
    ).toThrow(/targeting "none" cannot declare a range/);
  });
});
