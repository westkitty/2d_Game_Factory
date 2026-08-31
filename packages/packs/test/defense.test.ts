import { describe, expect, it } from 'vitest';
import type { DefenseDocument, DefenseService, TerritoryService } from '@sw2d/contracts';
import { defensePack, MissingDefenseNavigationError } from '../src/defense/defensePack.ts';
import { navigationPack } from '../src/navigation/navigationPack.ts';
import { createFakeGameContext } from './testSupport.ts';

const DOCUMENT: DefenseDocument = {
  schemaVersion: 1,
  startingFunds: 50,
  towers: [{ id: 'needle', cost: 10, range: 8, weaponId: 'needle-shot', targetPolicy: 'first-on-route', refundRatio: 0.5, upgrades: [{ id: 'scope', cost: 5, rangeMultiplier: 2 }] }],
  zones: [{ id: 'board', kind: 'buildable', x: 0, y: 0, width: 20, height: 20 }],
  bases: [{ id: 'gate', maxHealth: 10, breachDamage: 3 }],
  lanes: [{ id: 'lane', spawnX: 0, spawnY: 0, route: [{ x: 10, y: 0 }], objectiveId: 'gate' }],
  captureZones: [{ id: 'relay', shape: { kind: 'circle', x: 0, y: 0, radius: 5 }, captureMs: 1000, scorePerSecond: 2 }],
};

function context(document: DefenseDocument = DOCUMENT) {
  const base = createFakeGameContext();
  return { ...base, content: { ...base.content, data: { defense: { schemaId: 'defense', valid: true as const, value: document } } } };
}

describe('defense pack', () => {
  it('places, upgrades, targets, breaches and sells through one service', () => {
    const game = context();
    const installed = defensePack.install(game, {});
    const defense = game.capabilities.require<DefenseService>('strategy.defense');
    expect(defense.canPlace('needle', 10, 10)).toMatchObject({ ok: true, cost: 10 });
    const placed = defense.place('needle', 10, 10);
    expect(placed.ok).toBe(true);
    const id = placed.instanceId!;
    expect(defense.upgrade(id)).toEqual({ ok: true, tier: 1, cost: 5 });
    defense.setTargets([{ id: 'late', x: 12, y: 10, health: 2, maxHealth: 2, routeProgress: 2 }, { id: 'first', x: 12, y: 10, health: 2, maxHealth: 2, routeProgress: 4 }]);
    installed.update?.(16);
    expect(defense.tower(id)?.targetId).toBe('first');
    expect(defense.breach('lane')).toMatchObject({ health: 7, breaches: 1, destroyed: false });
    expect(defense.sell(id)).toMatchObject({ ok: true, refund: 7 });
  });

  it('freezes a contested zone and scores a held zone', () => {
    const game = context(); const installed = defensePack.install(game, {});
    const territory = game.capabilities.require<TerritoryService>('strategy.territory');
    territory.setOccupants([{ id: 'r', teamId: 'red', x: 0, y: 0 }, { id: 'b', teamId: 'blue', x: 0, y: 0 }]); installed.update?.(500);
    expect(territory.zone('relay')?.contested).toBe(true);
    territory.setOccupants([{ id: 'r', teamId: 'red', x: 0, y: 0 }]); installed.update?.(1000);
    expect(territory.zone('relay')?.owner).toBe('red');
    installed.update?.(500);
    expect(territory.score('red')).toBe(1);
  });

  it('rejects blocking towers without a real grid to check', () => {
    const game = context({ ...DOCUMENT, towers: [{ ...DOCUMENT.towers![0]!, blocking: true }], routes: [{ id: 'main', fromX: 0, fromY: 0, toX: 10, toY: 0 }] });
    expect(() => defensePack.install(game, {})).toThrow(MissingDefenseNavigationError);
    navigationPack.install(game, undefined);
    expect(() => defensePack.install(game, { navigationGrid: { id: 'main', spec: { cols: 4, rows: 1, cellSize: 5 } } })).not.toThrow();
  });
});
