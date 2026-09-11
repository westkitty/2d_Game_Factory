import { describe, expect, it } from 'vitest';
import { validateContentBundleData } from '@sw2d/schemas';
import type { GameContext, WallCatalog, WallService } from '@sw2d/contracts';
import { WALL_CAPABILITY_ID } from '@sw2d/contracts';
import { CAPABILITY_IDS } from '../src/ids.ts';
import { wallPack } from '../src/wall/wallPack.ts';
import { FakeCapabilityRegistry, FakeEventBus } from './testSupport.ts';

const SLIDE: WallCatalog = {
  schemaVersion: 1,
  mode: 'slide',
  player: { x: 100, y: 458, radius: 16 },
  walls: [{ id: 'cliff', x: 280, y: 360, halfWidth: 18, halfHeight: 140 }],
  slideSpeed: 80,
  jumpVx: 140,
  jumpVy: -420,
  goal: { x: 420, y: 338, radius: 36 },
  failY: 520,
};

const LEAP: WallCatalog = {
  ...SLIDE,
  mode: 'leap',
  player: { x: 80, y: 458, radius: 16 },
  walls: [{ id: 'face', x: 240, y: 430, halfWidth: 16, halfHeight: 80 }],
  jumpVx: 280,
  goal: { x: 820, y: 458, radius: 36 },
};

function install(catalog?: WallCatalog) {
  const events = new FakeEventBus();
  const capabilities = new FakeCapabilityRegistry();
  const ctx = {
    events,
    capabilities,
    content: catalog ? { data: { wall: { schemaId: 'x', valid: true, value: catalog } } } : { data: {} },
  } as unknown as GameContext;
  const installed = wallPack.install(ctx, undefined);
  const walls = capabilities.require<WallService>(WALL_CAPABILITY_ID);
  return { events, capabilities, installed, walls };
}

describe('sw2d.wall - ids', () => {
  it('the contracts-exported capability id matches the packs CAPABILITY_IDS entry', () => {
    expect(WALL_CAPABILITY_ID).toBe(CAPABILITY_IDS.wall);
    expect(wallPack.provides).toEqual([WALL_CAPABILITY_ID]);
    expect(wallPack.dependencies).toEqual([]);
  });
});

describe('sw2d.wall - schema', () => {
  it('accepts the two consumer catalogs', () => {
    expect(() => validateContentBundleData({ wall: SLIDE })).not.toThrow();
    expect(() => validateContentBundleData({ wall: LEAP })).not.toThrow();
  });

  it('rejects an unknown mode', () => {
    expect(() => validateContentBundleData({ wall: { ...SLIDE, mode: 'ledge' } })).toThrow();
  });
});

describe('sw2d.wall - slide', () => {
  it('caps fall speed while holding into a wall and jump climbs away', () => {
    const { walls } = install(SLIDE);
    expect(walls.mode()).toBe('slide');
    walls.setPlayer(280 + 18 + 8, 360, 40, 200, false);
    walls.setHoldX(1);
    walls.tick(16);
    expect(walls.sliding()).toBe(true);
    expect(walls.vy()).toBe(80);
    const kick = walls.jump();
    expect(kick).not.toBeNull();
    expect(kick!.vy).toBe(-420);
    expect(walls.lastResult()).toBe('climb');
  });

  it('reaching the goal completes', () => {
    const { walls } = install(SLIDE);
    walls.setPlayer(420, 338, 0, 0, true);
    walls.tick(16);
    expect(walls.outcome()).toBe('complete');
  });
});

describe('sw2d.wall - leap', () => {
  it('jump from a wall kicks away', () => {
    const { walls } = install(LEAP);
    walls.setPlayer(240 + 16 + 8, 430, 10, 40, false);
    walls.setHoldX(1);
    walls.tick(16);
    expect(walls.sliding()).toBe(true);
    const kick = walls.jump();
    expect(kick?.vx).toBe(-280);
    expect(walls.lastResult()).toBe('leap');
  });
});

describe('sw2d.wall - lifecycle', () => {
  it('withdraws its capability on dispose', () => {
    const { capabilities, installed } = install(SLIDE);
    expect(capabilities.has(WALL_CAPABILITY_ID)).toBe(true);
    installed.dispose();
    expect(capabilities.has(WALL_CAPABILITY_ID)).toBe(false);
  });

  it('a missing content/wall.json yields an inert service, not an error', () => {
    const { walls } = install();
    expect(walls.active()).toBe(false);
    walls.tick(1000);
    expect(walls.jump()).toBeNull();
    expect(walls.outcome()).toBe('playing');
  });
});
