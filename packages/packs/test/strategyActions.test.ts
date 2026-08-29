import { describe, expect, it } from 'vitest';
import type {
  GameContext,
  OrderActorSnapshot,
  OrderExecutionOutcome,
  OrderWorldAdapter,
  StrategyActionsDocument,
  StrategyOrder,
  StrategyOrdersService,
  StrategyTacticsService,
} from '@sw2d/contracts';
import { createFakeGameContext } from './testSupport.ts';
import {
  strategyActionsPack,
  MissingWorldAdapterError,
  WorldAdapterAlreadySetError,
  DuplicateOrderGroupError,
  UnknownOrderGroupError,
} from '../src/strategyActions/strategyActionsPack.ts';

/**
 * A minimal but *real* world: actors with positions and life, a move rule that
 * steps toward a target and completes on arrival, and an attack rule that
 * chips health. Nothing here reaches into the service - the adapter only ever
 * reports progress, exactly as a generated game's adapter would.
 */
class TestWorld implements OrderWorldAdapter {
  readonly actors = new Map<string, { x: number; y: number; hp: number; teamId?: string }>();
  readonly begun: string[] = [];
  readonly ended: { orderId: string; status: string }[] = [];
  speed = 10;

  add(actorId: string, x: number, y: number, teamId?: string, hp = 100): void {
    this.actors.set(actorId, { x, y, hp, ...(teamId !== undefined ? { teamId } : {}) });
  }

  kill(actorId: string): void {
    const a = this.actors.get(actorId);
    if (a) a.hp = 0;
  }

  remove(actorId: string): void {
    this.actors.delete(actorId);
  }

  actor(actorId: string): OrderActorSnapshot | undefined {
    const a = this.actors.get(actorId);
    if (!a) return undefined;
    return { actorId, x: a.x, y: a.y, alive: a.hp > 0, ...(a.teamId !== undefined ? { teamId: a.teamId } : {}) };
  }

  begin(order: StrategyOrder): OrderExecutionOutcome {
    this.begun.push(order.orderId);
    return { progress: 'running' };
  }

  end(order: StrategyOrder, status: string): void {
    this.ended.push({ orderId: order.orderId, status });
  }

  advance(order: StrategyOrder): OrderExecutionOutcome {
    const self = this.actors.get(order.actorId);
    if (!self) return { progress: 'failed', reason: 'actor-removed' };

    if (order.kind === 'hold' || order.kind === 'guard') return { progress: 'running' };

    if (order.kind === 'move' && order.target.kind === 'position') {
      const dx = order.target.x - self.x;
      const dy = order.target.y - self.y;
      const dist = Math.hypot(dx, dy);
      if (dist <= this.speed) {
        self.x = order.target.x;
        self.y = order.target.y;
        return { progress: 'complete' };
      }
      self.x += (dx / dist) * this.speed;
      self.y += (dy / dist) * this.speed;
      return { progress: 'running' };
    }

    if (order.kind === 'attack-move' && order.target.kind === 'entity') {
      // Chase: never completes on its own in these tests, so the service's
      // target-lost handling is what ends it.
      const target = this.actors.get(order.target.entityId);
      if (!target) return { progress: 'failed', reason: 'target-lost' };
      return { progress: 'running' };
    }

    if ((order.kind === 'attack' || order.kind === 'ability') && order.target.kind === 'entity') {
      const target = this.actors.get(order.target.entityId);
      if (!target) return { progress: 'failed', reason: 'target-lost' };
      target.hp -= 40;
      return { progress: 'complete' };
    }

    return { progress: 'complete' };
  }
}

