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
  it('walking the corridor into the cone fails immediately', () => {
    const { perception } = install(INFILTRATE);
    perception.setPlayer(120, 270);
    perception.tick(16);
    expect(perception.seen()).toBe(false);
    expect(perception.outcome()).toBe('playing');
    perception.setPlayer(400, 270);
    perception.tick(16);
    expect(perception.seen()).toBe(true);
    expect(perception.alarm()).toBe(true);
    expect(perception.outcome()).toBe('failed');
    expect(perception.lastResult()).toBe('spotted');
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
    perception.tick(16);
    expect(perception.outcome()).toBe('failed');
    perception.reset();
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
