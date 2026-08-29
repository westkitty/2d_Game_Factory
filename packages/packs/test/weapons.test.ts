import { describe, expect, it } from 'vitest';
import { validateContentBundleData } from '@sw2d/schemas';
import { WEAPONS_CAPABILITY_ID, type FireRequest, type GameContext, type WeaponCatalog, type WeaponsService } from '@sw2d/contracts';
import { CAPABILITY_IDS } from '../src/ids.ts';
import { UnknownWeaponError, weaponsPack } from '../src/weapons/weaponsPack.ts';
import { combatPack } from '../src/combat/combatPack.ts';
import { FakeCapabilityRegistry, FakeEventBus } from './testSupport.ts';

const CATALOG: WeaponCatalog = {
  schemaVersion: 1,
  weapons: [
    { id: 'pistol', displayName: 'Pistol', team: 'player', cooldownMs: 200, fireMode: 'single', projectile: { speed: 400, lifetimeMs: 1000, damage: 10 } },
    { id: 'smg', displayName: 'SMG', team: 'player', cooldownMs: 100, fireMode: 'auto', magazine: 3, reloadMs: 500, projectile: { speed: 500, lifetimeMs: 800, damage: 4 } },
    { id: 'shotgun', displayName: 'Shotgun', team: 'player', cooldownMs: 400, fireMode: 'single', pelletCount: 5, spreadDeg: 40, muzzleOffset: 10, projectile: { speed: 300, lifetimeMs: 600, damage: 3, pierce: 1 } },
    { id: 'burster', displayName: 'Burster', team: 'player', cooldownMs: 600, fireMode: 'burst', burstCount: 3, burstDelayMs: 50, projectile: { speed: 350, lifetimeMs: 900, damage: 6 } },
  ],
};

function makeService(catalog: WeaponCatalog | undefined = CATALOG): WeaponsService {
  const events = new FakeEventBus();
  const capabilities = new FakeCapabilityRegistry();
  const ctx = { events, capabilities, content: { data: catalog ? { weapons: { schemaId: 'x', valid: true, value: catalog } } : {} } } as unknown as GameContext;
  combatPack.install(ctx, undefined);
  weaponsPack.install(ctx, undefined);
  return capabilities.require<WeaponsService>(WEAPONS_CAPABILITY_ID);
}

const req = (over: Partial<FireRequest> = {}): FireRequest => ({ ownerId: 'p', originX: 0, originY: 0, dirX: 1, dirY: 0, nowMs: 0, ...over });

describe('sw2d.weapons - ids & schema', () => {
  it('capability id is combat.weapons and matches CAPABILITY_IDS', () => {
    expect(WEAPONS_CAPABILITY_ID).toBe(CAPABILITY_IDS.weapons);
    expect(weaponsPack.provides).toEqual([CAPABILITY_IDS.weapons]);
    expect(weaponsPack.dependencies).toEqual([CAPABILITY_IDS.combat]);
  });

  it('validates a weapon catalog, including on-hit effects reused from the item schema', () => {
    const withEffects: WeaponCatalog = {
      schemaVersion: 1,
      weapons: [{ id: 'w', displayName: 'W', team: 'player', cooldownMs: 100, fireMode: 'single', projectile: { speed: 100, lifetimeMs: 100, damage: 1, onHitEffects: [{ kind: 'arcade.score', amount: 5 }] } }],
    };
    expect(() => validateContentBundleData({ weapons: withEffects })).not.toThrow();
  });

  it('rejects an unknown fire mode', () => {
    const bad = { schemaVersion: 1, weapons: [{ id: 'w', displayName: 'W', team: 'p', cooldownMs: 1, fireMode: 'railgun', projectile: { speed: 1, lifetimeMs: 1, damage: 1 } }] };
    expect(() => validateContentBundleData({ weapons: bad })).toThrow();
  });
});

