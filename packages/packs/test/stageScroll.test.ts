import { describe, expect, it } from 'vitest';
import { validateContentBundleData } from '@sw2d/schemas';
import type { GameContext, StageScrollCatalog, StageScrollService } from '@sw2d/contracts';
import { STAGE_SCROLL_CAPABILITY_ID } from '@sw2d/contracts';
import { CAPABILITY_IDS } from '../src/ids.ts';
import { stageScrollPack } from '../src/stageScroll/stageScrollPack.ts';
import { FakeCapabilityRegistry, FakeEventBus } from './testSupport.ts';

const HORIZONTAL: StageScrollCatalog = {
  schemaVersion: 1,
  mode: 'horizontal',
  speed: 180,
  length: 720,
  viewport: { width: 960, height: 540 },
  player: { x: 120, y: 270, radius: 16, speed: 210, minX: 40, maxX: 420, minY: 40, maxY: 500 },
  hazards: [
    { id: 'rock-a', along: 280, cross: 90, radius: 18 },
    { id: 'rock-b', along: 480, cross: 450, radius: 18 },
    { id: 'rock-c', along: 640, cross: 90, radius: 18 },
  ],
};

const VERTICAL: StageScrollCatalog = {
  schemaVersion: 1,
  mode: 'vertical',
  speed: 180,
  length: 720,
  viewport: { width: 960, height: 540 },
  player: { x: 480, y: 440, radius: 16, speed: 210, minX: 40, maxX: 920, minY: 260, maxY: 510 },
  hazards: [
    { id: 'rock-a', along: 280, cross: 120, radius: 18 },
    { id: 'rock-b', along: 480, cross: 840, radius: 18 },
    { id: 'rock-c', along: 640, cross: 120, radius: 18 },
  ],
};

function install(catalog?: StageScrollCatalog) {
  const events = new FakeEventBus();
  const capabilities = new FakeCapabilityRegistry();
  const ctx = {
    events,
    capabilities,
    content: catalog ? { data: { 'stage-scroll': { schemaId: 'x', valid: true, value: catalog } } } : { data: {} },
  } as unknown as GameContext;
  const installed = stageScrollPack.install(ctx, undefined);
  const stage = capabilities.require<StageScrollService>(STAGE_SCROLL_CAPABILITY_ID);
  return { events, capabilities, installed, stage };
}

describe('sw2d.stage-scroll - ids', () => {
  it('the contracts-exported capability id matches the packs CAPABILITY_IDS entry', () => {
    expect(STAGE_SCROLL_CAPABILITY_ID).toBe(CAPABILITY_IDS.stageScroll);
    expect(stageScrollPack.provides).toEqual([STAGE_SCROLL_CAPABILITY_ID]);
    expect(stageScrollPack.dependencies).toEqual([]);
  });
});

describe('sw2d.stage-scroll - schema', () => {
  it('accepts the two consumer catalogs', () => {
    expect(() => validateContentBundleData({ 'stage-scroll': HORIZONTAL })).not.toThrow();
    expect(() => validateContentBundleData({ 'stage-scroll': VERTICAL })).not.toThrow();
  });

  it('rejects an unknown mode', () => {
    expect(() => validateContentBundleData({ 'stage-scroll': { ...HORIZONTAL, mode: 'rail' } })).toThrow();
  });
});

describe('sw2d.stage-scroll - horizontal', () => {
  it('advances offset and completes at length', () => {
    const { stage } = install(HORIZONTAL);
    expect(stage.mode()).toBe('horizontal');
    expect(stage.fireDir()).toEqual({ x: 1, y: 0 });
    expect(stage.offset()).toBe(0);
    stage.tick(1000);
    expect(stage.offset()).toBe(180);
    expect(stage.progress()).toBeCloseTo(180 / 720);
    expect(stage.outcome()).toBe('playing');
    stage.tick(4000);
    expect(stage.offset()).toBe(720);
    expect(stage.progress()).toBe(1);
    expect(stage.outcome()).toBe('complete');
  });

  it('clamps the ship to the authored band', () => {
    const { stage } = install({ ...HORIZONTAL, length: 99_999 });
    stage.setMove(-1, -1);
    stage.tick(5000);
    const p = stage.player();
    expect(p.x).toBe(40);
    expect(p.y).toBe(40);
    stage.setMove(1, 1);
    stage.tick(5000);
    const q = stage.player();
    expect(q.x).toBe(420);
    expect(q.y).toBe(500);
  });

  it('places a hazard on the incoming right edge when offset equals along', () => {
    const { stage } = install({
      ...HORIZONTAL,
      hazards: [{ id: 'edge', along: 180, cross: 270, radius: 18 }],
    });
    stage.tick(1000);
    const hazard = stage.hazards()[0]!;
    expect(stage.offset()).toBe(180);
    expect(hazard.x).toBe(960);
    expect(hazard.y).toBe(270);
    expect(hazard.visible).toBe(true);
  });
});

