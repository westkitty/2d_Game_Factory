import { describe, expect, it } from 'vitest';
import type { GameContext, SimulationAgentsDocument, SimulationAgentsService } from '@sw2d/contracts';
import { createFakeGameContext } from './testSupport.ts';
import {
  simulationAgentsPack,
  SimulationAgentsServiceImpl,
  MissingSimulationAgentsDocumentError,
  UnknownAgentDefinitionError,
  DuplicateAgentError,
} from '../src/simulationAgents/simulationAgentsPack.ts';

/**
 * A pet: one need that drains, one behaviour that answers it, one that does not.
 * Needs are authored ids - `hunger` here, `oxygen` in an aquarium - so nothing in
 * the pack knows what any of them mean.
 */
const PET: SimulationAgentsDocument = {
  schemaVersion: 1,
  decisionIntervalMs: 100,
  minutesPerSecond: 1,
  needs: [
    { id: 'hunger', minimum: 0, maximum: 100, initial: 100, changePerSecond: -10, warningThreshold: 40, criticalThreshold: 15 },
    { id: 'energy', minimum: 0, maximum: 100, initial: 100, changePerSecond: -2, warningThreshold: 30, criticalThreshold: 10 },
  ],
  behaviors: [
    {
      id: 'eat',
      baseUtility: 0,
      needWeights: { hunger: 10 },
      durationMs: 200,
      cooldownMs: 1000,
      effects: [{ kind: 'need-delta', needId: 'hunger', delta: 80 }, { kind: 'add-tag', tag: 'fed' }],
    },
    { id: 'sleep', baseUtility: 0, needWeights: { energy: 8 }, durationMs: 400, interruptible: false, effects: [{ kind: 'need-set', needId: 'energy', value: 100 }] },
    { id: 'idle', baseUtility: 1, durationMs: 100 },
  ],
  agents: [
    {
      id: 'pet',
      tags: ['creature'],
      needs: ['hunger', 'energy'],
      behaviors: ['eat', 'sleep', 'idle'],
      schedule: [
        { startMinute: 0, endMinute: 720, activity: 'morning' },
        { startMinute: 720, endMinute: 1439, activity: 'evening' },
      ],
    },
  ],
};

/** A colony: two workers, tag-gated work orders, and a groom behaviour with a target. */
const COLONY: SimulationAgentsDocument = {
  schemaVersion: 1,
  decisionIntervalMs: 100,
  needs: [
    { id: 'stamina', minimum: 0, maximum: 100, initial: 100, changePerSecond: -1, warningThreshold: 40, criticalThreshold: 10 },
  ],
  behaviors: [
    { id: 'rest', baseUtility: 0, needWeights: { stamina: 10 }, durationMs: 200, effects: [{ kind: 'need-set', needId: 'stamina', value: 100 }] },
    { id: 'work', baseUtility: 2, durationMs: 200 },
    {
      id: 'greet',
      baseUtility: 0,
      durationMs: 100,
      targetTags: ['colonist'],
      preconditions: [{ kind: 'target-available', tag: 'colonist' }],
      effects: [{ kind: 'relationship-delta', metricId: 'friendship', delta: 5 }],
    },
  ],
  agents: [
    { id: 'colonist', tags: ['colonist', 'hauler'], needs: ['stamina'], behaviors: ['rest', 'work', 'greet'] },
    { id: 'specialist', tags: ['colonist', 'builder'], needs: ['stamina'], behaviors: ['rest', 'work'] },
  ],
  workOrders: [
    { id: 'haul-1', kind: 'haul', priority: 1, requiredAgentTags: ['hauler'], durationMs: 300 },
    { id: 'build-1', kind: 'build', priority: 5, requiredAgentTags: ['builder'], durationMs: 300 },
    { id: 'haul-2', kind: 'haul', priority: 1, requiredAgentTags: ['hauler'], durationMs: 300 },
  ],
};

