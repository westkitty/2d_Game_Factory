import { describe, expect, it } from 'vitest';
import {
  DEFAULT_DECISION_INTERVAL_MS,
  InvalidSimulationAgentsError,
  MINUTES_PER_DAY,
  SIMULATION_AGENTS_CAPABILITY_ID,
  behaviorScore,
  createRng,
  needLevel,
  needUrgency,
  scheduleBlockAt,
  selectBehavior,
  tickNeed,
  tieBreakBySeed,
  validateSimulationAgentsDocument,
  type NeedDefinition,
  type NeedState,
  type SimulationAgentsDocument,
} from '../src/index.ts';

const HUNGER: NeedDefinition = {
  id: 'hunger',
  minimum: 0,
  maximum: 100,
  initial: 100,
  changePerSecond: -5,
  warningThreshold: 40,
  criticalThreshold: 15,
};

const DOC: SimulationAgentsDocument = {
  schemaVersion: 1,
  needs: [HUNGER],
  behaviors: [
    { id: 'eat', baseUtility: 0, needWeights: { hunger: 10 }, durationMs: 1000, effects: [{ kind: 'need-delta', needId: 'hunger', delta: 60 }] },
    { id: 'idle', baseUtility: 1, durationMs: 500 },
  ],
  agents: [{ id: 'pet', needs: ['hunger'], behaviors: ['eat', 'idle'] }],
};

describe('simulation agents contract', () => {
  it('publishes the Phase 18 capability id and a bounded default decision interval', () => {
    expect(SIMULATION_AGENTS_CAPABILITY_ID).toBe('simulation.agents');
    expect(DEFAULT_DECISION_INTERVAL_MS).toBeGreaterThan(0);
  });
});

describe('needs', () => {
  it('drifts by rate and clamps at both ends', () => {
    expect(tickNeed(HUNGER, 100, 1)).toBe(95);
    expect(tickNeed(HUNGER, 100, 4)).toBe(80);
    expect(tickNeed(HUNGER, 2, 10)).toBe(0); // clamped at the floor
    expect(tickNeed({ ...HUNGER, changePerSecond: 50 }, 90, 1)).toBe(100); // clamped at the ceiling
  });

  it('normalises urgency across the need\'s own range', () => {
    expect(needUrgency(HUNGER, 100)).toBe(0);
    expect(needUrgency(HUNGER, 0)).toBe(1);
    expect(needUrgency(HUNGER, 25)).toBe(0.75);
    // A 0..1 need at half full is as urgent as a 0..100 need at half full -
    // which is what makes needWeights independent of the author's scale.
    const small: NeedDefinition = { ...HUNGER, id: 'small', minimum: 0, maximum: 1, initial: 1, warningThreshold: 0.4, criticalThreshold: 0.15 };
    expect(needUrgency(small, 0.5)).toBe(needUrgency(HUNGER, 50));
  });

  it('clamps urgency for an out-of-range value, and handles a zero-width need', () => {
    expect(needUrgency(HUNGER, 500)).toBe(0);
    expect(needUrgency(HUNGER, -500)).toBe(1);
    expect(needUrgency({ ...HUNGER, minimum: 5, maximum: 5 }, 5)).toBe(0);
  });

  it('reports level by threshold, with critical taking precedence', () => {
    expect(needLevel(HUNGER, 100)).toBe('ok');
    expect(needLevel(HUNGER, 41)).toBe('ok');
    expect(needLevel(HUNGER, 40)).toBe('warning'); // at the threshold
    expect(needLevel(HUNGER, 16)).toBe('warning');
    expect(needLevel(HUNGER, 15)).toBe('critical'); // at the threshold
    expect(needLevel(HUNGER, 0)).toBe('critical');
  });
});