const SAMPLE_ACTIONS: StrategyActionsDocument = {
  schemaVersion: 1,
  actionPointsPerTurn: 2,
  actions: [
    { id: 'strike', displayName: 'Strike', orderKind: 'attack', targeting: 'entity', range: 60, cost: 1, targetFilter: 'enemy' },
    { id: 'snipe', orderKind: 'attack', targeting: 'entity', range: 400, minRange: 100, cost: 2, cooldownTicks: 3, targetFilter: 'enemy' },
    { id: 'brace', targeting: 'none', range: 0, cost: 1, usesPerTurn: 1 },
    { id: 'rally', targeting: 'entity', range: 200, cost: 1, targetFilter: 'ally' },
    { id: 'command-only', targeting: 'position', range: 500, cost: 0, requiresTeam: 'blue' },
  ],
};

function createContext(doc?: StrategyActionsDocument): GameContext {
  const base = createFakeGameContext();
  const data: Record<string, { schemaId: string; valid: true; value: unknown }> = {};
  if (doc) data['strategy-actions'] = { schemaId: 'strategy-actions', valid: true, value: doc };
  return { ...base, content: { ...base.content, data } };
}

function install(doc?: StrategyActionsDocument, config: Record<string, unknown> = {}) {
  const context = createContext(doc);
  const installed = strategyActionsPack.install(context, config);
  const orders = context.capabilities.require<StrategyOrdersService>('strategy.orders');
  const tactics = context.capabilities.require<StrategyTacticsService>('strategy.tactics');
  return { context, installed, orders, tactics };
}

describe('strategyActionsPack installation', () => {
  it('provides both Phase 14 capabilities and releases them on dispose', () => {
    const { context, installed } = install();
    expect(context.capabilities.has('strategy.orders')).toBe(true);
    expect(context.capabilities.has('strategy.tactics')).toBe(true);
    expect(installed.id).toBe('sw2d.strategy-actions');

    installed.dispose();
    expect(context.capabilities.has('strategy.orders')).toBe(false);
    expect(context.capabilities.has('strategy.tactics')).toBe(false);
  });

  it('rejects a malformed tactical-action catalog at install time', () => {
    const bad: StrategyActionsDocument = {
      schemaVersion: 1,
      actions: [
        { id: 'dup', targeting: 'entity', range: 10 },
        { id: 'dup', targeting: 'entity', range: 20 },
      ],
    };
    expect(() => strategyActionsPack.install(createContext(bad), {})).toThrow(/Duplicate tactical action id/);
  });
});

