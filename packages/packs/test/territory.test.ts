import { describe, expect, it } from 'vitest';
import { validateContentBundleData } from '@sw2d/schemas';
import type { GameContext, TerritoryCatalog, TerritoryService } from '@sw2d/contracts';
import { TERRITORY_CAPABILITY_ID } from '@sw2d/contracts';
import { CAPABILITY_IDS } from '../src/ids.ts';
import { territoryPack } from '../src/territory/territoryPack.ts';
import { FakeCapabilityRegistry, FakeEventBus } from './testSupport.ts';

const STAND: TerritoryCatalog = {
  schemaVersion: 1,
  mode: 'stand',
  zones: [
    { id: 'zone-a', x: 280, y: 270, radius: 72, holdMs: 400 },
    { id: 'zone-b', x: 700, y: 270, radius: 72, holdMs: 400 },
  ],
};

const OCCUPY: TerritoryCatalog = { ...STAND, mode: 'occupy' };

function install(catalog?: TerritoryCatalog) {
  const events = new FakeEventBus();
  const capabilities = new FakeCapabilityRegistry();
  const ctx = {
    events,
    capabilities,
    content: catalog ? { data: { territory: { schemaId: 'x', valid: true, value: catalog } } } : { data: {} },
  } as unknown as GameContext;
  const installed = territoryPack.install(ctx, undefined);
  const zones = capabilities.require<TerritoryService>(TERRITORY_CAPABILITY_ID);
  return { events, capabilities, installed, zones };
}

describe('sw2d.territory - ids', () => {
  it('the contracts-exported capability id matches the packs CAPABILITY_IDS entry', () => {
    expect(TERRITORY_CAPABILITY_ID).toBe(CAPABILITY_IDS.territory);
    expect(territoryPack.provides).toEqual([TERRITORY_CAPABILITY_ID]);
  });
});

describe('sw2d.territory - schema', () => {
  it('accepts the two consumer catalogs', () => {
    expect(() => validateContentBundleData({ territory: STAND })).not.toThrow();
    expect(() => validateContentBundleData({ territory: OCCUPY })).not.toThrow();
  });

  it('rejects an unknown mode', () => {
    expect(() => validateContentBundleData({ territory: { ...STAND, mode: 'paint' } })).toThrow();
  });
});

describe('sw2d.territory - occupy', () => {
  it('owning both zones completes', () => {
    const { zones } = install(OCCUPY);
    zones.setOccupant(280, 270);
    zones.tick(400);
    expect(zones.owned()).toEqual(['zone-a']);
    zones.setOccupant(700, 270);
    zones.tick(400);
    expect(zones.outcome()).toBe('complete');
    expect(zones.owned()).toEqual(['zone-a', 'zone-b']);
  });
});

describe('sw2d.territory - lifecycle', () => {
  it('a missing catalog is inert', () => {
    const { zones } = install();
    expect(zones.active()).toBe(false);
    zones.tick(1000);
    expect(zones.owned()).toEqual([]);
  });
});