function createContext(doc?: SimulationAgentsDocument): GameContext {
  const base = createFakeGameContext();
  const data: Record<string, { schemaId: string; valid: true; value: unknown }> = {};
  if (doc) data['agents'] = { schemaId: 'agents', valid: true, value: doc };
  return { ...base, content: { ...base.content, data } };
}

function petService(): SimulationAgentsServiceImpl {
  const service = new SimulationAgentsServiceImpl(PET);
  service.spawn('rex', 'pet');
  return service;
}

/**
 * The same pet with automatic re-decision effectively switched off.
 *
 * A pet that keeps choosing to eat never gets hungry, which is correct
 * behaviour and useless for testing the *rules* underneath it - need drift,
 * threshold crossings, completion effects and cooldowns. Here the agent decides
 * once at spawn and then only does what a test tells it to.
 */
const MANUAL_PET: SimulationAgentsDocument = { ...PET, decisionIntervalMs: 1_000_000 };

function manualService(): SimulationAgentsServiceImpl {
  const service = new SimulationAgentsServiceImpl(MANUAL_PET);
  service.spawn('rex', 'pet');
  return service;
}

describe('simulationAgentsPack installation', () => {
  it('provides simulation.agents and releases it on dispose', () => {
    const context = createContext(PET);
    const installed = simulationAgentsPack.install(context, {});
    expect(context.capabilities.has('simulation.agents')).toBe(true);
    expect(installed.id).toBe('sw2d.simulation-agents');
    installed.dispose();
    expect(context.capabilities.has('simulation.agents')).toBe(false);
  });

  it('requires the content document', () => {
    expect(() => simulationAgentsPack.install(createContext(), {})).toThrow(MissingSimulationAgentsDocumentError);
  });

  it('rejects a malformed document at install time', () => {
    const bad: SimulationAgentsDocument = { ...PET, agents: [{ ...PET.agents[0]!, needs: ['nope'] }] };
    expect(() => simulationAgentsPack.install(createContext(bad), {})).toThrow(/unknown need "nope"/);
  });

  it('optionally spawns one agent per archetype', () => {
    const context = createContext(PET);
    simulationAgentsPack.install(context, { autoSpawn: true });
    const service = context.capabilities.require<SimulationAgentsService>('simulation.agents');
    expect(service.agents().map((a) => a.agentId)).toEqual(['pet']);
  });
});

describe('spawning and needs', () => {
  it('spawns from an archetype with the authored initial values and tags', () => {
    const service = petService();
    const agent = service.agent('rex')!;
    expect(agent.definitionId).toBe('pet');
    expect(agent.tags).toEqual(['creature']);
    expect(agent.needs['hunger']).toMatchObject({ value: 100, urgency: 0, level: 'ok' });
    expect(agent.active).toBeNull();
  });

  it('rejects an unknown archetype and a duplicate id', () => {
    const service = petService();
    expect(() => service.spawn('other', 'nope')).toThrow(UnknownAgentDefinitionError);
    expect(() => service.spawn('rex', 'pet')).toThrow(DuplicateAgentError);
  });

  it('drains needs by the authored rate on every tick', () => {
    const service = petService();
    service.update(1000);
    expect(service.need('rex', 'hunger')!.value).toBe(90); // -10/s
    expect(service.need('rex', 'energy')!.value).toBe(98); // -2/s
  });

  it('clamps a need at its floor rather than going negative', () => {
    const service = manualService();
    for (let i = 0; i < 40; i++) service.update(1000);
    expect(service.need('rex', 'hunger')!.value).toBe(0);
    expect(service.need('rex', 'hunger')!.level).toBe('critical');
    expect(service.need('rex', 'hunger')!.urgency).toBe(1);
  });

  it('adjusts a need directly and clamps at the ceiling', () => {
    const service = petService();
    service.update(3000); // hunger 70
    expect(service.adjustNeed('rex', 'hunger', -50)!.value).toBe(20);
    expect(service.adjustNeed('rex', 'hunger', 500)!.value).toBe(100);
    expect(service.adjustNeed('rex', 'nope', 1)).toBeUndefined();
    expect(service.adjustNeed('nobody', 'hunger', 1)).toBeUndefined();
  });

  it('emits a level change exactly when the level actually changes', () => {
    const service = manualService();
    const levels: string[] = [];
    // Long enough to cross both thresholds even after the one behaviour this
    // pet chooses at spawn tops hunger back up.
    for (let i = 0; i < 25; i++) {
      for (const event of service.update(1000)) {
        if (event.kind === 'need-level-changed' && event.needId === 'hunger') levels.push(event.level);
      }
    }
    // ok -> warning -> critical, once each, not once per tick.
    expect(levels).toEqual(['warning', 'critical']);
  });

  it('adds and removes tags', () => {
    const service = petService();
    expect(service.addTag('rex', 'happy')).toBe(true);
    expect(service.addTag('rex', 'happy')).toBe(false); // already there
    expect(service.agent('rex')!.tags).toEqual(['creature', 'happy']);
    expect(service.removeTag('rex', 'happy')).toBe(true);
    expect(service.removeTag('rex', 'happy')).toBe(false);
  });
});

