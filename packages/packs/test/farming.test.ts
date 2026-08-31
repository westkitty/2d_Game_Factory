import { describe, expect, it } from 'vitest';
import type { FarmingService } from '@sw2d/contracts';
import { farmingPack } from '../src/farming/farmingPack.ts';
import { itemsPack } from '../src/items/itemsPack.ts';
import { createFakeGameContext } from './testSupport.ts';

const farming = { schemaVersion: 1 as const, daysPerSeason: 2, plots: ['a'], crops: [{ id: 'turnip', displayName: 'Turnip', seedItemId: 'turnip-seed', growthStages: [{ id: 'sprout', durationDays: 1 }, { id: 'ripe', durationDays: 1 }], validSeasons: ['spring'] as const, requiresWater: true, harvestItems: [{ itemId: 'turnip', quantity: 2 }], regrowStage: 1 }] };
function game() { const base = createFakeGameContext(); return { ...base, content: { ...base.content, data: { items: { schemaId: 'items', valid: true as const, value: { schemaVersion: 1, items: [{ id: 'turnip-seed', displayName: 'Seed', category: 'seed', stackable: true, consumable: true }, { id: 'turnip', displayName: 'Turnip', category: 'crop', stackable: true, consumable: false }] } }, farming: { schemaId: 'farming', valid: true as const, value: farming } } } }; }
describe('farming pack', () => {
  it('requires till, consumes a canonical seed, water, grows, harvests and regrows', () => {
    const context = game(); itemsPack.install(context, {}); farmingPack.install(context, undefined);
    const items = context.capabilities.require<any>('items.state'); const service = context.capabilities.require<FarmingService>('simulation.farming');
    items.grant('turnip-seed'); expect(service.plant('a', 'turnip')).toMatchObject({ ok: false, reason: 'wrong-phase' });
    expect(service.till('a').ok).toBe(true); expect(service.plant('a', 'turnip').ok).toBe(true); expect(items.count('turnip-seed')).toBe(0);
    service.advanceDays(2); expect(service.plots()[0]?.phase).toBe('planted');
    expect(service.water('a').ok).toBe(true); service.advanceDays(1); expect(service.water('a').ok).toBe(true); service.advanceDays(1);
    expect(service.plots()[0]?.phase).toBe('harvestable'); expect(service.harvest('a').ok).toBe(true); expect(items.count('turnip')).toBe(2); expect(service.plots()[0]?.phase).toBe('growing');
  });
  it('rejects an invalid season and rolls the simulation calendar', () => {
    const context = game(); itemsPack.install(context, {}); farmingPack.install(context, undefined); const items = context.capabilities.require<any>('items.state'); const service = context.capabilities.require<FarmingService>('simulation.farming');
    items.grant('turnip-seed'); service.advanceDays(2); expect(service.calendar()).toMatchObject({ season: 'summer', dayInSeason: 1 }); service.till('a'); expect(service.plant('a', 'turnip')).toMatchObject({ ok: false, reason: 'invalid-season' });
  });
});
