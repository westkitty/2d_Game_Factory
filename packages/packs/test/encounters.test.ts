import { describe, expect, it } from 'vitest';
import { validateContentBundleData } from '@sw2d/schemas';
import { ENCOUNTERS_CAPABILITY_ID, type EncounterCatalog, type EncounterService, type EncounterUpdateContext, type GameContext } from '@sw2d/contracts';
import { CAPABILITY_IDS } from '../src/ids.ts';
import { UnknownEncounterError, encountersPack } from '../src/encounters/encountersPack.ts';
import { FakeCapabilityRegistry, FakeEventBus } from './testSupport.ts';

const CATALOG: EncounterCatalog = {
  schemaVersion: 1,
  encounters: [
    {
      id: 'skirmish',
      phases: [
        {
          id: 'p1',
          spawns: [{ archetype: 'grunt', count: 3, at: { kind: 'edge', edge: 'top' }, intervalMs: 100 }],
          completeWhen: { kind: 'spawns-cleared' },
        },
        {
          id: 'p2',
          emitters: [{ id: 'e-ring', weaponId: 'enemy-bullet', pattern: { kind: 'ring', count: 6 }, everyMs: 200 }],
          completeWhen: { kind: 'elapsed', ms: 500 },
        },
      ],
    },
    {
      id: 'boss',
      bossEntityId: 'boss-1',
      phases: [
        { id: 'b1', emitters: [{ id: 'aimed', weaponId: 'enemy-bullet', pattern: { kind: 'aimed' }, everyMs: 100 }], completeWhen: { kind: 'entity-health-below', entityId: 'boss-1', fraction: 0.66 } },
        { id: 'b2', onEnterInvulnMs: 800, emitters: [{ id: 'spiral', weaponId: 'enemy-bullet', pattern: { kind: 'spiral', count: 4, rotationStepDeg: 12 }, everyMs: 80 }], completeWhen: { kind: 'entity-health-below', entityId: 'boss-1', fraction: 0.33 } },
        { id: 'b3', completeWhen: { kind: 'flag', flag: 'bossDead' } },
      ],
    },
  ],
};

function makeService(catalog = CATALOG): { svc: EncounterService; events: FakeEventBus } {
  const events = new FakeEventBus();
  const capabilities = new FakeCapabilityRegistry();
  const ctx = { events, capabilities, content: { data: { encounters: { schemaId: 'x', valid: true, value: catalog } } } } as unknown as GameContext;
  encountersPack.install(ctx, undefined);
  return { svc: capabilities.require<EncounterService>(ENCOUNTERS_CAPABILITY_ID), events };
}

function fakeCtx(over: Partial<EncounterUpdateContext> = {}): EncounterUpdateContext {
  return {
    aimAt: () => [1, 0],
    healthFraction: () => 1,
    flag: () => false,
    originOf: () => [0, 0],
    bossOrigin: () => [100, 40],
    viewport: () => ({ width: 480, height: 320 }),
    ...over,
  };
}

describe('sw2d.encounters', () => {
  it('capability id and schema', () => {
    expect(ENCOUNTERS_CAPABILITY_ID).toBe(CAPABILITY_IDS.encounters);
    expect(encountersPack.provides).toEqual([CAPABILITY_IDS.encounters]);
    expect(() => validateContentBundleData({ encounters: CATALOG })).not.toThrow();
  });

  it('rejects an unknown pattern kind', () => {
    const bad = { schemaVersion: 1, encounters: [{ id: 'x', phases: [{ id: 'p', emitters: [{ id: 'e', weaponId: 'w', everyMs: 1, pattern: { kind: 'zigzag' } }], completeWhen: { kind: 'spawns-cleared' } }] }] };
    expect(() => validateContentBundleData({ encounters: bad })).toThrow();
  });

  it('start throws for an unknown encounter id', () => {
    const { svc } = makeService();
    expect(() => svc.start('nope')).toThrow(UnknownEncounterError);
  });

  it('schedules staggered spawns and completes a phase only once every spawn is cleared', () => {
    const { svc } = makeService();
    svc.start('skirmish');
    const c = fakeCtx();
    let tick = svc.update(0, c);
    expect(tick.spawns.map((s) => s.requestId)).toEqual(['skirmish:p1:0:0']); // member 0 at t=0
    tick = svc.update(100, c);
    expect(tick.spawns).toHaveLength(1); // member 1 at t=100
    tick = svc.update(100, c);
    expect(tick.spawns).toHaveLength(1); // member 2 at t=200
    expect(svc.state().liveSpawnCount).toBe(3);

    // Not cleared until every spawned enemy is reported dead.
    svc.update(50, c);
    expect(svc.state().phaseId).toBe('p1');
    svc.reportDeath('skirmish:p1:0:0');
    svc.reportDeath('skirmish:p1:0:1');
    tick = svc.update(0, c);
    expect(tick.enteredPhaseId).toBeNull();
    svc.reportDeath('skirmish:p1:0:2');
    tick = svc.update(0, c);
    expect(tick.enteredPhaseId).toBe('p2');
    expect(svc.state().phaseIndex).toBe(1);
  });

  it('a phase-level emitter fires its pattern at the configured interval, deterministically', () => {
    const { svc } = makeService();
    svc.start('skirmish');
    const c = fakeCtx();
    // spawn all three (staggered 100ms), then clear the phase
    svc.update(0, c);
    svc.update(100, c);
    svc.update(100, c);
    for (const id of ['skirmish:p1:0:0', 'skirmish:p1:0:1', 'skirmish:p1:0:2']) svc.reportDeath(id);
    svc.update(0, c);
    expect(svc.state().phaseId).toBe('p2');

    expect(svc.update(199, c).fires).toHaveLength(0);
    const fire = svc.update(1, c).fires;
    expect(fire).toHaveLength(1);
    expect(fire[0]!.dirs).toHaveLength(6);
    expect(fire[0]!.originX).toBe(100); // bossOrigin
    // p2 completes at elapsed 500 (currently at 200).
    expect(svc.update(200, c).completed).toBe(false); // elapsed 400
    expect(svc.update(150, c).completed).toBe(true); // elapsed 550
  });

  it('boss phases transition on health thresholds and apply onEnter effects via the tick', () => {
    const { svc, events } = makeService();
    const changes: unknown[] = [];
    events.on('encounters:phaseChanged', (p) => changes.push(p));
    svc.start('boss');
    let health = 1;
    const c = fakeCtx({ healthFraction: () => health, flag: (n) => n === 'bossDead' && health <= 0 });

    svc.update(100, c);
    expect(svc.state().phaseId).toBe('b1');
    health = 0.6;
    let tick = svc.update(0, c);
    expect(tick.enteredPhaseId).toBe('b2');
    health = 0.3;
    tick = svc.update(0, c);
    expect(tick.enteredPhaseId).toBe('b3');
    health = 0;
    tick = svc.update(0, c);
    expect(tick.completed).toBe(true);
    expect(changes).toHaveLength(3); // start(b1), ->b2, ->b3
  });
});