describe('behaviour selection', () => {
  it('scores every behaviour with a reason when it is blocked', () => {
    const service = petService();
    const scores = service.evaluate('rex');
    expect(scores.map((s) => s.behaviorId)).toEqual(['eat', 'idle', 'sleep']); // stable, id-sorted
    // Nothing is urgent yet, so idle's flat utility wins.
    expect(scores.find((s) => s.behaviorId === 'eat')!.score).toBe(0);
    expect(scores.find((s) => s.behaviorId === 'idle')!.score).toBe(1);
    expect(scores.every((s) => s.eligible)).toBe(true);
  });

  it('chooses the urgent behaviour once a need falls far enough', () => {
    const service = petService();
    service.update(100); // first decision: nothing is urgent, so flat-utility idle wins
    expect(service.agent('rex')!.active?.behaviorId).toBe('idle');

    // Then hunger falls and the weighted behaviour overtakes it. Asserted on the
    // event stream rather than a sampled instant: 'eat' has a cooldown, so which
    // behaviour is active at any given tick is not the property under test.
    const started: string[] = [];
    for (let i = 0; i < 60; i++) {
      for (const event of service.update(100)) {
        if (event.kind === 'behavior-started') started.push(event.behaviorId);
      }
    }
    expect(started).toContain('eat');
    expect(started.indexOf('eat')).toBeGreaterThanOrEqual(0);
  });

  it('applies completion effects exactly once', () => {
    const service = manualService();
    service.update(5000); // hunger drifts down
    expect(service.forceBehavior('rex', 'eat')).toBe(true);

    const before = service.need('rex', 'hunger')!.value;
    const events = [];
    // Well past the 200ms duration: the effect must still apply exactly once.
    for (let i = 0; i < 10; i++) events.push(...service.update(100));
    const completions = events.filter((e) => e.kind === 'behavior-completed' && e.behaviorId === 'eat');
    expect(completions).toHaveLength(1);
    expect(service.need('rex', 'hunger')!.value).toBeGreaterThan(before); // +80, less drift
    expect(service.agent('rex')!.tags).toContain('fed');
    expect(service.agent('rex')!.lastCompletedBehaviorId).toBe('eat');
  });

  it('honours a cooldown, and reports it as the blocking reason', () => {
    const service = manualService();
    service.update(5000);
    service.forceBehavior('rex', 'eat');
    for (let i = 0; i < 3; i++) service.update(100); // completes, starting the 1000ms cooldown

    const blocked = service.evaluate('rex').find((entry) => entry.behaviorId === 'eat')!;
    expect(blocked.eligible).toBe(false);
    expect(blocked.blockedBy).toBe('cooldown');
    expect(service.forceBehavior('rex', 'eat')).toBe(false);

    // Still inside the window.
    for (let i = 0; i < 5; i++) service.update(100);
    expect(service.evaluate('rex').find((entry) => entry.behaviorId === 'eat')!.eligible).toBe(false);

    // Past it. Nothing re-ran it in between, because this pet only acts when told.
    for (let i = 0; i < 7; i++) service.update(100);
    expect(service.evaluate('rex').find((entry) => entry.behaviorId === 'eat')!.eligible).toBe(true);
    expect(service.forceBehavior('rex', 'eat')).toBe(true);
  });

  it('does not interrupt a non-interruptible behaviour', () => {
    const service = petService(); // automatic selection ON: the point is that it cannot displace sleep
    // Force sleep (non-interruptible), then make hunger far more urgent.
    expect(service.forceBehavior('rex', 'sleep')).toBe(true);
    service.adjustNeed('rex', 'hunger', -95);
    for (let i = 0; i < 3; i++) service.update(100);
    expect(service.agent('rex')!.active?.behaviorId).toBe('sleep');
  });

  it('does not apply the effects of an interrupted behaviour', () => {
    const service = manualService();
    service.update(5000);
    service.forceBehavior('rex', 'eat');
    const before = service.need('rex', 'hunger')!.value;
    expect(service.interrupt('rex')).toBe(true);
    expect(service.agent('rex')!.active).toBeNull();
    expect(service.need('rex', 'hunger')!.value).toBe(before); // no +80
    expect(service.agent('rex')!.tags).not.toContain('fed');
    expect(service.interrupt('rex')).toBe(false);
  });

  it('refuses to force an unknown or ineligible behaviour', () => {
    const service = petService();
    expect(service.forceBehavior('rex', 'nope')).toBe(false);
    expect(service.forceBehavior('nobody', 'eat')).toBe(false);
    const other = new SimulationAgentsServiceImpl(COLONY);
    other.spawn('c', 'colonist');
    // 'greet' needs a target carrying 'colonist'; there is only one agent.
    expect(other.forceBehavior('c', 'greet')).toBe(false);
    expect(other.evaluate('c').find((s) => s.behaviorId === 'greet')!.blockedBy).toBe('precondition:target-available');
  });

  it('re-decides on the bounded interval rather than every tick', () => {
    const service = petService();
    const starts: string[] = [];
    // Sixteen 10ms ticks is 160ms - one decision interval, not sixteen.
    for (let i = 0; i < 16; i++) {
      for (const event of service.update(10)) {
        if (event.kind === 'behavior-started') starts.push(event.behaviorId);
      }
    }
    expect(starts.length).toBeLessThanOrEqual(2);
  });
});

