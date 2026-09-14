import { describe, expect, it } from 'vitest';
import { validateContentBundleData } from '@sw2d/schemas';
import type { GameContext, PerceptionCatalog, PerceptionService } from '@sw2d/contracts';
import { PERCEPTION_CAPABILITY_ID } from '@sw2d/contracts';
import { CAPABILITY_IDS } from '../src/ids.ts';
import { perceptionPack } from '../src/perception/perceptionPack.ts';
import { FakeCapabilityRegistry, FakeEventBus } from './testSupport.ts';

const INFILTRATE: PerceptionCatalog = {
  schemaVersion: 1,
  mode: 'infiltrate',
  start: { x: 120, y: 270 },
  playerRadius: 14,
  hiddenMultiplier: 0.15,
  observers: [
    {
      id: 'guard',
      x: 520,
      y: 270,
      facingDeg: 180,
      fovDeg: 50,
      range: 220,
      suspicionRisePerSecond: 2,
      suspicionDecayPerSecond: 0.5,
    },
  ],
  cover: [{ id: 'crate', x: 400, y: 180, radius: 36 }],
  objectives: [{ id: 'intel', x: 790, y: 140, radius: 42 }],
  exits: [{ id: 'vent', x: 110, y: 90, radius: 48 }],
};

const HEIST: PerceptionCatalog = {
  ...INFILTRATE,
  mode: 'heist',
};

function install(catalog?: PerceptionCatalog) {
  const events = new FakeEventBus();
  const capabilities = new FakeCapabilityRegistry();
  const ctx = {
    events,
    capabilities,
    content: catalog ? { data: { perception: { schemaId: 'x', valid: true, value: catalog } } } : { data: {} },
  } as unknown as GameContext;
  const installed = perceptionPack.install(ctx, undefined);
  const perception = capabilities.require<PerceptionService>(PERCEPTION_CAPABILITY_ID);
  return { events, capabilities, installed, perception };
}

describe('sw2d.perception - ids', () => {
  it('the contracts-exported capability id matches the packs CAPABILITY_IDS entry', () => {
    expect(PERCEPTION_CAPABILITY_ID).toBe(CAPABILITY_IDS.perception);
    expect(perceptionPack.provides).toEqual([PERCEPTION_CAPABILITY_ID]);
  });
});

describe('sw2d.perception - schema', () => {
  it('accepts the two consumer catalogs', () => {
    expect(() => validateContentBundleData({ perception: INFILTRATE })).not.toThrow();
    expect(() => validateContentBundleData({ perception: HEIST })).not.toThrow();
  });

  it('rejects an unknown mode', () => {
    expect(() => validateContentBundleData({ perception: { ...INFILTRATE, mode: 'takedown' } })).toThrow();
  });
});

describe('sw2d.perception - infiltrate', () => {
  it('walking the corridor into the cone is spotted; the guard chases and catches the player', () => {
    const { perception } = install(INFILTRATE);
    perception.setPlayer(120, 270);
    perception.tick(16);
    expect(perception.seen()).toBe(false);
    expect(perception.outcome()).toBe('playing');
    perception.setPlayer(400, 270);
    perception.tick(16);
    expect(perception.seen()).toBe(true);
    expect(perception.alarm()).toBe(true);
    expect(perception.observers()[0]!.state).toBe('chase');
    expect(perception.lastResult()).toBe('spotted');
    expect(perception.outcome()).toBe('playing');
    // 120 px at the default 90 px/s chase speed: caught inside two seconds of standing still.
    for (let i = 0; i < 120 && perception.outcome() === 'playing'; i++) perception.tick(16.67);
    expect(perception.outcome()).toBe('failed');
    expect(perception.lastResult()).toBe('caught');
  });

  it('the northern bypass collects and escapes without alarm', () => {
    const { perception } = install(INFILTRATE);
    perception.setPlayer(120, 100);
    perception.tick(16);
    expect(perception.seen()).toBe(false);
    perception.setPlayer(790, 140);
    perception.tick(16);
    expect(perception.objectiveCollected()).toBe(true);
    expect(perception.alarm()).toBe(false);
    expect(perception.outcome()).toBe('playing');
    perception.setPlayer(110, 90);
    perception.tick(16);
    expect(perception.outcome()).toBe('complete');
    expect(perception.lastResult()).toBe('escaped');
  });

  it('cover in the cone hides the player instead of failing', () => {
    const catalog: PerceptionCatalog = {
      ...INFILTRATE,
      cover: [{ id: 'crate', x: 400, y: 270, radius: 40 }],
    };
    const { perception } = install(catalog);
    perception.setPlayer(400, 270);
    perception.tick(16);
    expect(perception.hidden()).toBe(true);
    expect(perception.seen()).toBe(true);
    expect(perception.outcome()).toBe('playing');
    expect(perception.lastResult()).toBe('hidden');
  });
});