describe('sw2d.stage-scroll - vertical', () => {
  it('fires up and streams hazards down from the top edge', () => {
    const { stage } = install(VERTICAL);
    expect(stage.fireDir()).toEqual({ x: 0, y: -1 });
    stage.tick(1000);
    const hazard = stage.hazards().find((entry) => entry.id === 'rock-a')!;
    expect(stage.offset()).toBe(180);
    expect(hazard.x).toBe(120);
    expect(hazard.y).toBe(180 - 280);
    expect(hazard.visible).toBe(false);
    stage.tick(1000);
    const entered = stage.hazards().find((entry) => entry.id === 'rock-a')!;
    expect(entered.y).toBe(360 - 280);
    expect(entered.visible).toBe(true);
  });
});

describe('sw2d.stage-scroll - contact', () => {
  it('reports lastHit when the ship overlaps a visible hazard', () => {
    const { stage } = install({
      ...HORIZONTAL,
      player: { ...HORIZONTAL.player, x: 960, y: 270, minX: 0, maxX: 960 },
      hazards: [{ id: 'edge', along: 0, cross: 270, radius: 18 }],
    });
    stage.tick(16);
    expect(stage.lastHit()).toBe('edge');
    stage.setMove(-1, 0);
    stage.tick(5000);
    expect(stage.lastHit()).toBeNull();
  });
});

describe('sw2d.stage-scroll - lifecycle', () => {
  it('withdraws its capability on dispose', () => {
    const { capabilities, installed } = install(HORIZONTAL);
    expect(capabilities.has(STAGE_SCROLL_CAPABILITY_ID)).toBe(true);
    installed.dispose();
    expect(capabilities.has(STAGE_SCROLL_CAPABILITY_ID)).toBe(false);
  });

  it('duplicate hazard ids throw at install', () => {
    const events = new FakeEventBus();
    const capabilities = new FakeCapabilityRegistry();
    const catalog: StageScrollCatalog = {
      ...HORIZONTAL,
      hazards: [HORIZONTAL.hazards[0]!, HORIZONTAL.hazards[0]!],
    };
    const ctx = {
      events,
      capabilities,
      content: { data: { 'stage-scroll': { schemaId: 'x', valid: true, value: catalog } } },
    } as unknown as GameContext;
    expect(() => stageScrollPack.install(ctx, undefined)).toThrow(/rock-a/);
  });

  it('a missing content/stage-scroll.json yields an inert service, not an error', () => {
    const { stage } = install();
    expect(stage.active()).toBe(false);
    stage.tick(1000);
    expect(stage.offset()).toBe(0);
    expect(stage.outcome()).toBe('playing');
  });

  it('zero length is inert', () => {
    const { stage } = install({ ...HORIZONTAL, length: 0 });
    expect(stage.active()).toBe(false);
  });

  it('dt=0 does not advance the stage', () => {
    const { stage } = install(HORIZONTAL);
    stage.tick(0);
    expect(stage.offset()).toBe(0);
  });

  it('reset restores offset, player and outcome', () => {
    const { stage } = install(HORIZONTAL);
    stage.setMove(1, 1);
    stage.tick(5000);
    expect(stage.outcome()).toBe('complete');
    stage.reset();
    expect(stage.outcome()).toBe('playing');
    expect(stage.offset()).toBe(0);
    expect(stage.player()).toEqual({ x: 120, y: 270, radius: 16 });
    expect(stage.lastHit()).toBeNull();
  });
});
