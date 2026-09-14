import { describe, expect, it } from 'vitest';
import { validateContentBundleData } from '@sw2d/schemas';
import type { GameContext, NeedsCatalog, NeedsService, SaveLoadOutcome, SaveSlotOptions, SaveStore, VersionedRecord } from '@sw2d/contracts';
import { NEEDS_CAPABILITY_ID } from '@sw2d/contracts';
import { CAPABILITY_IDS } from '../src/ids.ts';
import { needsPack } from '../src/needs/needsPack.ts';
import { FakeCapabilityRegistry, FakeEventBus } from './testSupport.ts';

const CREATURE: NeedsCatalog = {
  schemaVersion: 1,
  mode: 'creature',
  subject: { id: 'pet', displayName: 'Pico' },
  needs: [
    { id: 'hunger', displayName: 'Hunger', value: 72, min: 0, max: 100, decayPerSecond: 2.8 },
    { id: 'mood', displayName: 'Mood', value: 72, min: 0, max: 100, decayPerSecond: 2.2 },
  ],
  actions: [
    { id: 'feed', displayName: 'Feed', effects: [{ needId: 'hunger', delta: 22 }], affinityDelta: 1 },
    { id: 'play', displayName: 'Play', effects: [{ needId: 'mood', delta: 24 }], affinityDelta: 1 },
  ],
  win: { minValue: 82, holdMs: 1600, minActions: 2 },
  loseBelow: 0,
  affinity: 0,
};

const HABITAT: NeedsCatalog = {
  schemaVersion: 1,
  mode: 'habitat',
  subject: { id: 'tank', displayName: 'Tank' },
  needs: [
    { id: 'water', displayName: 'Water', value: 78, min: 0, max: 100, decayPerSecond: 3 },
    { id: 'food', displayName: 'Food', value: 78, min: 0, max: 100, decayPerSecond: 3.5 },
  ],
  actions: [
    { id: 'feed', displayName: 'Feed', effects: [{ needId: 'food', delta: 24 }] },
    { id: 'refresh', displayName: 'Refresh', effects: [{ needId: 'water', delta: 24 }] },
  ],
  win: { minValue: 55, holdMs: 7000, minActions: 2 },
  loseBelow: 10,
};

const COMPANION: NeedsCatalog = {
  schemaVersion: 1,
  mode: 'companion',
  subject: { id: 'buddy', displayName: 'Buddy' },
  needs: [
    { id: 'hunger', displayName: 'Hunger', value: 70, min: 0, max: 100, decayPerSecond: 3 },
    { id: 'happiness', displayName: 'Happiness', value: 70, min: 0, max: 100, decayPerSecond: 2.5 },
  ],
  actions: [
    { id: 'feed', displayName: 'Feed', effects: [{ needId: 'hunger', delta: 25 }], affinityDelta: 2 },
    { id: 'play', displayName: 'Play', effects: [{ needId: 'happiness', delta: 25 }], affinityDelta: 2 },
  ],
  win: { minValue: 85, holdMs: 0, minActions: 2 },
};

class MemorySaves implements SaveStore {
  readonly namespace = 'needs-test';
  readonly store = new Map<string, unknown>();
  load<T extends VersionedRecord>(slot: string, options: SaveSlotOptions<T>): { value: T; outcome: SaveLoadOutcome } {
    const value = this.store.get(slot) as T | undefined;
    return value ? { value, outcome: 'loaded' } : { value: options.createDefault(), outcome: 'default' };
  }
  save<T extends VersionedRecord>(slot: string, value: T): void { this.store.set(slot, structuredClone(value)); }
  clear(slot: string): void { this.store.delete(slot); }
}

function install(catalog?: NeedsCatalog, saves?: SaveStore) {
  const events = new FakeEventBus();
  const capabilities = new FakeCapabilityRegistry();
  const ctx = {
    events,
    capabilities,
    ...(saves ? { saves } : {}),
    content: catalog ? { data: { needs: { schemaId: 'x', valid: true, value: catalog } } } : { data: {} },
  } as unknown as GameContext;
  const installed = needsPack.install(ctx, undefined);
  const needs = capabilities.require<NeedsService>(NEEDS_CAPABILITY_ID);
  return { events, capabilities, installed, needs };
}

describe('sw2d.needs - ids', () => {
  it('the contracts-exported capability id matches the packs CAPABILITY_IDS entry', () => {
    expect(NEEDS_CAPABILITY_ID).toBe(CAPABILITY_IDS.needs);
    expect(needsPack.provides).toEqual([NEEDS_CAPABILITY_ID]);
  });
});

describe('sw2d.needs - schema', () => {
  it('accepts the three consumer catalogs', () => {
    expect(() => validateContentBundleData({ needs: CREATURE })).not.toThrow();
    expect(() => validateContentBundleData({ needs: HABITAT })).not.toThrow();
    expect(() => validateContentBundleData({ needs: COMPANION })).not.toThrow();
  });

  it('rejects an unknown mode', () => {
    const bad = { ...CREATURE, mode: 'colony' };
    expect(() => validateContentBundleData({ needs: bad })).toThrow();
  });

  it('rejects a negative decay', () => {
    const bad = {
      ...CREATURE,
      needs: [{ id: 'hunger', displayName: 'Hunger', value: 50, min: 0, max: 100, decayPerSecond: -1 }],
    };
    expect(() => validateContentBundleData({ needs: bad })).toThrow();
  });
});