describe('sw2d.perception - heist', () => {
  it('looting sets alarm without failing, and exit still completes', () => {
    const { perception } = install(HEIST);
    perception.setPlayer(790, 140);
    perception.tick(16);
    expect(perception.objectiveCollected()).toBe(true);
    expect(perception.alarm()).toBe(true);
    expect(perception.lastResult()).toBe('looted');
    expect(perception.outcome()).toBe('playing');
    perception.setPlayer(110, 90);
    perception.tick(16);
    expect(perception.outcome()).toBe('complete');
    expect(perception.alarm()).toBe(true);
  });

  it('being seen raises alarm but does not fail the heist', () => {
    const { perception } = install(HEIST);
    perception.setPlayer(400, 270);
    perception.tick(16);
    expect(perception.seen()).toBe(true);
    expect(perception.alarm()).toBe(true);
    expect(perception.outcome()).toBe('playing');
  });

  it('exit without the loot is blocked', () => {
    const { perception } = install(HEIST);
    perception.setPlayer(110, 90);
    perception.tick(16);
    expect(perception.objectiveCollected()).toBe(false);
    expect(perception.outcome()).toBe('playing');
  });
});

describe('sw2d.perception - occlusion / lifecycle', () => {
  it('an AABB occluder blocks line of sight', () => {
    const catalog: PerceptionCatalog = {
      schemaVersion: 1,
      mode: 'infiltrate',
      start: { x: 200, y: 0 },
      playerRadius: 8,
      hiddenMultiplier: 0.2,
      observers: [
        {
          id: 'eye',
          x: 0,
          y: 0,
          facingDeg: 0,
          fovDeg: 40,
          range: 300,
          suspicionRisePerSecond: 4,
          suspicionDecayPerSecond: 1,
        },
      ],
      occluders: [{ id: 'wall', x: 80, y: -20, width: 20, height: 40 }],
    };
    const { perception } = install(catalog);
    perception.setPlayer(200, 0);
    perception.tick(16);
    expect(perception.seen()).toBe(false);
    expect(perception.outcome()).toBe('playing');
  });

  it('withdraws its capability on dispose', () => {
    const { capabilities, installed } = install(INFILTRATE);
    expect(capabilities.has(PERCEPTION_CAPABILITY_ID)).toBe(true);
    installed.dispose();
    expect(capabilities.has(PERCEPTION_CAPABILITY_ID)).toBe(false);
  });

  it('duplicate ids throw at install', () => {
    const events = new FakeEventBus();
    const capabilities = new FakeCapabilityRegistry();
    const catalog: PerceptionCatalog = {
      ...INFILTRATE,
      observers: [INFILTRATE.observers[0]!, INFILTRATE.observers[0]!],
    };
    const ctx = {
      events,
      capabilities,
      content: { data: { perception: { schemaId: 'x', valid: true, value: catalog } } },
    } as unknown as GameContext;
    expect(() => perceptionPack.install(ctx, undefined)).toThrow(/guard/);
  });

  it('a missing content/perception.json yields an inert service, not an error', () => {
    const { perception } = install();
    expect(perception.active()).toBe(false);
    perception.tick(16);
    expect(perception.outcome()).toBe('playing');
  });

  it('reset restores start, loot and suspicion', () => {
    const { perception } = install(INFILTRATE);
    perception.setPlayer(400, 270);
    for (let i = 0; i < 120 && perception.outcome() === 'playing'; i++) perception.tick(16.67);
    expect(perception.outcome()).toBe('failed');
    perception.reset();
    expect(perception.observers()[0]!.state).toBe('patrol');
    expect(perception.observers()[0]!.x).toBe(520);
    expect(perception.outcome()).toBe('playing');
    expect(perception.alarm()).toBe(false);
    expect(perception.objectiveCollected()).toBe(false);
    expect(perception.player()).toEqual({ x: 120, y: 270 });
    expect(perception.maxSuspicion()).toBe(0);
  });

  it('noise raises alarm without requiring LOS', () => {
    const { perception } = install(HEIST);
    expect(perception.noise(1).reason).toBe('alarmed');
    expect(perception.alarm()).toBe(true);
    expect(perception.outcome()).toBe('playing');
  });
});

