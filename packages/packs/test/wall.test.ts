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
    // Player just left of the cliff face, pushing right into it while falling.
    walls.setPlayer(280 - 18 - 8, 360, 40, 200, false);
    walls.setHoldX(1);
    walls.tick(16);
    expect(walls.sliding()).toBe(true);
    expect(walls.vy()).toBe(80);
    const kick = walls.jump();
    expect(kick).not.toBeNull();
    expect(kick!.vy).toBe(-420);
    // Kicks away from the wall (left), never back into it.
    expect(kick!.vx).toBe(-140);
    expect(walls.lastResult()).toBe('climb');
    // Pushing away from the wall never slides.
    walls.setPlayer(280 - 18 - 8, 380, 0, 200, false);
    walls.setHoldX(-1);
    walls.tick(16);
    expect(walls.sliding()).toBe(false);
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
    walls.setPlayer(240 - 16 - 8, 430, 10, 40, false);
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

describe('sw2d.wall - ledge grammar (Final Product Completion Wave 1)', () => {
  const LEDGES: WallCatalog = {
    ...LEAP,
    ledges: [{ id: 'gap-ledge', x: 360, y: 480, side: 'left', grabHalfWidth: 22, grabHalfHeight: 28 }],
    hangOffsetX: 14,
    hangOffsetY: 22,
    hangJumpVy: -400,
    climbMs: 180,
    regrabLockoutMs: 400,
  };

  it('validates as content/wall.json with ledges and the tuning fields', () => {
    expect(() => validateContentBundleData({ wall: LEDGES })).not.toThrow();
    expect(() => validateContentBundleData({ wall: { ...LEDGES, ledges: [{ id: 'x', x: 0, y: 0, side: 'up', grabHalfWidth: 1, grabHalfHeight: 1 }] } })).toThrow();
  });

  it('starts grounded, goes airborne, and grabs the ledge when falling into its box from the open side', () => {
    const { walls, events } = install(LEDGES);
    const log: string[] = [];
    events.on('wall:ledge', (p) => log.push(`${p.ledgeId}:${p.transition}`));
    walls.setPlayer(100, 458, 0, 0, true);
    walls.tick(16);
    expect(walls.state()).toBe('grounded');
    walls.setPlayer(300, 470, 220, 120, false);
    walls.setHoldX(1);
    walls.tick(16);
    expect(walls.state()).toBe('airborne');
    expect(walls.pinned()).toBeNull();
    walls.setPlayer(346, 500, 220, 160, false);
    walls.tick(16);
    expect(walls.state()).toBe('ledge-hang');
    expect(walls.ledgeId()).toBe('gap-ledge');
    expect(walls.pinned()).toEqual({ x: 346, y: 502 });
    expect(walls.lastResult()).toBe('grabbed');
    expect(walls.ledgeStats().grabs).toBe(1);
    expect(log).toEqual(['gap-ledge:grabbed']);
    // Shell echoes are ignored while pinned.
    walls.setPlayer(0, 0, 0, 0, false);
    expect(walls.x()).toBe(346);
  });

  it('does not grab while moving away from the corner or rising fast', () => {
    const { walls } = install(LEDGES);
    walls.setPlayer(346, 500, -200, 100, false);
    walls.setHoldX(-1);
    walls.tick(16);
    expect(walls.state()).toBe('airborne');
    walls.setHoldX(1);
    walls.setPlayer(346, 500, 200, -300, false);
    walls.tick(16);
    expect(walls.state()).toBe('airborne');
  });

  function hang(): ReturnType<typeof install> {
    const installed = install(LEDGES);
    installed.walls.setHoldX(1);
    installed.walls.setPlayer(346, 500, 220, 160, false);
    installed.walls.tick(16);
    expect(installed.walls.state()).toBe('ledge-hang');
    return installed;
  }

  it('UP climbs over climbMs and lands grounded on the ledge top', () => {
    const { walls } = hang();
    expect(walls.climb()).toBe(true);
    expect(walls.state()).toBe('climbing');
    walls.tick(90);
    const mid = walls.pinned()!;
    expect(mid.y).toBeLessThan(502);
    expect(mid.y).toBeGreaterThan(456);
    walls.tick(90);
    expect(walls.state()).toBe('grounded');
    expect(walls.pinned()).toBeNull();
    expect(walls.lastResult()).toBe('climbed');
    expect(walls.x()).toBeGreaterThan(360);
    expect(walls.y()).toBe(480 - 16 - 8);
    expect(walls.ledgeStats()).toEqual({ grabs: 1, climbs: 1, drops: 0 });
    expect(walls.climb()).toBe(false);
  });

  it('DOWN drops and locks out an immediate regrab', () => {
    const { walls } = hang();
    expect(walls.drop()).toBe(true);
    expect(walls.state()).toBe('airborne');
    expect(walls.lastResult()).toBe('dropped');
    walls.setPlayer(346, 500, 0, 50, false);
    walls.tick(16);
    expect(walls.state()).toBe('airborne');
    walls.tick(500);
    walls.setPlayer(346, 500, 0, 50, false);
    walls.tick(16);
    expect(walls.state()).toBe('ledge-hang');
    expect(walls.ledgeStats().drops).toBe(1);
    expect(walls.drop()).toBe(true);
    expect(walls.drop()).toBe(false);
  });

  it('JUMP from a hang launches straight up with hangJumpVy', () => {
    const { walls } = hang();
    expect(walls.jump()).toEqual({ vx: 0, vy: -400 });
    expect(walls.state()).toBe('airborne');
    expect(walls.lastResult()).toBe('hang-jump');
  });

  it('release() lets an external force take over, and reset() clears everything', () => {
    const { walls } = hang();
    walls.release();
    expect(walls.state()).toBe('airborne');
    expect(walls.lastResult()).toBe('released');
    walls.reset();
    expect(walls.state()).toBe('grounded');
    expect(walls.ledgeStats()).toEqual({ grabs: 0, climbs: 0, drops: 0 });
    expect(walls.pinned()).toBeNull();
  });

  it('a hang wins over a slide, and wall-jump from a slide still works', () => {
    const { walls } = install({ ...LEDGES, walls: [{ id: 'face', x: 380, y: 430, halfWidth: 16, halfHeight: 80 }] });
    walls.setHoldX(1);
    walls.setPlayer(346, 500, 220, 160, false);
    walls.tick(16);
    expect(walls.state()).toBe('ledge-hang');
    expect(walls.sliding()).toBe(false);
    walls.drop();
    walls.setPlayer(356, 440, 0, 300, false);
    walls.tick(500);
    walls.setPlayer(356, 440, 0, 300, false);
    walls.tick(16);
    expect(walls.state()).toBe('sliding');
    expect(walls.jump()).toEqual({ vx: -280, vy: -420 });
  });
});
