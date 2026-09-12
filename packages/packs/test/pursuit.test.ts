import { describe, expect, it } from 'vitest';
import { validateContentBundleData } from '@sw2d/schemas';
import type { GameContext, PursuitCatalog, PursuitService } from '@sw2d/contracts';
import { PURSUIT_CAPABILITY_ID } from '@sw2d/contracts';
import { CAPABILITY_IDS } from '../src/ids.ts';
import { pursuitPack } from '../src/pursuit/pursuitPack.ts';
import { FakeCapabilityRegistry, FakeEventBus } from './testSupport.ts';

const WALL: PursuitCatalog = {
  schemaVersion: 1,
  mode: 'wall',
  startX: -40,
  speed: 72,
  catchDistance: 16,
  escapeX: 820,
  maxGap: 0,
  closeSpeed: 0,
  recoverSpeed: 0,
  stumbleMs: 0,
  failY: 520,
};

const CHASER: PursuitCatalog = {
  schemaVersion: 1,
  mode: 'chaser',
  startX: 100,
  speed: 0,
  catchDistance: 24,
  escapeX: null,
  maxGap: 150,
  closeSpeed: 140,
  recoverSpeed: 40,
  stumbleMs: 520,
  failY: 510,
};

function install(catalog?: PursuitCatalog) {
  const events = new FakeEventBus();
  const capabilities = new FakeCapabilityRegistry();
  const ctx = {
    events,
    capabilities,
    content: catalog ? { data: { pursuit: { schemaId: 'x', valid: true, value: catalog } } } : { data: {} },
  } as unknown as GameContext;
  const installed = pursuitPack.install(ctx, undefined);
  const pursuit = capabilities.require<PursuitService>(PURSUIT_CAPABILITY_ID);
  return { events, capabilities, installed, pursuit };
}

describe('sw2d.pursuit - ids and schema', () => {
  it('the contracts-exported capability id matches the packs CAPABILITY_IDS entry', () => {
    expect(PURSUIT_CAPABILITY_ID).toBe(CAPABILITY_IDS.pursuit);
    expect(pursuitPack.provides).toEqual([PURSUIT_CAPABILITY_ID]);
    expect(pursuitPack.dependencies).toEqual([]);
  });

  it('both catalogs validate as content/pursuit.json', () => {
    expect(() => validateContentBundleData({ pursuit: WALL })).not.toThrow();
    expect(() => validateContentBundleData({ pursuit: CHASER })).not.toThrow();
    expect(() => validateContentBundleData({ pursuit: { ...WALL, mode: 'drone' } })).toThrow();
  });

  it('is inert without a catalog and withdraws the capability on dispose', () => {
    const { pursuit, installed, capabilities } = install();
    expect(pursuit.active()).toBe(false);
    pursuit.tick(1000);
    expect(pursuit.outcome()).toBe('playing');
    installed.dispose();
    expect(capabilities.has(PURSUIT_CAPABILITY_ID)).toBe(false);
  });
});

describe('sw2d.pursuit - wall mode', () => {
  it('advances at the catalog speed and catches a standing player', () => {
    const { pursuit, events } = install(WALL);
    const caught: string[] = [];
    events.on('pursuit:caught', (p) => caught.push(p.reason));
    pursuit.setPlayer(100, 458, true);
    pursuit.tick(1000);
    expect(pursuit.pursuerX()).toBeCloseTo(32);
    expect(pursuit.gap()).toBeCloseTo(68);
    pursuit.tick(1000);
    expect(pursuit.outcome()).toBe('failed');
    expect(pursuit.lastResult()).toBe('caught');
    expect(caught).toEqual(['caught']);
  });

  it('escapes when the player reaches the escape line on the ground, not in the air', () => {
    const { pursuit, events } = install(WALL);
    const escaped: string[] = [];
    events.on('pursuit:escaped', (p) => escaped.push(p.mode));
    pursuit.setPlayer(830, 400, false);
    pursuit.tick(16);
    expect(pursuit.outcome()).toBe('playing');
    pursuit.setPlayer(830, 458, true);
    pursuit.tick(16);
    expect(pursuit.outcome()).toBe('complete');
    expect(pursuit.lastResult()).toBe('escaped');
    expect(escaped).toEqual(['wall']);
  });

  it('fails when the player falls below failY, and reset restores the start', () => {
    const { pursuit } = install(WALL);
    pursuit.setPlayer(300, 560, false);
    pursuit.tick(16);
    expect(pursuit.outcome()).toBe('failed');
    expect(pursuit.lastResult()).toBe('fell');
    pursuit.reset();
    expect(pursuit.outcome()).toBe('playing');
    expect(pursuit.pursuerX()).toBe(-40);
    expect(pursuit.lastResult()).toBeNull();
  });
});

describe('sw2d.pursuit - chaser mode', () => {
  it('trails at the max gap while the player runs cleanly', () => {
    const { pursuit } = install(CHASER);
    pursuit.setPlayer(400, 458, true);
    pursuit.tick(500);
    expect(pursuit.gap()).toBe(150);
    expect(pursuit.pursuerX()).toBe(250);
    expect(pursuit.outcome()).toBe('playing');
  });

  it('closes the gap while stumbling and recovers afterwards', () => {
    const { pursuit, events } = install(CHASER);
    const stumbled: number[] = [];
    events.on('pursuit:stumbled', (p) => stumbled.push(p.stumbles));
    pursuit.setPlayer(400, 458, true);
    pursuit.stumble();
    expect(pursuit.stumbling()).toBe(true);
    expect(pursuit.stumbleMsLeft()).toBe(520);
    pursuit.tick(520);
    expect(pursuit.stumbling()).toBe(false);
    expect(pursuit.gap()).toBeCloseTo(150 - 140 * 0.52, 5);
    expect(pursuit.outcome()).toBe('playing');
    expect(stumbled).toEqual([1]);
    pursuit.tick(1000);
    expect(pursuit.gap()).toBeCloseTo(150 - 140 * 0.52 + 40, 5);
  });

  it('two stumbles back to back let the chaser catch the runner', () => {
    const { pursuit } = install(CHASER);
    pursuit.setPlayer(400, 458, true);
    pursuit.stumble();
    pursuit.tick(520);
    pursuit.stumble();
    pursuit.tick(520);
    expect(pursuit.stumbles()).toBe(2);
    expect(pursuit.outcome()).toBe('failed');
    expect(pursuit.lastResult()).toBe('caught');
  });

  it('a stumble while already stumbling extends, never shortens, the trip', () => {
    const { pursuit } = install(CHASER);
    pursuit.setPlayer(400, 458, true);
    pursuit.stumble(1000);
    pursuit.tick(200);
    pursuit.stumble(100);
    expect(pursuit.stumbleMsLeft()).toBe(800);
  });

  it('endless (escapeX null) never completes by position; a course escapeX does', () => {
    const { pursuit } = install(CHASER);
    pursuit.setPlayer(5000, 458, true);
    pursuit.tick(16);
    expect(pursuit.outcome()).toBe('playing');
    const course = install({ ...CHASER, escapeX: 820 }).pursuit;
    course.setPlayer(830, 458, true);
    course.tick(16);
    expect(course.outcome()).toBe('complete');
  });

  it('ignores stumble and input once the run has ended', () => {
    const { pursuit } = install(CHASER);
    pursuit.setPlayer(300, 600, false);
    pursuit.tick(16);
    expect(pursuit.outcome()).toBe('failed');
    pursuit.stumble();
    expect(pursuit.stumbles()).toBe(0);
  });
});
