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

describe('sw2d.encounters - escalation and boss sequence (Final Product Completion Wave 2/3)', () => {
  const ESCALATING = {
    schemaVersion: 1,
    escalation: { countPerWave: 1, healthScalePerWave: 0.5, speedScalePerWave: 0.25, maxWaves: 3 },
    encounters: [
      { id: 'loop', phases: [{ id: 'w', spawns: [{ archetype: 'grunt', count: 2, at: { kind: 'point', x: 10, y: 10 }, health: 20 }], completeWhen: { kind: 'spawns-cleared' } }] },
      { id: 'boss-a', phases: [{ id: 'p', spawns: [{ archetype: 'boss', count: 1, at: { kind: 'point', x: 5, y: 5 }, health: 50 }], completeWhen: { kind: 'spawns-cleared' } }] },
      { id: 'boss-b', phases: [{ id: 'p', spawns: [{ archetype: 'boss', count: 1, at: { kind: 'point', x: 5, y: 5 }, health: 80 }], completeWhen: { kind: 'spawns-cleared' } }] },
    ],
    sequence: { encounterIds: ['boss-a', 'boss-b'], transitionMs: 900 },
  } as const;

  const ctxFor = (): EncounterUpdateContext => fakeCtx();

  it('validates the escalation and sequence fields', () => {
    expect(() => validateContentBundleData({ encounters: ESCALATING })).not.toThrow();
    expect(() => validateContentBundleData({ encounters: { ...ESCALATING, escalation: { countPerWave: -1, healthScalePerWave: 0, speedScalePerWave: 0 } } })).toThrow();
  });

  it('wave N spawns more, tougher members, reports a speed scale, and clamps at maxWaves', () => {
    const service = makeService(ESCALATING as unknown as EncounterCatalog).svc;
    service.start('loop', { wave: 2 });
    expect(service.state().wave).toBe(2);
    expect(service.speedScale()).toBeCloseTo(1.5);
    const tick = service.update(16, ctxFor());
    expect(tick.spawns).toHaveLength(4);
    expect(tick.spawns[0]!.health).toBe(40);
    for (const s of tick.spawns) service.reportDeath(s.requestId);
    expect(service.update(16, ctxFor()).completed).toBe(true);
    service.start('loop', { wave: 9 });
    expect(service.state().wave).toBe(3);
    expect(service.update(16, ctxFor()).spawns).toHaveLength(5);
    service.start('loop');
    expect(service.state().wave).toBe(0);
    expect(service.speedScale()).toBe(1);
    expect(service.escalation()?.countPerWave).toBe(1);
    expect(service.sequence()?.encounterIds).toEqual(['boss-a', 'boss-b']);
  });

  it('a catalog without escalation ignores the wave option', () => {
    const service = makeService({ schemaVersion: 1, encounters: [ESCALATING.encounters[0]] } as unknown as EncounterCatalog).svc;
    service.start('loop', { wave: 5 });
    expect(service.state().wave).toBe(0);
    expect(service.update(16, ctxFor()).spawns).toHaveLength(2);
    expect(service.escalation()).toBeNull();
    expect(service.sequence()).toBeNull();
  });
});

describe('sw2d.encounters - entity-health-below waits for its own spawn (Final Product Completion Wave 3)', () => {
  it('does not complete the phase before the referenced spawn exists', () => {
    const catalog = {
      schemaVersion: 1,
      encounters: [
        {
          id: 'boss',
          phases: [
            { id: 'p1', spawns: [{ archetype: 'boss', count: 1, at: { kind: 'point', x: 1, y: 1 }, health: 100 }], completeWhen: { kind: 'entity-health-below', entityId: 'boss:p1:0:0', fraction: 0.5 } },
            { id: 'p2', completeWhen: { kind: 'elapsed', ms: 10 } },
          ],
        },
      ],
    } as unknown as EncounterCatalog;
    const { svc } = makeService(catalog);
    svc.start('boss');
    let fraction = 0;
    const ctx = fakeCtx({ healthFraction: () => fraction });
    const first = svc.update(16, ctx);
    expect(first.spawns).toHaveLength(1);
    expect(svc.state().phaseId).toBe('p1');
    fraction = 1;
    svc.update(16, ctx);
    expect(svc.state().phaseId).toBe('p1');
    fraction = 0.4;
    svc.update(16, ctx);
    expect(svc.state().phaseId).toBe('p2');
  });
});

describe('sw2d.encounters - entity-carried emitters on non-zero spawn groups', () => {
  it('fires emitters carried by spawn group 1 from that entity origin, not the boss', () => {
    const catalog = {
      schemaVersion: 1,
      encounters: [
        {
          id: 'assault',
          phases: [
            {
              id: 'wave-2',
              spawns: [
                { archetype: 'walker', count: 1, at: { kind: 'point', x: 10, y: 10 }, health: 20 },
                { archetype: 'shooter', count: 1, at: { kind: 'point', x: 80, y: 40 }, health: 30, emitterIds: ['aimed-shot'] },
              ],
              emitters: [{ id: 'aimed-shot', weaponId: 'enemy-blaster', pattern: { kind: 'aimed' }, everyMs: 200, startDelayMs: 0 }],
              completeWhen: { kind: 'elapsed', ms: 2000 },
            },
          ],
        },
      ],
    } as unknown as EncounterCatalog;
    const origins: Record<string, readonly [number, number]> = {
      'assault:wave-2:0:0': [10, 10],
      'assault:wave-2:1:0': [80, 40],
    };
    const { svc } = makeService(catalog);
    svc.start('assault');
    const ctx = fakeCtx({
      originOf: (id) => origins[id] ?? null,
      bossOrigin: () => [100, 40],
    });
    const spawned = svc.update(0, ctx);
    expect(spawned.spawns.map((s) => s.requestId).sort()).toEqual(['assault:wave-2:0:0', 'assault:wave-2:1:0']);
    expect(spawned.fires).toHaveLength(0);
    const tick = svc.update(200, ctx);
    expect(tick.fires).toHaveLength(1);
    expect(tick.fires[0]!.originX).toBe(80);
    expect(tick.fires[0]!.originY).toBe(40);
    expect(tick.fires[0]!.weaponId).toBe('enemy-blaster');
  });
});