describe('strategy.orders authority', () => {
  it('refuses to issue without a world adapter, and reports adapter presence', () => {
    const { orders } = install();
    expect(orders.hasWorldAdapter()).toBe(false);
    expect(() => orders.issue({ kind: 'hold', actors: ['u1'] })).toThrow(MissingWorldAdapterError);
  });

  it('allows exactly one adapter at a time', () => {
    const { orders } = install();
    const world = new TestWorld();
    const handle = orders.setWorldAdapter(world);
    expect(() => orders.setWorldAdapter(new TestWorld())).toThrow(WorldAdapterAlreadySetError);
    handle.dispose();
    expect(orders.hasWorldAdapter()).toBe(false);
    orders.setWorldAdapter(new TestWorld());
    expect(orders.hasWorldAdapter()).toBe(true);
  });

  it('issues deterministic order ids and stamps the issuing tick', () => {
    const { orders, installed } = install();
    const world = new TestWorld();
    world.add('u1', 0, 0);
    world.add('u2', 0, 0);
    orders.setWorldAdapter(world);

    const first = orders.issue({ kind: 'hold', actors: ['u1', 'u2', 'u1'] });
    expect(first.accepted.map((o) => o.orderId)).toEqual(['ord-1', 'ord-2']); // duplicate u1 dropped
    expect(first.accepted.map((o) => o.actorId)).toEqual(['u1', 'u2']);
    expect(first.accepted.every((o) => o.issuedTick === 0 && o.status === 'queued')).toBe(true);

    installed.update?.(16);
    const second = orders.issue({ kind: 'hold', actors: ['u1'], queueMode: 'append' });
    expect(second.accepted[0]!.orderId).toBe('ord-3');
    expect(second.accepted[0]!.issuedTick).toBe(1);
  });

  it('promotes a queued order to active on the next tick and completes it via the adapter', () => {
    const { orders, installed } = install();
    const world = new TestWorld();
    world.add('u1', 0, 0);
    orders.setWorldAdapter(world);

    const issued = orders.issue({ kind: 'move', actors: ['u1'], target: { kind: 'position', x: 25, y: 0 } });
    const orderId = issued.accepted[0]!.orderId;
    expect(orders.order(orderId)!.status).toBe('queued');
    expect(orders.active('u1')).toBeUndefined();

    installed.update?.(16);
    const active = orders.active('u1');
    expect(active?.orderId).toBe(orderId);
    expect(active?.status).toBe('active');
    expect(active?.startedTick).toBe(1);
    expect(world.begun).toEqual([orderId]);
    expect(world.actors.get('u1')!.x).toBe(10);

    installed.update?.(16);
    expect(world.actors.get('u1')!.x).toBe(20);
    installed.update?.(16);
    expect(world.actors.get('u1')!.x).toBe(25);

    const done = orders.order(orderId)!;
    expect(done.status).toBe('completed');
    expect(done.resolvedTick).toBe(3);
    expect(orders.active('u1')).toBeUndefined();
    expect(orders.history().map((o) => o.orderId)).toEqual([orderId]);
    expect(world.ended).toEqual([{ orderId, status: 'completed' }]);
  });

  it('replaces by default, appends and front-queues on request', () => {
    const { orders, installed } = install();
    const world = new TestWorld();
    world.add('u1', 0, 0);
    orders.setWorldAdapter(world);

    const a = orders.issue({ kind: 'move', actors: ['u1'], target: { kind: 'position', x: 1000, y: 0 } }).accepted[0]!;
    installed.update?.(16); // a becomes active
    expect(orders.active('u1')!.orderId).toBe(a.orderId);

    // append: runs after a
    const b = orders.issue({ kind: 'hold', actors: ['u1'], queueMode: 'append' }).accepted[0]!;
    // front: jumps ahead of b, but does not disturb the active order
    const c = orders.issue({ kind: 'guard', actors: ['u1'], queueMode: 'front' }).accepted[0]!;
    expect(orders.active('u1')!.orderId).toBe(a.orderId);
    expect(orders.queue('u1').map((o) => o.orderId)).toEqual([c.orderId, b.orderId]);

    // replace: cancels the active order and the whole queue
    const d = orders.issue({ kind: 'hold', actors: ['u1'], queueMode: 'replace' }).accepted[0]!;
    expect(orders.active('u1')).toBeUndefined();
    expect(orders.queue('u1').map((o) => o.orderId)).toEqual([d.orderId]);
    for (const id of [a.orderId, b.orderId, c.orderId]) {
      const cancelled = orders.order(id)!;
      expect(cancelled.status).toBe('cancelled');
      expect(cancelled.failureReason).toBe('superseded');
    }
  });

  it('runs higher-priority queued orders first, breaking ties by arrival', () => {
    const { orders } = install();
    const world = new TestWorld();
    world.add('u1', 0, 0);
    orders.setWorldAdapter(world);

    const low = orders.issue({ kind: 'hold', actors: ['u1'], queueMode: 'append', priority: 0 }).accepted[0]!;
    const alsoLow = orders.issue({ kind: 'guard', actors: ['u1'], queueMode: 'append', priority: 0 }).accepted[0]!;
    const high = orders.issue({ kind: 'guard', actors: ['u1'], queueMode: 'append', priority: 5 }).accepted[0]!;

    expect(orders.queue('u1').map((o) => o.orderId)).toEqual([high.orderId, low.orderId, alsoLow.orderId]);
  });

  it('cancels a queued or active order, and stop() clears the whole lane', () => {
    const { orders, installed } = install();
    const world = new TestWorld();
    world.add('u1', 0, 0);
    orders.setWorldAdapter(world);

    const a = orders.issue({ kind: 'hold', actors: ['u1'] }).accepted[0]!;
    expect(orders.cancel(a.orderId)).toBe(true);
    expect(orders.order(a.orderId)!.status).toBe('cancelled');
    expect(orders.cancel(a.orderId)).toBe(false); // already resolved
    expect(orders.cancel('ord-does-not-exist')).toBe(false);

    const b = orders.issue({ kind: 'move', actors: ['u1'], target: { kind: 'position', x: 500, y: 0 } }).accepted[0]!;
    installed.update?.(16);
    expect(orders.active('u1')!.orderId).toBe(b.orderId);
    expect(orders.cancel(b.orderId)).toBe(true);
    expect(orders.active('u1')).toBeUndefined();

    orders.issue({ kind: 'hold', actors: ['u1'], queueMode: 'append' });
    orders.issue({ kind: 'guard', actors: ['u1'], queueMode: 'append' });
    installed.update?.(16); // one becomes active, one stays queued
    expect(orders.stop('u1')).toBe(2);
    expect(orders.active('u1')).toBeUndefined();
    expect(orders.queue('u1')).toEqual([]);
    expect(orders.stop('never-ordered')).toBe(0);
  });

  it('treats a stop order as an immediate lane clear that is itself recorded', () => {
    const { orders, installed } = install();
    const world = new TestWorld();
    world.add('u1', 0, 0);
    orders.setWorldAdapter(world);

    const move = orders.issue({ kind: 'move', actors: ['u1'], target: { kind: 'position', x: 900, y: 0 } }).accepted[0]!;
    installed.update?.(16);
    const stop = orders.issue({ kind: 'stop', actors: ['u1'] }).accepted[0]!;

    expect(orders.order(move.orderId)!.status).toBe('cancelled');
    expect(orders.order(move.orderId)!.failureReason).toBe('superseded');
    expect(orders.order(stop.orderId)!.status).toBe('completed');
    expect(orders.active('u1')).toBeUndefined();
    expect(orders.queue('u1')).toEqual([]);
  });

  it('rejects structurally invalid targets at issue time without creating an order', () => {
    const { orders } = install();
    const world = new TestWorld();
    world.add('u1', 0, 0);
    world.add('enemy', 50, 0);
    orders.setWorldAdapter(world);

    const noTarget = orders.issue({ kind: 'move', actors: ['u1'] });
    expect(noTarget.accepted).toEqual([]);
    expect(noTarget.rejected[0]).toMatchObject({ actorId: 'u1', reason: 'invalid-target' });

    const attackAPlace = orders.issue({ kind: 'attack', actors: ['u1'], target: { kind: 'position', x: 1, y: 1 } });
    expect(attackAPlace.rejected[0]!.reason).toBe('invalid-target');

    const ghost = orders.issue({ kind: 'attack', actors: ['u1'], target: { kind: 'entity', entityId: 'ghost' } });
    expect(ghost.rejected[0]!.reason).toBe('invalid-target');

    const emptyRegion = orders.issue({ kind: 'attack-move', actors: ['u1'], target: { kind: 'region', x: 0, y: 0, width: 0, height: 5 } });
    expect(emptyRegion.rejected[0]!.reason).toBe('invalid-target');

    const zeroDirection = orders.issue({ kind: 'attack-move', actors: ['u1'], target: { kind: 'direction', dx: 0, dy: 0 } });
    expect(zeroDirection.rejected[0]!.reason).toBe('invalid-target');

    expect(orders.pending()).toEqual([]);
  });

  it('rejects a dead target at issue time and fails an order whose target dies mid-flight', () => {
    const { orders, installed } = install();
    const world = new TestWorld();
    world.add('u1', 0, 0);
    world.add('enemy', 500, 0);
    orders.setWorldAdapter(world);

    const chase = orders.issue({ kind: 'attack-move', actors: ['u1'], target: { kind: 'entity', entityId: 'enemy' } }).accepted[0]!;
    installed.update?.(16);
    expect(orders.active('u1')!.orderId).toBe(chase.orderId);

    world.kill('enemy');
    installed.update?.(16);
    const failed = orders.order(chase.orderId)!;
    expect(failed.status).toBe('failed');
    expect(failed.failureReason).toBe('target-lost');

    const retry = orders.issue({ kind: 'attack', actors: ['u1'], target: { kind: 'entity', entityId: 'enemy' } });
    expect(retry.accepted).toEqual([]);
    expect(retry.rejected[0]!.reason).toBe('target-lost');
  });

  it('fails every order of an actor that dies or is removed', () => {
    const { orders, installed } = install();
    const world = new TestWorld();
    world.add('u1', 0, 0);
    orders.setWorldAdapter(world);

    const a = orders.issue({ kind: 'move', actors: ['u1'], target: { kind: 'position', x: 900, y: 0 } }).accepted[0]!;
    const b = orders.issue({ kind: 'hold', actors: ['u1'], queueMode: 'append' }).accepted[0]!;
    installed.update?.(16);

    world.remove('u1');
    installed.update?.(16);

    expect(orders.order(a.orderId)!.status).toBe('failed');
    expect(orders.order(a.orderId)!.failureReason).toBe('actor-removed');
    expect(orders.order(b.orderId)!.status).toBe('failed');
    expect(orders.order(b.orderId)!.failureReason).toBe('actor-removed');
    expect(orders.actors()).toEqual([]);

    world.add('u2', 0, 0);
    const rejected = orders.issue({ kind: 'hold', actors: ['u1', 'u2'] });
    expect(rejected.rejected.map((r) => r.actorId)).toEqual(['u1']);
    expect(rejected.accepted.map((o) => o.actorId)).toEqual(['u2']);
  });

  it('surfaces an adapter refusal as a failed order with the adapter s reason', () => {
    const { orders, installed } = install();
    const world = new TestWorld();
    world.add('u1', 0, 0);
    const refusing: OrderWorldAdapter = {
      actor: (id) => world.actor(id),
      advance: () => ({ progress: 'failed', reason: 'unreachable' }),
    };
    orders.setWorldAdapter(refusing);

    const order = orders.issue({ kind: 'move', actors: ['u1'], target: { kind: 'position', x: 5, y: 5 } }).accepted[0]!;
    installed.update?.(16);
    expect(orders.order(order.orderId)!.status).toBe('failed');
    expect(orders.order(order.orderId)!.failureReason).toBe('unreachable');
  });

  it('advances actors in ascending id order within a tick', () => {
    const { orders, installed } = install();
    const seen: string[] = [];
    const world = new TestWorld();
    for (const id of ['zeta', 'alpha', 'mid']) world.add(id, 0, 0);
    orders.setWorldAdapter({
      actor: (id) => world.actor(id),
      advance: (order) => {
        seen.push(order.actorId);
        return { progress: 'running' };
      },
    });

    orders.issue({ kind: 'hold', actors: ['zeta', 'mid', 'alpha'] });
    installed.update?.(16);
    installed.update?.(16);
    expect(seen.slice(0, 3)).toEqual(['alpha', 'mid', 'zeta']);
  });

  it('addresses a squad through a named group', () => {
    const { orders } = install();
    const world = new TestWorld();
    for (const id of ['a', 'b', 'c']) world.add(id, 0, 0);
    orders.setWorldAdapter(world);

    const group = orders.defineGroup('squad', ['a', 'b', 'b']);
    expect(group.actorIds).toEqual(['a', 'b']);
    expect(orders.groupIds()).toEqual(['squad']);
    expect(() => orders.defineGroup('squad', ['c'])).toThrow(DuplicateOrderGroupError);

    const issued = orders.issue({ kind: 'hold', groupId: 'squad', actors: ['c'] });
    expect(issued.accepted.map((o) => o.actorId)).toEqual(['c', 'a', 'b']);

    expect(() => orders.issue({ kind: 'hold', groupId: 'nope' })).toThrow(UnknownOrderGroupError);
    expect(orders.removeGroup('squad')).toBe(true);
    expect(orders.removeGroup('squad')).toBe(false);
  });

  it('bounds the resolved-order history', () => {
    const { orders } = install(undefined, { historyLimit: 3 });
    const world = new TestWorld();
    world.add('u1', 0, 0);
    orders.setWorldAdapter(world);

    for (let i = 0; i < 6; i++) orders.issue({ kind: 'hold', actors: ['u1'] }); // each replace resolves the last
    expect(orders.history().length).toBeLessThanOrEqual(3);
  });

  it('honours a configured default queue mode', () => {
    const { orders } = install(undefined, { defaultQueueMode: 'append' });
    const world = new TestWorld();
    world.add('u1', 0, 0);
    orders.setWorldAdapter(world);

    orders.issue({ kind: 'hold', actors: ['u1'] });
    orders.issue({ kind: 'guard', actors: ['u1'] });
    expect(orders.queue('u1')).toHaveLength(2); // appended, not replaced
  });

  it('reset() drops orders, groups, history and the tick counter but keeps the adapter', () => {
    const { orders, installed } = install();
    const world = new TestWorld();
    world.add('u1', 0, 0);
    orders.setWorldAdapter(world);

    orders.defineGroup('squad', ['u1']);
    orders.issue({ kind: 'hold', actors: ['u1'] });
    installed.update?.(16);
    expect(orders.tick()).toBe(1);

    orders.reset();
    expect(orders.tick()).toBe(0);
    expect(orders.pending()).toEqual([]);
    expect(orders.history()).toEqual([]);
    expect(orders.groupIds()).toEqual([]);
    expect(orders.hasWorldAdapter()).toBe(true);
    expect(orders.issue({ kind: 'hold', actors: ['u1'] }).accepted[0]!.orderId).toBe('ord-1');
  });

  it('emits orders:issued and orders:resolved', () => {
    const context = createContext();
    const installed = strategyActionsPack.install(context, {});
    const orders = context.capabilities.require<StrategyOrdersService>('strategy.orders');
    const world = new TestWorld();
    world.add('u1', 0, 0);
    orders.setWorldAdapter(world);

    const issued: string[] = [];
    const resolved: { orderId: string; status: string; reason: string | null }[] = [];
    context.events.on('orders:issued', (p) => issued.push(p.orderId));
    context.events.on('orders:resolved', (p) => resolved.push({ orderId: p.orderId, status: p.status, reason: p.reason }));

    const order = orders.issue({ kind: 'move', actors: ['u1'], target: { kind: 'position', x: 5, y: 0 } }).accepted[0]!;
    installed.update?.(16);
    expect(issued).toEqual([order.orderId]);
    expect(resolved).toEqual([{ orderId: order.orderId, status: 'completed', reason: null }]);
  });
});