describe('behaviour scoring and selection', () => {
  const needs = (urgency: number): Record<string, NeedState> => ({
    hunger: { id: 'hunger', value: 0, urgency, level: 'critical' },
  });

  it('adds weighted urgency to the base utility', () => {
    const eat = DOC.behaviors[0]!;
    expect(behaviorScore(eat, needs(0))).toBe(0);
    expect(behaviorScore(eat, needs(0.5))).toBe(5);
    expect(behaviorScore(eat, needs(1))).toBe(10);
  });

  it('ignores a weighted need the agent does not have', () => {
    const eat = DOC.behaviors[0]!;
    expect(behaviorScore(eat, {})).toBe(eat.baseUtility);
  });

  it('picks the highest score', () => {
    const best = selectBehavior([
      { behaviorId: 'idle', score: 1, eligible: true, blockedBy: null },
      { behaviorId: 'eat', score: 9, eligible: true, blockedBy: null },
    ]);
    expect(best?.behaviorId).toBe('eat');
  });

  it('skips ineligible candidates however high they score', () => {
    const best = selectBehavior([
      { behaviorId: 'eat', score: 99, eligible: false, blockedBy: 'cooldown' },
      { behaviorId: 'idle', score: 1, eligible: true, blockedBy: null },
    ]);
    expect(best?.behaviorId).toBe('idle');
  });

  it('breaks ties on behaviour id, not on candidate order', () => {
    const forward = selectBehavior([
      { behaviorId: 'zeta', score: 5, eligible: true, blockedBy: null },
      { behaviorId: 'alpha', score: 5, eligible: true, blockedBy: null },
    ]);
    const reversed = selectBehavior([
      { behaviorId: 'alpha', score: 5, eligible: true, blockedBy: null },
      { behaviorId: 'zeta', score: 5, eligible: true, blockedBy: null },
    ]);
    // Reordering the document must not change the simulation.
    expect(forward?.behaviorId).toBe('alpha');
    expect(reversed?.behaviorId).toBe('alpha');
  });

  it('returns null when nothing is eligible', () => {
    expect(selectBehavior([])).toBeNull();
    expect(selectBehavior([{ behaviorId: 'eat', score: 9, eligible: false, blockedBy: 'cooldown' }])).toBeNull();
  });

  it('offers a seeded tie-break that is order-independent and deterministic', () => {
    const candidates = [{ behaviorId: 'b' }, { behaviorId: 'a' }, { behaviorId: 'c' }];
    const first = tieBreakBySeed(candidates, createRng(99));
    const again = tieBreakBySeed([...candidates].reverse(), createRng(99));
    expect(first).toEqual(again);
    expect(tieBreakBySeed([], createRng(1))).toBeNull();
  });
});

describe('schedule blocks', () => {
  const blocks = [
    { startMinute: 480, endMinute: 720, activity: 'work' },
    { startMinute: 1320, endMinute: 360, activity: 'sleep' }, // 22:00 -> 06:00
  ];

  it('finds the block covering a minute', () => {
    expect(scheduleBlockAt(blocks, 500)?.activity).toBe('work');
    expect(scheduleBlockAt(blocks, 480)?.activity).toBe('work'); // inclusive start
    expect(scheduleBlockAt(blocks, 720)).toBeNull(); // exclusive end
  });

  it('supports a block that wraps past midnight', () => {
    expect(scheduleBlockAt(blocks, 1400)?.activity).toBe('sleep');
    expect(scheduleBlockAt(blocks, 30)?.activity).toBe('sleep');
    expect(scheduleBlockAt(blocks, 400)).toBeNull(); // between sleep and work
  });

  it('normalises a minute outside a single day', () => {
    expect(scheduleBlockAt(blocks, MINUTES_PER_DAY + 500)?.activity).toBe('work');
    expect(scheduleBlockAt(blocks, -60)?.activity).toBe('sleep'); // 23:00
  });
});