describe('schedule', () => {
  it('tracks the active block on game time and reports changes once', () => {
    const service = manualService();
    // minutesPerSecond is 1, so 720 simulated seconds crosses into 'evening'.
    service.update(1000);
    expect(service.agent('rex')!.scheduleActivity).toBe('morning');

    const changes: (string | null)[] = [];
    for (let i = 0; i < 800; i++) {
      for (const event of service.update(1000)) {
        if (event.kind === 'schedule-changed') changes.push(event.activity);
      }
    }
    expect(service.agent('rex')!.scheduleActivity).toBe('evening');
    expect(changes).toEqual(['evening']);
  });

  it('advances the game clock and rolls over days', () => {
    const service = manualService();
    for (let i = 0; i < 1500; i++) service.update(1000);
    const clock = service.clock();
    expect(clock.day).toBe(1);
    expect(clock.minuteOfDay).toBeGreaterThanOrEqual(0);
    expect(clock.minuteOfDay).toBeLessThan(1440);
  });
});

describe('relationships', () => {
  it('stores a generic (from, to, metric) value with no built-in vocabulary', () => {
    const service = new SimulationAgentsServiceImpl(COLONY);
    expect(service.relationship('a', 'b', 'friendship')).toBe(0);
    service.setRelationship('a', 'b', 'friendship', 10);
    expect(service.relationship('a', 'b', 'friendship')).toBe(10);
    expect(service.adjustRelationship('a', 'b', 'friendship', -3)).toBe(7);
    // Directional and per-metric: nothing is mirrored or conflated.
    expect(service.relationship('b', 'a', 'friendship')).toBe(0);
    expect(service.relationship('a', 'b', 'debt')).toBe(0);
  });

  it('lists relationships in a stable order', () => {
    const service = new SimulationAgentsServiceImpl(COLONY);
    service.setRelationship('z', 'a', 'm', 1);
    service.setRelationship('a', 'z', 'm', 2);
    service.setRelationship('a', 'b', 'm', 3);
    expect(service.relationships().map((r) => `${r.fromId}->${r.toId}`)).toEqual(['a->b', 'a->z', 'z->a']);
  });

  it('applies a relationship effect toward the behaviour\'s chosen target', () => {
    const service = new SimulationAgentsServiceImpl(COLONY);
    service.spawn('one', 'colonist');
    service.spawn('two', 'specialist');
    expect(service.forceBehavior('one', 'greet', 'two')).toBe(true);
    for (let i = 0; i < 3; i++) service.update(100);
    expect(service.relationship('one', 'two', 'friendship')).toBe(5);
  });
});

