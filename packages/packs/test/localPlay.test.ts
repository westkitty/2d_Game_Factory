import { describe, expect, it } from 'vitest';
import { validateContentBundleData } from '@sw2d/schemas';
import type { GameContext, LocalPlayCatalog, LocalPlayService } from '@sw2d/contracts';
import { LOCAL_PLAY_CAPABILITY_ID } from '@sw2d/contracts';
import { CAPABILITY_IDS } from '../src/ids.ts';
import { localPlayPack } from '../src/localPlay/localPlayPack.ts';
import { FakeCapabilityRegistry, FakeEventBus } from './testSupport.ts';

const HOTSEAT: LocalPlayCatalog = {
  schemaVersion: 1,
  mode: 'hotseat',
  players: [
    { id: 'p1', label: 'P1' },
    { id: 'p2', label: 'P2' },
  ],
  hotseat: { turns: 6, pointsCycle: [1, 2, 3] },
};

const VERSUS: LocalPlayCatalog = {
  schemaVersion: 1,
  mode: 'versus',
  players: [
    { id: 'p1', label: 'P1', negative: ['ArrowUp'], positive: ['ArrowDown'] },
    { id: 'p2', label: 'P2', negative: ['KeyW'], positive: ['KeyS'] },
  ],
};

function install(catalog?: LocalPlayCatalog) {
  const events = new FakeEventBus();
  const capabilities = new FakeCapabilityRegistry();
  const ctx = {
    events,
    capabilities,
    content: catalog ? { data: { 'local-play': { schemaId: 'x', valid: true, value: catalog } } } : { data: {} },
  } as unknown as GameContext;
  const installed = localPlayPack.install(ctx, undefined);
  const seats = capabilities.require<LocalPlayService>(LOCAL_PLAY_CAPABILITY_ID);
  return { events, capabilities, installed, seats };
}

describe('sw2d.local-play - ids', () => {
  it('the contracts-exported capability id matches the packs CAPABILITY_IDS entry', () => {
    expect(LOCAL_PLAY_CAPABILITY_ID).toBe(CAPABILITY_IDS.localPlay);
    expect(localPlayPack.provides).toEqual([LOCAL_PLAY_CAPABILITY_ID]);
    expect(localPlayPack.dependencies).toEqual([]);
  });
});

describe('sw2d.local-play - schema', () => {
  it('accepts the two consumer catalogs', () => {
    expect(() => validateContentBundleData({ 'local-play': HOTSEAT })).not.toThrow();
    expect(() => validateContentBundleData({ 'local-play': VERSUS })).not.toThrow();
  });

  it('rejects an unknown mode', () => {
    expect(() => validateContentBundleData({ 'local-play': { ...HOTSEAT, mode: 'online' } })).toThrow();
  });
});

describe('sw2d.local-play - hotseat', () => {
  it('six acts complete the contest with both seats scoring', () => {
    const { seats } = install(HOTSEAT);
    expect(seats.currentPlayer()).toBe(0);
    seats.act();
    expect(seats.currentPlayer()).toBe(1);
    expect(seats.scores()[0]).toBe(1);
    expect(seats.lastResult()).toBe('party-turn');
    for (let i = 0; i < 5; i++) seats.act();
    expect(seats.turns()).toBe(6);
    expect(seats.scores()[0]).toBeGreaterThan(0);
    expect(seats.scores()[1]).toBeGreaterThan(0);
    expect(seats.winner()).not.toBeNull();
    expect(seats.outcome()).toBe('complete');
  });

  it('a seventh act after complete is ignored', () => {
    const { seats } = install(HOTSEAT);
    for (let i = 0; i < 6; i++) seats.act();
    const scores = [...seats.scores()];
    seats.act();
    expect([...seats.scores()]).toEqual(scores);
    expect(seats.turns()).toBe(6);
  });

  it('ties award seat 0, matching the overlay pass-and-play loop', () => {
    const { seats } = install(HOTSEAT);
    for (let i = 0; i < 6; i++) seats.act();
    expect(seats.scores()[0]).toBe(6);
    expect(seats.scores()[1]).toBe(6);
    expect(seats.winner()).toBe(0);
  });
});

describe('sw2d.local-play - versus', () => {
  it('disjoint key clusters drive independent axes', () => {
    const { seats } = install(VERSUS);
    seats.setHeld(['ArrowDown']);
    expect(seats.axis(0)).toBe(1);
    expect(seats.axis(1)).toBe(0);
    seats.setHeld(['KeyW']);
    expect(seats.axis(0)).toBe(0);
    expect(seats.axis(1)).toBe(-1);
    seats.setHeld(['ArrowUp', 'KeyS']);
    expect(seats.axis(0)).toBe(-1);
    expect(seats.axis(1)).toBe(1);
  });

  it('versus act() does not invent hotseat scores', () => {
    const { seats } = install(VERSUS);
    seats.act();
    expect(seats.turns()).toBe(0);
    expect(seats.outcome()).toBe('playing');
    expect(seats.scores()).toEqual([0, 0]);
  });
});

describe('sw2d.local-play - lifecycle', () => {
  it('withdraws its capability on dispose', () => {
    const { capabilities, installed } = install(HOTSEAT);
    expect(capabilities.has(LOCAL_PLAY_CAPABILITY_ID)).toBe(true);
    installed.dispose();
    expect(capabilities.has(LOCAL_PLAY_CAPABILITY_ID)).toBe(false);
  });

  it('duplicate player ids throw at install', () => {
    const events = new FakeEventBus();
    const capabilities = new FakeCapabilityRegistry();
    const catalog: LocalPlayCatalog = {
      ...HOTSEAT,
      players: [HOTSEAT.players[0]!, HOTSEAT.players[0]!],
    };
    const ctx = {
      events,
      capabilities,
      content: { data: { 'local-play': { schemaId: 'x', valid: true, value: catalog } } },
    } as unknown as GameContext;
    expect(() => localPlayPack.install(ctx, undefined)).toThrow(/p1/);
  });

  it('a missing content/local-play.json yields an inert service, not an error', () => {
    const { seats } = install();
    expect(seats.active()).toBe(false);
    seats.act();
    expect(seats.outcome()).toBe('playing');
  });

  it('fewer than two players is inert', () => {
    const { seats } = install({ ...HOTSEAT, players: [HOTSEAT.players[0]!] });
    expect(seats.active()).toBe(false);
  });

  it('reset restores turns, scores and the active seat', () => {
    const { seats } = install(HOTSEAT);
    for (let i = 0; i < 6; i++) seats.act();
    expect(seats.outcome()).toBe('complete');
    seats.reset();
    expect(seats.outcome()).toBe('playing');
    expect(seats.turns()).toBe(0);
    expect(seats.currentPlayer()).toBe(0);
    expect(seats.winner()).toBeNull();
    expect(seats.scores()).toEqual([0, 0]);
  });
});
