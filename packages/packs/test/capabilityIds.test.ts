import { describe, expect, it } from 'vitest';
import { CAPABILITY_IDS, PACK_IDS } from '../src/ids.ts';
import {
  itemsPack,
  weaponsPack,
  encountersPack,
  navigationPack,
  puzzleRulesPack,
  generationPack,
  worldGraphPack,
  vehiclesPack,
  racingPack,
  aiPack,
  arcadePack,
  combatPack,
  entityRegistryPack,
  narrativePack,
  progressionPack,
  puzzlePack,
  simulationPack,
  strategyPack,
  worldPack,
  aiPerceptionPack,
  climbingPack,
  runsPack,
  strategyActionsPack,
} from '../src/index.ts';

/**
 * Capability-id governance (ADR-0011).
 *
 * Capability ids are the one string every future preset, pack and generated
 * game agrees on. `resolveInstallOrder` already *detects* a collision at
 * install time and names the offending pack - this file exists to stop the
 * far cheaper class of problem: an id that claims a whole family namespace
 * (`combat`) for one service inside it (`combat.health`), leaving the fuller
 * family systems MASTER_PROJECT.md §9 describes with nowhere to publish.
 */

const ALL_PACKS = [
  combatPack,
  aiPack,
  worldPack,
  entityRegistryPack,
  progressionPack,
  arcadePack,
  puzzlePack,
  simulationPack,
  narrativePack,
  strategyPack,
  itemsPack,
  weaponsPack,
  encountersPack,
  navigationPack,
  puzzleRulesPack,
  generationPack,
  worldGraphPack,
  vehiclesPack,
  racingPack,
  aiPerceptionPack,
  climbingPack,
  runsPack,
  strategyActionsPack,
];

/** `<family>.<service>`: lowercase segments, at least two, dash-separated words allowed after the first. */
const CAPABILITY_ID_PATTERN = /^[a-z][a-z0-9]*(\.[a-z][a-z0-9-]*)+$/;

describe('capability id governance', () => {
  it('every capability id is namespaced <family>.<service>', () => {
    for (const id of Object.values(CAPABILITY_IDS)) {
      expect(id, `capability id "${id}"`).toMatch(CAPABILITY_ID_PATTERN);
    }
  });

  it('no capability id is a bare family name', () => {
    for (const id of Object.values(CAPABILITY_IDS)) {
      expect(id.includes('.'), `capability id "${id}" must not claim a whole family`).toBe(true);
    }
  });

  it('capability ids are unique across every family', () => {
    const ids = Object.values(CAPABILITY_IDS);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('pack ids are unique and vendor-prefixed', () => {
    const ids = Object.values(PACK_IDS);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id.startsWith('sw2d.')).toBe(true);
  });

  it('every pack provides exactly the capability id declared for it in ids.ts', () => {
    const declared = new Set<string>(Object.values(CAPABILITY_IDS));
    for (const pack of ALL_PACKS) {
      expect(pack.provides.length, `${pack.id} provides`).toBeGreaterThanOrEqual(1);
      for (const p of pack.provides) {
        expect(declared.has(p), `${pack.id} provides "${p}"`).toBe(true);
      }
    }
  });

  it('a pack id is never reused as a capability id', () => {
    const capabilityIds = new Set<string>(Object.values(CAPABILITY_IDS));
    for (const packId of Object.values(PACK_IDS)) {
      expect(capabilityIds.has(packId), `pack id "${packId}"`).toBe(false);
    }
  });
});