describe('sw2d.needs - creature loop', () => {
  it('feed raises hunger, play raises mood, affinity ticks, hold then completes', () => {
    const { installed, needs } = install(CREATURE);
    expect(needs.need('hunger')).toBe(72);
    expect(needs.actByIndex(0).reason).toBe('acted');
    expect(needs.need('hunger')).toBe(94);
    expect(needs.actByIndex(1).reason).toBe('acted');
    expect(needs.need('mood')).toBe(96);
    expect(needs.affinity()).toBe(2);
    expect(needs.actionsTaken()).toBe(2);
    expect(needs.outcome()).toBe('playing');
    installed.update?.(1600);
    expect(needs.holdMs()).toBeGreaterThanOrEqual(1600);
    expect(needs.outcome()).toBe('complete');
  });

  it('decay uses simulation time, never a wall clock', () => {
    const { installed, needs } = install(CREATURE);
    installed.update?.(1000);
    expect(needs.need('hunger')).toBeCloseTo(69.2, 5);
    expect(needs.need('mood')).toBeCloseTo(69.8, 5);
  });

  it('hold resets when a need drops below the win floor', () => {
    const { installed, needs } = install({
      ...CREATURE,
      needs: [
        { id: 'hunger', displayName: 'Hunger', value: 90, min: 0, max: 100, decayPerSecond: 20 },
        { id: 'mood', displayName: 'Mood', value: 90, min: 0, max: 100, decayPerSecond: 0 },
      ],
    });
    needs.actByIndex(0);
    needs.actByIndex(1);
    installed.update?.(500);
    expect(needs.holdMs()).toBe(500);
    installed.update?.(500);
    expect(needs.need('hunger')).toBeLessThan(82);
    expect(needs.holdMs()).toBe(0);
    expect(needs.outcome()).toBe('playing');
  });

  it('fails when a need hits loseBelow', () => {
    const { installed, needs } = install({
      ...CREATURE,
      needs: [
        { id: 'hunger', displayName: 'Hunger', value: 1, min: 0, max: 100, decayPerSecond: 5 },
        { id: 'mood', displayName: 'Mood', value: 50, min: 0, max: 100, decayPerSecond: 0 },
      ],
    });
    installed.update?.(300);
    expect(needs.need('hunger')).toBe(0);
    expect(needs.outcome()).toBe('failed');
    expect(needs.actByIndex(0).reason).toBe('not-playing');
  });

  it('clamps at max so spam feed cannot overflow', () => {
    const { needs } = install(CREATURE);
    for (let i = 0; i < 12; i++) needs.actByIndex(0);
    expect(needs.need('hunger')).toBe(100);
    expect(needs.outcome()).toBe('playing');
  });
});

describe('sw2d.needs - habitat', () => {
  it('feed/refresh then a long hold completes; fail-below 10 is distinct from creature', () => {
    const { installed, needs } = install(HABITAT);
    needs.actByIndex(0);
    needs.actByIndex(1);
    expect(needs.need('food')).toBe(100);
    expect(needs.need('water')).toBe(100);
    installed.update?.(6999);
    expect(needs.outcome()).toBe('playing');
    installed.update?.(2);
    expect(needs.outcome()).toBe('complete');
  });

  it('fails below 10, not at 0', () => {
    const { installed, needs } = install({
      ...HABITAT,
      needs: [
        { id: 'water', displayName: 'Water', value: 12, min: 0, max: 100, decayPerSecond: 5 },
        { id: 'food', displayName: 'Food', value: 80, min: 0, max: 100, decayPerSecond: 0 },
      ],
    });
    installed.update?.(500);
    expect(needs.need('water')).toBe(9.5);
    expect(needs.outcome()).toBe('failed');
  });
});

describe('sw2d.needs - companion', () => {
  it('completes immediately once both needs are high enough after two actions, and never fails', () => {
    const { installed, needs } = install(COMPANION);
    expect(needs.act('feed').reason).toBe('acted');
    expect(needs.outcome()).toBe('playing');
    expect(needs.act('play').reason).toBe('acted');
    expect(needs.need('hunger')).toBe(95);
    expect(needs.need('happiness')).toBe(95);
    expect(needs.outcome()).toBe('complete');
    installed.update?.(10_000);
    expect(needs.outcome()).toBe('complete');
  });

  it('two feeds without play does not complete (happiness still low)', () => {
    const { needs } = install(COMPANION);
    needs.act('feed');
    needs.act('feed');
    expect(needs.actionsTaken()).toBe(2);
    expect(needs.need('happiness')).toBe(70);
    expect(needs.outcome()).toBe('playing');
  });
});