describe('sw2d.weapons - firing', () => {
  it('equip then single fire produces one spawn and sets the cooldown', () => {
    const w = makeService();
    expect(() => w.equip('p', 'nope')).toThrow(UnknownWeaponError);
    w.equip('p', 'pistol');
    const r = w.tryFire(req());
    expect(r.fired).toBe(true);
    expect(r.spawns).toHaveLength(1);
    expect(r.spawns[0]).toMatchObject({ vx: 400, vy: 0, damage: 10, team: 'player', ownerId: 'p', pierce: 0 });
    expect(w.ownerState('p').cooldownRemainingMs).toBe(200);
  });

  it('a second fire during cooldown is blocked; it clears after update(cooldownMs)', () => {
    const w = makeService();
    w.equip('p', 'pistol');
    w.tryFire(req());
    expect(w.tryFire(req({ nowMs: 50 })).blockedBy).toBe('cooldown');
    w.update(200);
    expect(w.tryFire(req({ nowMs: 200 })).fired).toBe(true);
  });

  it('a shotgun fires an even, symmetric pellet fan and honours muzzleOffset + pierce', () => {
    const w = makeService();
    w.equip('p', 'shotgun');
    const r = w.tryFire(req());
    expect(r.spawns).toHaveLength(5);
    expect(r.spawns[0]!.x).toBeCloseTo(10, 6); // muzzleOffset along +x
    for (const s of r.spawns) expect(s.pierce).toBe(1);
    // Middle pellet dead ahead; outer pellets mirror each other.
    expect(r.spawns[2]!.vy).toBeCloseTo(0, 6);
    expect(r.spawns[0]!.vy).toBeCloseTo(-r.spawns[4]!.vy, 6);
  });

  it('burst emits one shot now and the rest on update(), at the configured delay', () => {
    const w = makeService();
    w.equip('p', 'burster');
    const first = w.tryFire(req());
    expect(first.spawns).toHaveLength(1);
    expect(w.update(49)).toHaveLength(0); // not due yet
    expect(w.update(1)).toHaveLength(1); // shot 2 at 50ms
    expect(w.update(50)).toHaveLength(1); // shot 3 at 100ms
    expect(w.update(50)).toHaveLength(0); // queue drained
  });

  it('drainPendingSpawns returns and clears buffered burst shots exactly once', () => {
    const w = makeService();
    w.equip('p', 'burster');
    w.tryFire(req());
    w.update(60);
    expect(w.drainPendingSpawns()).toHaveLength(1);
    expect(w.drainPendingSpawns()).toHaveLength(0);
  });

  it('ammo depletes, blocks at zero, and refills on a timed reload', () => {
    const w = makeService();
    w.equip('p', 'smg');
    expect(w.ownerState('p').ammo).toBe(3);
    w.tryFire(req()); w.update(100);
    w.tryFire(req({ nowMs: 100 })); w.update(100);
    w.tryFire(req({ nowMs: 200 })); w.update(100);
    expect(w.ownerState('p').ammo).toBe(0);
    expect(w.tryFire(req({ nowMs: 300 })).blockedBy).toBe('no-ammo');
    w.reload('p', 300);
    expect(w.ownerState('p').reloading).toBe(true);
    w.update(499);
    expect(w.ownerState('p').ammo).toBe(0);
    w.update(1);
    expect(w.ownerState('p').ammo).toBe(3);
  });

  it('an unequipped owner cannot fire', () => {
    const w = makeService();
    expect(w.tryFire(req()).blockedBy).toBe('no-weapon');
    w.equip('p', 'pistol');
    w.unequip('p');
    expect(w.tryFire(req()).blockedBy).toBe('no-weapon');
  });

  it('is deterministic: identical requests and prior state produce identical spawns', () => {
    const a = makeService();
    const b = makeService();
    a.equip('p', 'shotgun');
    b.equip('p', 'shotgun');
    expect(a.tryFire(req({ dirX: 0.5, dirY: 0.5 }))).toEqual(b.tryFire(req({ dirX: 0.5, dirY: 0.5 })));
  });
});
