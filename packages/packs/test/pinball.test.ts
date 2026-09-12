import { describe, expect, it } from 'vitest';
import { validateContentBundleData } from '@sw2d/schemas';
import type { GameContext, PinballCatalog, PinballService } from '@sw2d/contracts';
import { PINBALL_CAPABILITY_ID } from '@sw2d/contracts';
import { CAPABILITY_IDS } from '../src/ids.ts';
import { pinballPack } from '../src/pinball/pinballPack.ts';
import { FakeCapabilityRegistry, FakeEventBus } from './testSupport.ts';

const TABLE: PinballCatalog = {
  schemaVersion: 1,
  mode: 'table',
  ball: { x: 480, y: 90, radius: 14, vx: 2.4, vy: 6 },
  gravity: 18,
  bounce: 0.7,
  bounds: { minX: 24, maxX: 936, minY: 24, maxY: 520 },
  bumpers: [
    { id: 'bumper-a', x: 400, y: 220, radius: 28, score: 1 },
    { id: 'bumper-b', x: 560, y: 220, radius: 28, score: 1 },
  ],
  flippers: [
    { id: 'left', x: 300, y: 470, halfWidth: 50, kick: 10 },
    { id: 'right', x: 660, y: 470, halfWidth: 50, kick: 10 },
  ],
  drainY: 530,
  winScore: 2,
};

const TOY: PinballCatalog = {
  schemaVersion: 1,
  mode: 'toy',
  ball: { x: 220, y: 400, radius: 14, vx: 0, vy: 0 },
  gravity: 14,
  bounce: 0.4,
  bounds: { minX: 24, maxX: 936, minY: 24, maxY: 520 },
  bumpers: [],
  goal: { x: 800, y: 478, radius: 40 },
  drainY: 530,
  winScore: 1,
};

function install(catalog?: PinballCatalog) {
  const events = new FakeEventBus();
  const capabilities = new FakeCapabilityRegistry();
  const ctx = {
    events,
    capabilities,
    content: catalog ? { data: { pinball: { schemaId: 'x', valid: true, value: catalog } } } : { data: {} },
  } as unknown as GameContext;
  const installed = pinballPack.install(ctx, undefined);
  const table = capabilities.require<PinballService>(PINBALL_CAPABILITY_ID);
  return { events, capabilities, installed, table };
}

describe('sw2d.pinball - ids', () => {
  it('the contracts-exported capability id matches the packs CAPABILITY_IDS entry', () => {
    expect(PINBALL_CAPABILITY_ID).toBe(CAPABILITY_IDS.pinball);
    expect(pinballPack.provides).toEqual([PINBALL_CAPABILITY_ID]);
  });
});

describe('sw2d.pinball - schema', () => {
  it('accepts the two consumer catalogs', () => {
    expect(() => validateContentBundleData({ pinball: TABLE })).not.toThrow();
    expect(() => validateContentBundleData({ pinball: TOY })).not.toThrow();
  });

  it('rejects an unknown mode', () => {
    expect(() => validateContentBundleData({ pinball: { ...TABLE, mode: 'breakout' } })).toThrow();
  });
});

describe('sw2d.pinball - table', () => {
  it('bumper hits score and complete at winScore', () => {
    const { table } = install({
      ...TABLE,
      ball: { x: 400, y: 220, radius: 14, vx: 0, vy: 0 },
      gravity: 0.01,
    });
    table.tick(16);
    expect(table.score()).toBeGreaterThanOrEqual(1);
    table.tick(200);
    table.reset();
    const second = install({
      ...TABLE,
      ball: { x: 400, y: 220, radius: 14, vx: 0, vy: 0 },
      gravity: 0.01,
      winScore: 1,
    });
    second.table.tick(16);
    expect(second.table.outcome()).toBe('complete');
  });

  it('table drains consume balls and game-over at zero', () => {
    const { table } = install({ ...TABLE, balls: 2, ball: { x: 480, y: 540, radius: 14, vx: 0, vy: 4 } });
    expect(table.ballsRemaining()).toBe(2);
    table.tick(16);
    expect(table.lastResult()).toBe('drain');
    expect(table.ballsRemaining()).toBe(1);
    expect(table.outcome()).toBe('playing');
    table.tick(200);
    expect(table.ballsRemaining()).toBe(0);
    expect(table.outcome()).toBe('failed');
    expect(table.lastResult()).toBe('game-over');
  });
});

describe('sw2d.pinball - toy', () => {
  it('landing in the pocket completes', () => {
    const { table } = install({
      ...TOY,
      ball: { x: 800, y: 478, radius: 14, vx: 0, vy: 0 },
      gravity: 0.01,
    });
    table.tick(16);
    expect(table.outcome()).toBe('complete');
    expect(table.lastResult()).toBe('pocket');
  });
});

describe('sw2d.pinball - lifecycle', () => {
  it('zero gravity is inert', () => {
    const { table } = install();
    expect(table.active()).toBe(false);
    table.tick(1000);
    expect(table.score()).toBe(0);
  });
});
