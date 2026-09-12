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

describe('sw2d.melee - combos, facing arc, pursuit, hit-stun (Final Product Completion Wave 2)', () => {
  const { combo: _unusedCombo, ...SKIRMISH_NO_COMBO } = { ...SKIRMISH, combo: undefined };
  void _unusedCombo;
  const NO_COMBO: MeleeCatalog = { ...SKIRMISH_NO_COMBO, arcDeg: 120, contact: { range: 34, damage: 1, cooldownMs: 650, stunMs: 240 } };
  const COMBO: MeleeCatalog = {
    ...SKIRMISH,
    foes: [{ id: 'foe-0', x: 200, y: 270, radius: 17, health: 9, speed: 55 }],
    strike: { range: 145, damage: 1, cooldownMs: 0, knockback: 0, stunMs: 0 },
    contact: { range: 34, damage: 1, cooldownMs: 650, stunMs: 240 },
    combo: {
      steps: [
        { damage: 1, knockback: 0, stunMs: 0 },
        { damage: 1, knockback: 0, stunMs: 0 },
        { damage: 3, knockback: 0, stunMs: 0 },
      ],
      windowMs: 700,
    },
    arcDeg: 120,
  };

  it('validates the combo / arc / speed / stun fields and rejects an out-of-range arc', () => {
    expect(() => validateContentBundleData({ melee: COMBO })).not.toThrow();
    expect(() => validateContentBundleData({ melee: { ...COMBO, arcDeg: 400 } })).toThrow();
    expect(() => validateContentBundleData({ melee: { ...COMBO, combo: { steps: [], windowMs: 1 } } })).toThrow();
  });

  it('chains three hits inside the window with per-step damage, then wraps to the opener', () => {
    const { table, events } = install(COMBO);
    const steps: number[] = [];
    events.on('melee:combo', (p) => steps.push(p.step));
    table.setFacing(1, 0);
    expect(table.comboStep()).toBe(0);
    expect(table.strike(0)).toBe('hit');
    expect(table.comboStep()).toBe(1);
    expect(table.lastResult()).toBe('hit-1');
    expect(table.foes()[0]!.health).toBe(8);
    expect(table.strike(300)).toBe('hit');
    expect(table.comboStep()).toBe(2);
    expect(table.comboWindowLeftMs(400)).toBe(600);
    expect(table.strike(600)).toBe('hit');
    expect(table.comboStep()).toBe(3);
    expect(table.foes()[0]!.health).toBe(4);
    expect(table.bestCombo()).toBe(3);
    expect(table.strike(900)).toBe('hit');
    expect(table.comboStep()).toBe(1);
    expect(steps).toEqual([1, 2, 3, 1]);
  });

  it('the window closing resets the chain (on tick and on the next strike)', () => {
    const { table, events } = install(COMBO);
    const resets: string[] = [];
    events.on('melee:comboReset', (p) => resets.push(p.reason));
    table.setFacing(1, 0);
    table.strike(0);
    table.tick(16, 800);
    expect(table.comboStep()).toBe(0);
    expect(resets).toEqual(['window']);
    table.strike(1000);
    expect(table.comboStep()).toBe(1);
    table.strike(2000);
    expect(table.comboStep()).toBe(1);
    expect(resets).toEqual(['window', 'window']);
  });

  it('a whiff resets the chain', () => {
    const { table, events } = install(COMBO);
    const resets: string[] = [];
    events.on('melee:comboReset', (p) => resets.push(p.reason));
    table.setFacing(1, 0);
    table.strike(0);
    table.setFacing(-1, 0);
    expect(table.strike(100)).toBe('miss');
    expect(table.comboStep()).toBe(0);
    expect(resets).toEqual(['whiff']);
  });

  it('directional attacks: a foe outside the facing arc is not a target', () => {
    const { table } = install(COMBO);
    table.setFacing(1, 0);
    expect(table.target()?.id).toBe('foe-0');
    table.setFacing(0, 1);
    expect(table.target()).toBeNull();
    expect(table.strike(0)).toBe('miss');
    table.setFacing(-1, 0);
    expect(table.target()).toBeNull();
    // facing within 60 degrees of the foe still reaches it
    table.setFacing(1, 0.9);
    expect(table.target()?.id).toBe('foe-0');
    expect(table.arcDeg()).toBe(120);
  });

  it('foes with a speed pursue the player and stop at contact range; stunned foes do not move', () => {
    const { table } = install({ ...COMBO, foes: [{ id: 'foe-0', x: 400, y: 270, radius: 17, health: 9, speed: 100 }] });
    table.tick(1000, 1000);
    expect(table.foes()[0]!.x).toBeCloseTo(300, 5);
    table.tick(5000, 6000);
    expect(table.foes()[0]!.x).toBeCloseTo(120 + 34 * 0.8, 5);
    const stunned = install({ ...NO_COMBO, foes: [{ id: 'foe-0', x: 200, y: 270, radius: 17, health: 9, speed: 100 }], strike: { ...COMBO.strike, stunMs: 500 } }).table;
    stunned.setFacing(1, 0);
    stunned.strike(0);
    const afterHit = stunned.foes()[0]!.x;
    stunned.tick(200, 200);
    expect(stunned.foes()[0]!.x).toBeCloseTo(afterHit, 5);
    stunned.tick(400, 600);
    expect(stunned.foes()[0]!.x).toBeLessThan(afterHit);
  });

  it('a contact hit stuns the player (no strikes) and resets the chain; a stunned foe cannot deal contact', () => {
    const { table, events } = install({ ...COMBO, foes: [{ id: 'foe-0', x: 140, y: 270, radius: 17, health: 9 }] });
    const resets: string[] = [];
    events.on('melee:comboReset', (p) => resets.push(p.reason));
    table.setFacing(1, 0);
    table.strike(0);
    expect(table.comboStep()).toBe(1);
    table.tick(16, 16);
    expect(table.playerHealth()).toBe(4);
    expect(table.playerStunned(100)).toBe(true);
    expect(table.strike(100)).toBe('stunned');
    expect(table.comboStep()).toBe(0);
    expect(resets).toEqual(['hit']);
    expect(table.playerStunned(300)).toBe(false);
    // Stun the foe: contact is suspended while it is stunned.
    const guarded = install({ ...NO_COMBO, foes: [{ id: 'foe-0', x: 140, y: 270, radius: 17, health: 9 }], strike: { ...COMBO.strike, stunMs: 1000 } }).table;
    guarded.setFacing(1, 0);
    guarded.strike(0);
    guarded.tick(16, 16);
    expect(guarded.playerHealth()).toBe(5);
    guarded.tick(16, 1100);
    expect(guarded.playerHealth()).toBe(4);
  });

  it('reset() clears facing, chain, best combo and player stun', () => {
    const { table } = install(COMBO);
    table.setFacing(0, 1);
    table.setFacing(1, 0);
    table.strike(0);
    table.reset();
    expect(table.comboStep()).toBe(0);
    expect(table.bestCombo()).toBe(0);
    expect(table.facing()).toEqual({ x: 1, y: 0 });
    expect(table.playerStunned(0)).toBe(false);
  });
});