describe('work orders', () => {
  function colony(): SimulationAgentsServiceImpl {
    const service = new SimulationAgentsServiceImpl(COLONY);
    service.spawn('one', 'colonist');
    service.spawn('two', 'specialist');
    return service;
  }

  it('starts every authored order open', () => {
    const service = colony();
    expect(service.workOrders().map((o) => o.state)).toEqual(['open', 'open', 'open']);
    expect(service.workOrder('haul-1')?.reservedBy).toBeNull();
  });

  it('offers the highest-priority order the agent is tagged for', () => {
    const service = colony();
    // 'one' is a hauler, so build-1 (priority 5) is not offered to it.
    expect(service.nextWorkOrderFor('one')?.id).toBe('haul-1'); // tie on priority -> id order
    expect(service.nextWorkOrderFor('two')?.id).toBe('build-1');
    expect(service.nextWorkOrderFor('nobody')).toBeUndefined();
  });

  it('reserves exclusively: a second agent cannot claim a reserved order', () => {
    const service = colony();
    service.addTag('two', 'hauler');
    expect(service.reserveWorkOrder('haul-1', 'one')).toBe(true);
    expect(service.workOrder('haul-1')).toMatchObject({ state: 'reserved', reservedBy: 'one' });
    expect(service.reserveWorkOrder('haul-1', 'two')).toBe(false);
    // And it is no longer offered to anyone.
    expect(service.nextWorkOrderFor('two')?.id).not.toBe('haul-1');
  });

  it('refuses an order whose required tags the agent lacks, and a second order per agent', () => {
    const service = colony();
    expect(service.reserveWorkOrder('build-1', 'one')).toBe(false); // not a builder
    expect(service.reserveWorkOrder('haul-1', 'one')).toBe(true);
    expect(service.reserveWorkOrder('haul-2', 'one')).toBe(false); // already busy
  });

  it('progresses a reserved order to completion and frees the agent', () => {
    const service = colony();
    service.reserveWorkOrder('haul-1', 'one');
    const events = [];
    for (let i = 0; i < 5; i++) events.push(...service.update(100));
    expect(service.workOrder('haul-1')?.state).toBe('complete');
    expect(service.agent('one')!.workOrderId).toBeNull();
    expect(events.filter((e) => e.kind === 'work-order-completed')).toHaveLength(1);
    // A completed order cannot be reclaimed.
    expect(service.reserveWorkOrder('haul-1', 'one')).toBe(false);
  });

  it('releases an order back to open, resetting progress', () => {
    const service = colony();
    service.reserveWorkOrder('haul-1', 'one');
    service.update(100);
    expect(service.workOrder('haul-1')!.progressMs).toBeGreaterThan(0);
    expect(service.releaseWorkOrder('haul-1')).toBe(true);
    expect(service.workOrder('haul-1')).toMatchObject({ state: 'open', reservedBy: null, progressMs: 0 });
    expect(service.agent('one')!.workOrderId).toBeNull();
    expect(service.releaseWorkOrder('haul-1')).toBe(false); // already open
  });

  it('cancels an order and frees its owner', () => {
    const service = colony();
    service.reserveWorkOrder('haul-1', 'one');
    expect(service.cancelWorkOrder('haul-1')).toBe(true);
    expect(service.workOrder('haul-1')?.state).toBe('cancelled');
    expect(service.agent('one')!.workOrderId).toBeNull();
    expect(service.cancelWorkOrder('haul-1')).toBe(false);
    // A cancelled order is gone, not merely unreserved.
    expect(service.nextWorkOrderFor('one')?.id).toBe('haul-2');
  });

  it('releases a despawned agent\'s order rather than leaking the reservation', () => {
    const service = colony();
    service.reserveWorkOrder('haul-1', 'one');
    expect(service.despawn('one')).toBe(true);
    expect(service.workOrder('haul-1')).toMatchObject({ state: 'open', reservedBy: null });
    expect(service.despawn('one')).toBe(false);
  });
});