describe('validateSimulationAgentsDocument', () => {
  it('accepts a well-formed document', () => {
    expect(() => validateSimulationAgentsDocument(DOC)).not.toThrow();
  });

  it('rejects duplicate ids', () => {
    expect(() => validateSimulationAgentsDocument({ ...DOC, needs: [HUNGER, HUNGER] })).toThrow(/Duplicate need id/);
    expect(() =>
      validateSimulationAgentsDocument({ ...DOC, behaviors: [DOC.behaviors[0]!, DOC.behaviors[0]!] }),
    ).toThrow(/Duplicate behavior id/);
    expect(() => validateSimulationAgentsDocument({ ...DOC, agents: [DOC.agents[0]!, DOC.agents[0]!] })).toThrow(
      /Duplicate agent id/,
    );
  });

  it('rejects an inconsistent need range or thresholds', () => {
    expect(() => validateSimulationAgentsDocument({ ...DOC, needs: [{ ...HUNGER, maximum: 0 }] })).toThrow(/must exceed minimum/);
    expect(() => validateSimulationAgentsDocument({ ...DOC, needs: [{ ...HUNGER, initial: 500 }] })).toThrow(/initial/);
    // critical is the *worse* state, so it must not sit above warning.
    expect(() =>
      validateSimulationAgentsDocument({ ...DOC, needs: [{ ...HUNGER, criticalThreshold: 90 }] }),
    ).toThrow(/critical is the worse state/);
    expect(() =>
      validateSimulationAgentsDocument({ ...DOC, needs: [{ ...HUNGER, warningThreshold: 500 }] }),
    ).toThrow(/warningThreshold/);
  });

  it('rejects every dangling cross-reference', () => {
    expect(() =>
      validateSimulationAgentsDocument({ ...DOC, agents: [{ ...DOC.agents[0]!, needs: ['nope'] }] }),
    ).toThrow(/unknown need "nope"/);
    expect(() =>
      validateSimulationAgentsDocument({ ...DOC, agents: [{ ...DOC.agents[0]!, behaviors: ['nope'] }] }),
    ).toThrow(/unknown behavior "nope"/);
    expect(() =>
      validateSimulationAgentsDocument({
        ...DOC,
        behaviors: [{ id: 'x', baseUtility: 0, durationMs: 10, needWeights: { nope: 1 } }],
        agents: [{ id: 'a', needs: ['hunger'], behaviors: ['x'] }],
      }),
    ).toThrow(/weights unknown need "nope"/);
    expect(() =>
      validateSimulationAgentsDocument({
        ...DOC,
        behaviors: [{ id: 'x', baseUtility: 0, durationMs: 10, preconditions: [{ kind: 'need-below', needId: 'nope', value: 1 }] }],
        agents: [{ id: 'a', needs: ['hunger'], behaviors: ['x'] }],
      }),
    ).toThrow(/precondition on unknown need "nope"/);
    expect(() =>
      validateSimulationAgentsDocument({
        ...DOC,
        behaviors: [{ id: 'x', baseUtility: 0, durationMs: 10, effects: [{ kind: 'need-set', needId: 'nope', value: 1 }] }],
        agents: [{ id: 'a', needs: ['hunger'], behaviors: ['x'] }],
      }),
    ).toThrow(/effect on unknown need "nope"/);
  });

  it('rejects an agent with no needs, and invalid schedule minutes', () => {
    expect(() => validateSimulationAgentsDocument({ ...DOC, agents: [{ id: 'a', needs: [], behaviors: [] }] })).toThrow(
      /at least one need/,
    );
    expect(() =>
      validateSimulationAgentsDocument({
        ...DOC,
        agents: [{ ...DOC.agents[0]!, schedule: [{ startMinute: 0, endMinute: 5000, activity: 'work' }] }],
      }),
    ).toThrow(/endMinute must be an integer/);
    expect(() =>
      validateSimulationAgentsDocument({
        ...DOC,
        agents: [{ ...DOC.agents[0]!, schedule: [{ startMinute: 60, endMinute: 60, activity: 'work' }] }],
      }),
    ).toThrow(/zero minutes is never active/);
  });

  it('rejects non-positive durations and a bad decision interval', () => {
    expect(() =>
      validateSimulationAgentsDocument({ ...DOC, behaviors: [{ id: 'x', baseUtility: 0, durationMs: 0 }], agents: [{ id: 'a', needs: ['hunger'], behaviors: ['x'] }] }),
    ).toThrow(/durationMs must be > 0/);
    expect(() =>
      validateSimulationAgentsDocument({ ...DOC, workOrders: [{ id: 'w', kind: 'haul', priority: 1, durationMs: 0 }] }),
    ).toThrow(/durationMs must be > 0/);
    expect(() => validateSimulationAgentsDocument({ ...DOC, decisionIntervalMs: 0 })).toThrow(/decisionIntervalMs/);
    expect(() => validateSimulationAgentsDocument({ ...DOC, minutesPerSecond: -1 })).toThrow(/minutesPerSecond/);
  });

  it('rejects duplicate work order ids', () => {
    const order = { id: 'w', kind: 'haul', priority: 1, durationMs: 10 };
    expect(() => validateSimulationAgentsDocument({ ...DOC, workOrders: [order, order] })).toThrow(
      InvalidSimulationAgentsError,
    );
  });
});
