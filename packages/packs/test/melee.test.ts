import { describe, expect, it } from 'vitest';
import { validateContentBundleData } from '@sw2d/schemas';
import type { GameContext, MeleeCatalog, MeleeService } from '@sw2d/contracts';
import { MELEE_CAPABILITY_ID } from '@sw2d/contracts';
import { CAPABILITY_IDS } from '../src/ids.ts';
import { combatPack } from '../src/combat/combatPack.ts';
import { meleePack } from '../src/melee/meleePack.ts';
import { FakeCapabilityRegistry, FakeEventBus } from './testSupport.ts';

const SKIRMISH: MeleeCatalog = {
  schemaVersion: 1,
  mode: 'skirmish',
  player: { id: 'player', x: 120, y: 270, radius: 16, health: 5 },
  foes: [{ id: 'foe-0', x: 470, y: 270, radius: 17, health: 3 }],
  strike: { range: 145, damage: 1, cooldownMs: 0, knockback: 8, stunMs: 80 },
  contact: { range: 34, damage: 1, cooldownMs: 650 },
};

const ARENA: MeleeCatalog = {
  schemaVersion: 1,
  mode: 'arena',
  player: { id: 'player', x: 120, y: 270, radius: 16, health: 5 },
  foes: [
    { id: 'foe-0', x: 420, y: 160, radius: 17, health: 2 },
    { id: 'foe-1', x: 560, y: 270, radius: 17, health: 2 },
    { id: 'foe-2', x: 420, y: 380, radius: 17, health: 2 },
  ],
  strike: { range: 145, damage: 1, cooldownMs: 0, knockback: 8, stunMs: 80 },
  contact: { range: 34, damage: 1, cooldownMs: 650 },
};

function install(catalog?: MeleeCatalog) {
  const events = new FakeEventBus();
  const capabilities = new FakeCapabilityRegistry();
  const ctx = {
    events,
    capabilities,
    content: catalog ? { data: { melee: { schemaId: 'x', valid: true, value: catalog } } } : { data: {} },
  } as unknown as GameContext;
  combatPack.install(ctx, undefined);
  const installed = meleePack.install(ctx, undefined);
  const table = capabilities.require<MeleeService>(MELEE_CAPABILITY_ID);
  return { events, capabilities, installed, table };
}

describe('sw2d.melee - ids', () => {
  it('the contracts-exported capability id matches the packs CAPABILITY_IDS entry', () => {
    expect(MELEE_CAPABILITY_ID).toBe(CAPABILITY_IDS.melee);
    expect(meleePack.provides).toEqual([MELEE_CAPABILITY_ID]);
    expect(meleePack.dependencies).toEqual([CAPABILITY_IDS.combat]);
  });
});

describe('sw2d.melee - schema', () => {
  it('accepts the two consumer catalogs', () => {
    expect(() => validateContentBundleData({ melee: SKIRMISH })).not.toThrow();
    expect(() => validateContentBundleData({ melee: ARENA })).not.toThrow();
  });

  it('rejects an unknown mode', () => {
    expect(() => validateContentBundleData({ melee: { ...SKIRMISH, mode: 'brawler' } })).toThrow();
  });
});

describe('sw2d.melee - skirmish', () => {
  it('a strike in range damages the nearest foe and knocks them back', () => {
    const { table } = install(SKIRMISH);
    table.setPlayer(350, 270);
    expect(table.strike(0)).toBe('hit');
    expect(table.lastResult()).toBe('hit');
    expect(table.foes()[0]!.health).toBe(2);
    expect(table.foes()[0]!.x).toBeGreaterThan(470);
    expect(table.foes()[0]!.stunnedUntilMs).toBe(80);
    expect(table.outcome()).toBe('playing');
  });

  it('three hits on the elite foe complete the skirmish', () => {
    const { table } = install(SKIRMISH);
    table.setPlayer(350, 270);
    table.strike(0);
    table.strike(20);
    table.strike(40);
    expect(table.foesAlive()).toBe(0);
    expect(table.outcome()).toBe('complete');
  });

  it('a strike out of range misses', () => {
    const { table } = install(SKIRMISH);
    table.setPlayer(120, 270);
    expect(table.strike(0)).toBe('miss');
    expect(table.foes()[0]!.health).toBe(3);
  });

  it('strike cooldown rejects a second swing', () => {
    const catalog: MeleeCatalog = {
      ...SKIRMISH,
      strike: { ...SKIRMISH.strike, cooldownMs: 200 },
    };
    const { table } = install(catalog);
    table.setPlayer(350, 270);
    expect(table.strike(0)).toBe('hit');
    expect(table.strike(50)).toBe('cooldown');
    expect(table.foes()[0]!.health).toBe(2);
  });
});

