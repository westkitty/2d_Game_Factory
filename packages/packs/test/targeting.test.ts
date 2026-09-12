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

  it('health() is the one readable health owner: full before the fight, zero for the dead side, restored by reset()', () => {
    // Category-C convergence: the generated auto-battler HUD once mirrored a
    // separate combat.health entity and reported the cpu at full health while
    // the targeting fight declared victory. Consumers read health here instead.
    const { aim } = install(AUTO);
    expect(aim.health('fox')).toBe(2);
    expect(aim.health('cpu')).toBe(1);
    expect(aim.health('nobody')).toBe(0);
    aim.tick(16, 0);
    expect(aim.health('cpu')).toBe(0);
    expect(aim.health('fox')).toBeGreaterThan(0);
    aim.reset();
    expect(aim.health('cpu')).toBe(1);
  });

  it('an inert (empty) catalog reports zero health for every id', () => {
    const { aim } = install();
    expect(aim.health('none')).toBe(0);
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

describe('sw2d.targeting - place and upgrade', () => {
  const PLACE: TargetingCatalog = {
    schemaVersion: 1,
    mode: 'tower',
    startingGold: 100,
    placeCost: 40,
    slots: [{ id: 'pad', x: 480, y: 200, radius: 36 }],
    upgrades: [
      { cost: 0, range: 400, damage: 10 },
      { cost: 30, range: 480, damage: 20 },
    ],
    actors: [{ id: 'creep-a', x: 200, y: 180, range: 40, damage: 1, cooldownMs: 600, team: 'enemy', health: 2 }],
  };

  it('places on a valid pad, spends gold, and rejects a second place on the same pad', () => {
    const { aim } = install(PLACE);
    expect(aim.placeAt(10, 10)).toBe(false);
    expect(aim.placementRejections()).toBe(1);
    expect(aim.placeAt(480, 200)).toBe(true);
    expect(aim.placedCount()).toBe(1);
    expect(aim.gold()).toBe(60);
    expect(aim.placeAt(480, 200)).toBe(false);
    expect(aim.towerDamage(aim.occupant('pad')!)).toBe(10);
  });

  it('upgrades an owned tower from authored tiers', () => {
    const { aim } = install(PLACE);
    aim.placeAt(480, 200);
    const id = aim.occupant('pad')!;
    expect(aim.upgrade(id)).toBe(true);
    expect(aim.towerDamage(id)).toBe(20);
    expect(aim.gold()).toBe(30);
    expect(aim.upgrade(id)).toBe(false);
    expect(aim.upgradeRejections()).toBe(1);
    aim.reset();
    expect(aim.gold()).toBe(100);
    expect(aim.placedCount()).toBe(0);
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