describe('determinism and reset', () => {
  it('produces identical event streams for identical inputs', () => {
    const run = (): string => {
      const service = new SimulationAgentsServiceImpl(COLONY);
      service.spawn('one', 'colonist');
      service.spawn('two', 'specialist');
      const log: string[] = [];
      for (let i = 0; i < 200; i++) {
        for (const event of service.update(50)) log.push(JSON.stringify(event));
      }
      log.push(JSON.stringify(service.agents()));
      return log.join('|');
    };
    expect(run()).toBe(run());
  });

  it('processes agents in ascending id order regardless of spawn order', () => {
    const forward = new SimulationAgentsServiceImpl(COLONY);
    forward.spawn('aaa', 'colonist');
    forward.spawn('zzz', 'specialist');
    const reverse = new SimulationAgentsServiceImpl(COLONY);
    reverse.spawn('zzz', 'specialist');
    reverse.spawn('aaa', 'colonist');

    const drive = (s: SimulationAgentsServiceImpl): string =>
      Array.from({ length: 40 }, () => s.update(50).map((e) => JSON.stringify(e)).join(',')).join('|');
    expect(drive(forward)).toBe(drive(reverse));
  });

  it('reset clears agents, relationships, orders and the clock', () => {
    const service = new SimulationAgentsServiceImpl(COLONY);
    service.spawn('one', 'colonist');
    service.setRelationship('one', 'two', 'friendship', 9);
    service.reserveWorkOrder('haul-1', 'one');
    service.update(1000);

    service.reset();
    expect(service.agents()).toEqual([]);
    expect(service.relationships()).toEqual([]);
    expect(service.workOrders().every((o) => o.state === 'open')).toBe(true);
    expect(service.clock()).toMatchObject({ elapsedMs: 0, day: 0 });
  });
});

describe('events on the bus', () => {
  it('emits the cross-system facts a HUD would react to', () => {
    const context = createContext(PET);
    const installed = simulationAgentsPack.install(context, {});
    const service = context.capabilities.require<SimulationAgentsService>('simulation.agents');
    service.spawn('rex', 'pet');

    const seen: string[] = [];
    context.events.on('agents:behaviorStarted', (p) => seen.push(`start:${p.behaviorId}`));
    context.events.on('agents:behaviorCompleted', (p) => seen.push(`done:${p.behaviorId}`));
    context.events.on('agents:needLevelChanged', (p) => seen.push(`level:${p.level}`));

    for (let i = 0; i < 80; i++) installed.update?.(100);
    expect(seen.some((entry) => entry.startsWith('start:'))).toBe(true);
    expect(seen.some((entry) => entry.startsWith('done:'))).toBe(true);

    // A pet that keeps eating may never get hungry on its own, so drive the
    // threshold directly rather than asserting the simulation happens to reach it.
    service.adjustNeed('rex', 'hunger', -100);
    expect(seen).toContain('level:critical');
  });
});