describe('sw2d.needs - lifecycle', () => {
  it('withdraws its capability on dispose', () => {
    const { capabilities, installed } = install(CREATURE);
    expect(capabilities.has(NEEDS_CAPABILITY_ID)).toBe(true);
    installed.dispose();
    expect(capabilities.has(NEEDS_CAPABILITY_ID)).toBe(false);
  });

  it('duplicate need ids throw at install', () => {
    const events = new FakeEventBus();
    const capabilities = new FakeCapabilityRegistry();
    const catalog: NeedsCatalog = {
      ...CREATURE,
      needs: [
        { id: 'hunger', displayName: 'Hunger', value: 50, min: 0, max: 100, decayPerSecond: 1 },
        { id: 'hunger', displayName: 'Also hunger', value: 50, min: 0, max: 100, decayPerSecond: 1 },
      ],
    };
    const ctx = {
      events,
      capabilities,
      content: { data: { needs: { schemaId: 'x', valid: true, value: catalog } } },
    } as unknown as GameContext;
    expect(() => needsPack.install(ctx, undefined)).toThrow(/hunger/);
  });

  it('an unknown effect needId throws at install', () => {
    const events = new FakeEventBus();
    const capabilities = new FakeCapabilityRegistry();
    const catalog: NeedsCatalog = {
      ...CREATURE,
      actions: [{ id: 'feed', displayName: 'Feed', effects: [{ needId: 'nope', delta: 10 }] }],
    };
    const ctx = {
      events,
      capabilities,
      content: { data: { needs: { schemaId: 'x', valid: true, value: catalog } } },
    } as unknown as GameContext;
    expect(() => needsPack.install(ctx, undefined)).toThrow(/nope/);
  });

  it('a missing content/needs.json yields an inert service, not an error', () => {
    const { installed, needs } = install();
    expect(needs.active()).toBe(false);
    installed.update?.(1000);
    expect(needs.act().reason).toBe('no-actions');
    expect(needs.needs()).toEqual([]);
  });

  it('reset restores catalog initials for a new care session', () => {
    const { needs } = install(CREATURE);
    needs.actByIndex(0);
    needs.actByIndex(1);
    expect(needs.actionsTaken()).toBe(2);
    needs.reset();
    expect(needs.need('hunger')).toBe(72);
    expect(needs.need('mood')).toBe(72);
    expect(needs.actionsTaken()).toBe(0);
    expect(needs.outcome()).toBe('playing');
    expect(needs.affinity()).toBe(0);
  });

  it('unknown action is reported, never a silent no-op', () => {
    const { needs } = install(CREATURE);
    expect(needs.act('dance')).toEqual({ ok: false, reason: 'unknown-action', actionId: 'dance' });
    expect(needs.need('hunger')).toBe(72);
  });

  it('chooses bounded activities from need state, moves actors, and advances relationships', () => {
    const catalog: NeedsCatalog = {
      ...CREATURE,
      creatures: [
        { id: 'pico', displayName: 'Pico', x: 0, y: 0, speed: 100, needValues: { hunger: 40, mood: 90 } },
        { id: 'moss', displayName: 'Moss', x: 10, y: 0, speed: 100, needValues: { hunger: 90, mood: 90 } },
      ],
      activities: [
        { id: 'food', displayName: 'Food', needId: 'hunger', below: 50, targetX: 100, targetY: 0, durationMs: 1000 },
        { id: 'play', displayName: 'Play', targetX: 0, targetY: 100, durationMs: 1000 },
      ],
      relationships: [{ a: 'pico', b: 'moss', affinity: 2, gainPerSecond: 3, max: 10 }],
      decisionIntervalMs: 100,
    };
    const { installed, needs } = install(catalog);
    expect(needs.creatures()[0]?.activityId).toBe('food');
    installed.update?.(100);
    expect(needs.creatures()[0]?.x).toBeGreaterThan(0);
    expect(needs.relationships()[0]?.affinity).toBeGreaterThan(2);
    needs.act('feed');
    installed.update?.(100);
    expect(needs.creatures()[0]?.activityId).toBe('play');
  });

  it('persists care state across reinstall and clears it on an explicit run restart', () => {
    const saves = new MemorySaves();
    const catalog: NeedsCatalog = { ...CREATURE, persist: true, creatures: [{ id: 'pico', displayName: 'Pico', x: 10, y: 20 }] };
    const first = install(catalog, saves);
    first.needs.act('feed');
    first.installed.update?.(600);
    const fed = first.needs.need('hunger');
    first.installed.dispose();
    const second = install(catalog, saves);
    expect(second.needs.loadOutcome()).toBe('loaded');
    expect(second.needs.actionsTaken()).toBe(1);
    expect(second.needs.need('hunger')).toBeCloseTo(fed, 5);
    second.events.emit('run:restarted', { runIndex: 2 });
    expect(second.needs.actionsTaken()).toBe(0);
    expect(second.needs.need('hunger')).toBe(72);
    expect(saves.store.has('needs')).toBe(false);
  });
});