describe('sw2d.perception - patrol, investigation, return and takedown (Final Product Completion Wave 2)', () => {
  const PATROL: PerceptionCatalog = {
    ...INFILTRATE,
    observers: [
      {
        id: 'guard',
        x: 520,
        y: 270,
        facingDeg: 180,
        fovDeg: 50,
        range: 220,
        suspicionRisePerSecond: 2,
        suspicionDecayPerSecond: 0.5,
        patrol: { waypoints: [{ x: 520, y: 270 }, { x: 700, y: 270 }], speed: 60, waitMs: 500 },
        chaseSpeed: 90,
        catchRadius: 24,
        memoryMs: 600,
        investigateMs: 400,
        takedownRadius: 40,
      },
    ],
  };

  function run(perception: PerceptionService, ms: number, step = 16.67): void {
    for (let t = 0; t < ms && perception.outcome() === 'playing'; t += step) perception.tick(step);
  }

  it('validates patrol and AI tuning in the schema', () => {
    expect(() => validateContentBundleData({ perception: PATROL })).not.toThrow();
    expect(() => validateContentBundleData({ perception: { ...PATROL, observers: [{ ...PATROL.observers[0]!, patrol: { waypoints: [], speed: 1, waitMs: 0 } }] } })).toThrow();
  });

  it('walks the route, waits at waypoints, faces its direction of travel and loops', () => {
    const { perception } = install(PATROL);
    perception.setPlayer(-500, -500);
    run(perception, 1000);
    const o = perception.observers()[0]!;
    expect(o.state).toBe('patrol');
    expect(o.patrolling).toBe(true);
    expect(o.x).toBeGreaterThan(520);
    expect(o.facingDeg).toBeCloseTo(0, 0);
    run(perception, 4000);
    const back = perception.observers()[0]!;
    expect(back.x).toBeLessThan(700);
    expect(Math.abs(back.facingDeg)).toBeCloseTo(180, 0);
  });

  it('chase -> lost sight -> investigate the last known position -> return -> patrol', () => {
    const { perception, events } = install(PATROL);
    const log: string[] = [];
    events.on('perception:stateChanged', (p) => log.push(`${p.from}>${p.to}`));
    // The guard walks east; standing east of it in its cone is a clear sighting.
    perception.setPlayer(640, 270);
    run(perception, 900);
    expect(perception.observers()[0]!.state).toBe('chase');
    expect(perception.observers()[0]!.lastKnown).toEqual({ x: 640, y: 270 });
    // Teleport out of sight (behind an occluder-free far corner): the chaser runs to the last known spot, gives up, returns.
    perception.setPlayer(-800, -800);
    run(perception, 700);
    expect(perception.observers()[0]!.state).toBe('investigate');
    run(perception, 2000);
    expect(['return', 'patrol']).toContain(perception.observers()[0]!.state);
    run(perception, 4000);
    expect(perception.observers()[0]!.state).toBe('patrol');
    expect(perception.alarm()).toBe(false);
    expect(log[0]).toBe('patrol>chase');
    expect(log).toContain('chase>investigate');
    expect(log).toContain('investigate>return');
    expect(log).toContain('return>patrol');
    expect(perception.transitions().length).toBe(log.length);
    expect(perception.outcome()).toBe('playing');
  });

  it('partial sight (hidden in cover inside the cone) makes the guard suspicious and turn, then relax', () => {
    const { patrol: _route, ...stationary } = PATROL.observers[0]!;
    void _route;
    const catalog: PerceptionCatalog = { ...PATROL, observers: [stationary], cover: [{ id: 'crate', x: 420, y: 270, radius: 36 }] };
    const { perception } = install(catalog);
    perception.setPlayer(420, 270);
    run(perception, 100);
    expect(perception.hidden()).toBe(true);
    run(perception, 1400);
    const o = perception.observers()[0]!;
    expect(o.state).toBe('suspicious');
    expect(perception.outcome()).toBe('playing');
    perception.setPlayer(-800, -800);
    run(perception, 2000);
    expect(perception.observers()[0]!.state).toBe('patrol');
  });

  it('a heist loot noise sends every standing observer to investigate the noise', () => {
    const { perception } = install({ ...PATROL, mode: 'heist', objectives: [{ id: 'intel', x: 300, y: 100, radius: 30 }] });
    perception.setPlayer(300, 100);
    perception.tick(16);
    expect(perception.objectiveCollected()).toBe(true);
    expect(perception.alarm()).toBe(true);
    expect(perception.observers()[0]!.state).toBe('investigate');
    expect(perception.observers()[0]!.lastKnown).toEqual({ x: 300, y: 100 });
    expect(perception.outcome()).toBe('playing');
  });

  it('a takedown from outside the cone downs the guard; from inside its view it is refused', () => {
    const { perception, events } = install(PATROL);
    const downed: string[] = [];
    events.on('perception:takedown', (p) => downed.push(p.observerId));
    // Behind the guard (it faces west at the start): within 40 px, outside the cone.
    perception.setPlayer(550, 270);
    perception.tick(16);
    expect(perception.seen()).toBe(false);
    expect(perception.takedown()).toEqual({ ok: true, reason: 'takedown' });
    expect(perception.observers()[0]!.state).toBe('downed');
    expect(perception.takedowns()).toBe(1);
    expect(downed).toEqual(['guard']);
    // A downed guard never sees or moves again; a second takedown finds no target.
    perception.setPlayer(400, 270);
    run(perception, 1000);
    expect(perception.seen()).toBe(false);
    expect(perception.observers()[0]!.x).toBe(520);
    expect(perception.takedown().reason).toBe('no-target');
    const fresh = install(PATROL).perception;
    fresh.setPlayer(490, 270);
    fresh.tick(16);
    expect(fresh.seen()).toBe(true);
    expect(fresh.takedown().reason).toBe('in-view');
    expect(fresh.observers()[0]!.state).toBe('chase');
  });
});