describe('strategy.tactics', () => {
  function setup() {
    const { orders, tactics, installed, context } = install(SAMPLE_ACTIONS);
    const world = new TestWorld();
    world.add('hero', 0, 0, 'blue');
    world.add('mate', 40, 0, 'blue');
    world.add('foe', 50, 0, 'red');
    world.add('far-foe', 300, 0, 'red');
    orders.setWorldAdapter(world);
    return { orders, tactics, installed, context, world };
  }

  it('reads the catalog and reports action points from the document', () => {
    const { tactics } = setup();
    expect(tactics.definitions().map((a) => a.id)).toEqual(['brace', 'command-only', 'rally', 'snipe', 'strike']);
    expect(tactics.definition('strike')?.range).toBe(60);
    expect(tactics.definition('nope')).toBeUndefined();
    expect(tactics.points('hero')).toBe(2);
  });

  it('validates range, minimum range and target kind', () => {
    const { tactics } = setup();

    const inRange = tactics.validate('strike', 'hero', { kind: 'entity', entityId: 'foe' });
    expect(inRange).toMatchObject({ valid: true, distance: 50, cost: 1, points: 2 });

    const tooFar = tactics.validate('strike', 'hero', { kind: 'entity', entityId: 'far-foe' });
    expect(tooFar).toMatchObject({ valid: false, reason: 'out-of-range', distance: 300 });

    const tooClose = tactics.validate('snipe', 'hero', { kind: 'entity', entityId: 'foe' });
    expect(tooClose).toMatchObject({ valid: false, reason: 'too-close', distance: 50 });

    const wrongKind = tactics.validate('strike', 'hero', { kind: 'position', x: 10, y: 0 });
    expect(wrongKind).toMatchObject({ valid: false, reason: 'invalid-target' });

    expect(tactics.validate('nope', 'hero', { kind: 'none' })).toMatchObject({ valid: false, reason: 'unknown-action' });
    expect(tactics.validate('strike', 'ghost', { kind: 'entity', entityId: 'foe' })).toMatchObject({
      valid: false,
      reason: 'unknown-actor',
    });
  });

  it('enforces ally/enemy target filters and team requirements', () => {
    const { tactics } = setup();
    expect(tactics.validate('strike', 'hero', { kind: 'entity', entityId: 'mate' })).toMatchObject({
      valid: false,
      reason: 'invalid-target',
    });
    expect(tactics.validate('rally', 'hero', { kind: 'entity', entityId: 'mate' })).toMatchObject({ valid: true });
    expect(tactics.validate('rally', 'hero', { kind: 'entity', entityId: 'foe' })).toMatchObject({
      valid: false,
      reason: 'invalid-target',
    });
    // command-only requires team 'blue'
    expect(tactics.validate('command-only', 'foe', { kind: 'position', x: 0, y: 0 })).toMatchObject({
      valid: false,
      reason: 'wrong-team',
    });
    expect(tactics.validate('command-only', 'hero', { kind: 'position', x: 0, y: 0 })).toMatchObject({ valid: true });
  });

  it('spends points, issues an order, and executes it through the world', () => {
    const { tactics, orders, installed, world } = setup();

    const result = tactics.execute('strike', 'hero', { kind: 'entity', entityId: 'foe' });
    expect(result.ok).toBe(true);
    expect(result.spent).toBe(1);
    expect(tactics.points('hero')).toBe(1);

    const order = orders.order(result.orderId!)!;
    expect(order.kind).toBe('attack');
    expect(order.abilityId).toBe('strike');
    expect(order.actorId).toBe('hero');

    installed.update?.(16);
    expect(world.actors.get('foe')!.hp).toBe(60);
    expect(orders.order(result.orderId!)!.status).toBe('completed');
  });

  it('refuses an invalid execution without spending points or starting a cooldown', () => {
    const { tactics, orders } = setup();
    const before = tactics.points('hero');
    const result = tactics.execute('strike', 'hero', { kind: 'entity', entityId: 'far-foe' });

    expect(result).toMatchObject({ ok: false, reason: 'out-of-range', spent: 0 });
    expect(result.orderId).toBeUndefined();
    expect(tactics.points('hero')).toBe(before);
    expect(tactics.cooldown('strike', 'hero')).toBe(0);
    expect(orders.pending()).toEqual([]);
  });

  it('runs down a cooldown in ticks and blocks reuse while it lasts', () => {
    const { tactics, installed } = setup();
    tactics.setPoints('hero', 10);

    const fired = tactics.execute('snipe', 'hero', { kind: 'entity', entityId: 'far-foe' });
    expect(fired.ok).toBe(true);
    expect(fired.cooldownUntilTick).toBe(3);
    expect(tactics.cooldown('snipe', 'hero')).toBe(3);
    expect(tactics.available('hero')).not.toContain('snipe');

    installed.update?.(16);
    installed.update?.(16);
    expect(tactics.cooldown('snipe', 'hero')).toBe(1);
    expect(tactics.execute('snipe', 'hero', { kind: 'entity', entityId: 'far-foe' })).toMatchObject({
      ok: false,
      reason: 'on-cooldown',
    });

    installed.update?.(16);
    expect(tactics.cooldown('snipe', 'hero')).toBe(0);
    expect(tactics.available('hero')).toContain('snipe');
  });

  it('enforces uses-per-turn and restores them on refresh', () => {
    const { tactics } = setup();
    tactics.setPoints('hero', 10);
    expect(tactics.usesRemaining('brace', 'hero')).toBe(1);
    expect(tactics.execute('brace', 'hero', { kind: 'none' }).ok).toBe(true);
    expect(tactics.usesRemaining('brace', 'hero')).toBe(0);
    expect(tactics.execute('brace', 'hero', { kind: 'none' })).toMatchObject({ ok: false, reason: 'no-uses-remaining' });

    tactics.refresh('hero');
    expect(tactics.usesRemaining('brace', 'hero')).toBe(1);
    expect(tactics.points('hero')).toBe(2); // back to actionPointsPerTurn
    expect(tactics.usesRemaining('strike', 'hero')).toBe(Number.POSITIVE_INFINITY);
  });

  it('blocks an action the actor cannot afford', () => {
    const { tactics } = setup();
    tactics.setPoints('hero', 1);
    expect(tactics.validate('snipe', 'hero', { kind: 'entity', entityId: 'far-foe' })).toMatchObject({
      valid: false,
      reason: 'insufficient-points',
    });
    expect(tactics.available('hero')).not.toContain('snipe');
  });

  it('reports a dead actor and a dead target distinctly', () => {
    const { tactics, world } = setup();
    world.kill('foe');
    expect(tactics.validate('strike', 'hero', { kind: 'entity', entityId: 'foe' })).toMatchObject({
      valid: false,
      reason: 'target-lost',
    });
    world.kill('hero');
    expect(tactics.validate('strike', 'hero', { kind: 'entity', entityId: 'mate' })).toMatchObject({
      valid: false,
      reason: 'actor-removed',
    });
  });

  it('reports no-world-adapter rather than pretending an action is legal', () => {
    const { tactics } = install(SAMPLE_ACTIONS);
    expect(tactics.validate('strike', 'hero', { kind: 'entity', entityId: 'foe' })).toMatchObject({
      valid: false,
      reason: 'no-world-adapter',
    });
    expect(tactics.available('hero')).toEqual([]);
  });

  it('refreshes every known actor when called with no id', () => {
    const { tactics } = setup();
    tactics.setPoints('hero', 0);
    tactics.setPoints('mate', 0);
    tactics.refresh();
    expect(tactics.points('hero')).toBe(2);
    expect(tactics.points('mate')).toBe(2);
  });

  it('emits tactics:executed on a successful action', () => {
    const context = createContext(SAMPLE_ACTIONS);
    strategyActionsPack.install(context, {});
    const orders = context.capabilities.require<StrategyOrdersService>('strategy.orders');
    const tactics = context.capabilities.require<StrategyTacticsService>('strategy.tactics');
    const world = new TestWorld();
    world.add('hero', 0, 0, 'blue');
    world.add('foe', 50, 0, 'red');
    orders.setWorldAdapter(world);

    const seen: { actionId: string; spent: number }[] = [];
    context.events.on('tactics:executed', (p) => seen.push({ actionId: p.actionId, spent: p.spent }));
    tactics.execute('strike', 'hero', { kind: 'entity', entityId: 'foe' });
    expect(seen).toEqual([{ actionId: 'strike', spent: 1 }]);
  });
});