describe('sw2d.melee - arena', () => {
  it('clears three fodder foes independently', () => {
    const { table } = install(ARENA);
    table.setPlayer(330, 160);
    table.strike(0);
    table.strike(20);
    expect(table.foesAlive()).toBe(2);
    table.setPlayer(455, 270);
    table.strike(40);
    table.strike(60);
    expect(table.foesAlive()).toBe(1);
    table.setPlayer(330, 380);
    table.strike(80);
    table.strike(100);
    expect(table.foesAlive()).toBe(0);
    expect(table.outcome()).toBe('complete');
  });
});

describe('sw2d.melee - contact', () => {
  it('standing on a foe damages the player on the contact cadence', () => {
    const { table } = install({
      ...SKIRMISH,
      foes: [{ id: 'foe-0', x: 120, y: 270, radius: 17, health: 3 }],
    });
    table.setPlayer(120, 270);
    table.tick(16, 0);
    expect(table.playerHealth()).toBe(4);
    expect(table.lastResult()).toBe('contact');
    table.tick(16, 100);
    expect(table.playerHealth()).toBe(4);
    table.tick(16, 650);
    expect(table.playerHealth()).toBe(3);
  });

  it('five contacts fail the player', () => {
    const { table } = install({
      ...SKIRMISH,
      player: { ...SKIRMISH.player, health: 1 },
      foes: [{ id: 'foe-0', x: 120, y: 270, radius: 17, health: 3 }],
    });
    table.setPlayer(120, 270);
    table.tick(16, 0);
    expect(table.playerHealth()).toBe(0);
    expect(table.outcome()).toBe('failed');
  });
});

describe('sw2d.melee - lifecycle', () => {
  it('withdraws its capability on dispose', () => {
    const { capabilities, installed } = install(SKIRMISH);
    expect(capabilities.has(MELEE_CAPABILITY_ID)).toBe(true);
    installed.dispose();
    expect(capabilities.has(MELEE_CAPABILITY_ID)).toBe(false);
  });

  it('duplicate foe ids throw at install', () => {
    const events = new FakeEventBus();
    const capabilities = new FakeCapabilityRegistry();
    const catalog: MeleeCatalog = {
      ...SKIRMISH,
      foes: [SKIRMISH.foes[0]!, SKIRMISH.foes[0]!],
    };
    const ctx = {
      events,
      capabilities,
      content: { data: { melee: { schemaId: 'x', valid: true, value: catalog } } },
    } as unknown as GameContext;
    combatPack.install(ctx, undefined);
    expect(() => meleePack.install(ctx, undefined)).toThrow(/foe-0/);
  });

  it('a missing content/melee.json yields an inert service, not an error', () => {
    const { table } = install();
    expect(table.active()).toBe(false);
    table.tick(16, 0);
    expect(table.outcome()).toBe('playing');
  });

  it('an empty foe list is inert', () => {
    const { table } = install({ ...SKIRMISH, foes: [] });
    expect(table.active()).toBe(false);
  });

  it('reset restores foe health, positions and the fight', () => {
    const { table } = install(SKIRMISH);
    table.setPlayer(350, 270);
    table.strike(0);
    table.strike(20);
    table.strike(40);
    expect(table.outcome()).toBe('complete');
    table.reset();
    expect(table.outcome()).toBe('playing');
    expect(table.foesAlive()).toBe(1);
    expect(table.foes()[0]!.health).toBe(3);
    expect(table.foes()[0]!.x).toBe(470);
    expect(table.playerHealth()).toBe(5);
  });
});
