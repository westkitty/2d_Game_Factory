import { describe, expect, it } from 'vitest';
import { validateContentBundleData } from '@sw2d/schemas';
import type { GameContext, TargetingCatalog, TargetingService } from '@sw2d/contracts';
import { TARGETING_CAPABILITY_ID } from '@sw2d/contracts';
import { CAPABILITY_IDS } from '../src/ids.ts';
import { targetingPack } from '../src/targeting/targetingPack.ts';
import { FakeCapabilityRegistry, FakeEventBus } from './testSupport.ts';

const TOWER: TargetingCatalog = {
  schemaVersion: 1,
  mode: 'tower',
  actors: [
    { id: 'tower', x: 480, y: 270, range: 400, damage: 1, cooldownMs: 0, team: 'player', health: 3 },
    { id: 'creep-a', x: 280, y: 180, range: 40, damage: 1, cooldownMs: 600, team: 'enemy', health: 1 },
    { id: 'creep-b', x: 280, y: 360, range: 40, damage: 1, cooldownMs: 600, team: 'enemy', health: 1 },
  ],
};

const AUTO: TargetingCatalog = {
  schemaVersion: 1,
  mode: 'auto',
  actors: [
    { id: 'fox', x: 260, y: 270, range: 520, damage: 1, cooldownMs: 0, team: 'player', health: 2 },
    { id: 'cpu', x: 700, y: 270, range: 520, damage: 1, cooldownMs: 400, team: 'enemy', health: 1 },
  ],
};

const RANGE: TargetingCatalog = {
  schemaVersion: 1,
  mode: 'range',
  actors: [
    { id: 'scout', x: 256, y: 256, range: 96, damage: 1, cooldownMs: 0, team: 'player', health: 2 },
    { id: 'grunt', x: 640, y: 256, range: 48, damage: 1, cooldownMs: 400, team: 'enemy', health: 1 },
  ],
};

function install(catalog?: TargetingCatalog) {
  const events = new FakeEventBus();
  const capabilities = new FakeCapabilityRegistry();
  const ctx = {
    events,
    capabilities,
    content: catalog ? { data: { targeting: { schemaId: 'x', valid: true, value: catalog } } } : { data: {} },
  } as unknown as GameContext;
  const installed = targetingPack.install(ctx, undefined);
  const aim = capabilities.require<TargetingService>(TARGETING_CAPABILITY_ID);
  return { events, capabilities, installed, aim };
}

describe('sw2d.targeting - ids', () => {
  it('the contracts-exported capability id matches the packs CAPABILITY_IDS entry', () => {
    expect(TARGETING_CAPABILITY_ID).toBe(CAPABILITY_IDS.targeting);
    expect(targetingPack.provides).toEqual([TARGETING_CAPABILITY_ID]);
  });
});

describe('sw2d.targeting - schema', () => {
  it('accepts the three consumer catalogs', () => {
    expect(() => validateContentBundleData({ targeting: TOWER })).not.toThrow();
    expect(() => validateContentBundleData({ targeting: AUTO })).not.toThrow();
    expect(() => validateContentBundleData({ targeting: RANGE })).not.toThrow();
  });
});

describe('sw2d.targeting - tower', () => {
  it('auto-picks nearest in-range creeps and clears them', () => {
    const { aim } = install(TOWER);
    aim.tick(16, 0);
    aim.tick(16, 20);
    expect(aim.alive('enemy')).toBe(0);
    expect(aim.outcome()).toBe('complete');
  });
});

describe('sw2d.targeting - auto', () => {
  it('two sides strike until one pool is gone', () => {
    const { aim } = install(AUTO);
    aim.tick(16, 0);
    expect(aim.outcome()).toBe('complete');
    expect(aim.alive('enemy')).toBe(0);
  });
});

describe('sw2d.targeting - range', () => {
  it('a player strike is valid only inside authored range', () => {
    const { aim } = install(RANGE);
    expect(aim.canStrike('scout', 'grunt')).toBe(false);
    expect(aim.strike('scout', 'grunt', 0)).toBe(false);
    expect(aim.lastResult()).toBe('out-of-range');
    aim.setPos('scout', 600, 256);
    expect(aim.canStrike('scout', 'grunt')).toBe(true);
    expect(aim.strike('scout', 'grunt', 0)).toBe(true);
    expect(aim.outcome()).toBe('complete');
  });
});

describe('sw2d.targeting - lifecycle', () => {
  it('an empty catalog is inert', () => {
    const { aim } = install();
    expect(aim.active()).toBe(false);
    aim.tick(16, 0);
    expect(aim.outcome()).toBe('playing');
  });
});
