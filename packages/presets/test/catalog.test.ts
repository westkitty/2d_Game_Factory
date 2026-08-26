import { describe, expect, it } from 'vitest';
import { PRESETS, UnknownPresetError, getPreset, getPresetsByFamily, listPresets } from '../src/index.ts';

/**
 * Exact catalog shape (MASTER_PROJECT.md section 4 / this phase's own
 * acceptance contract): exactly 74 presets, these exact ids, these exact
 * family counts, deterministic order, no duplicates. A catalog that drifts
 * from this list - missing an id, gaining an extra one, duplicating one - is
 * exactly the failure this file exists to catch immediately.
 */

const PHASE_7A_IDS_IN_ORDER = [
  // Family A - Platforming (10)
  'traditional-platformer',
  'chase-platformer',
  'endless-runner',
  'precision-platformer',
  'metroidvania',
  'puzzle-platformer',
  'auto-runner',
  'climbing-game',
  'grappling-platformer',
  'collectathon-platformer',
  // Family B - Top-down action (10)
  'top-down-adventure',
  'action-adventure',
  'twin-stick-shooter',
  'survivor-like',
  'dungeon-crawler',
  'action-roguelite',
  'stealth-game',
  'heist-game',
  'arena-combat',
  'boss-rush',
  // Family C - Shooter (7)
  'horizontal-shmup',
  'vertical-shmup',
  'bullet-hell',
  'asteroids-shooter',
  'gallery-shooter',
  'run-and-gun',
  'rail-shooter',
];

const PHASE_7B_IDS_IN_ORDER = [
  // Family D - Vehicle / movement (5)
  'top-down-racer',
  'kart-racer',
  'time-trial-racer',
  'endless-driving',
  'boat-flight-racer',
  // Family E - Puzzle / arcade (10)
  'sokoban',
  'match-puzzle',
  'falling-block-puzzle',
  'breakout',
  'pong',
  'physics-puzzle',
  'maze-game',
  'rhythm-action',
  'reaction-timing',
  'pinball-lite',
  // Family F - Strategy / defense (7)
  'tower-defense',
  'lane-defense',
  'auto-battler',
  'simple-rts',
  'turn-based-tactics',
  'base-defense',
  'territory-control',
];

const PHASE_7C_IDS_IN_ORDER = [
  // Family G - Simulation / management (8)
  'idle-incremental',
  'shopkeeper',
  'tycoon-lite',
  'farming-lite',
  'pet-creature',
  'colony-lite',
  'restaurant',
  'aquarium-terrarium',
  // Family H - Narrative / exploration (7)
  'exploration-game',
  'visual-novel',
  'point-and-click',
  'interactive-fiction-hybrid',
  'investigation-game',
  'museum-exhibit',
  'escape-room',
  // Family I - Party / toy / weird (10)
  'microgame-collection',
  'local-party-game',
  'physics-toy',
  'virtual-pet',
  'dress-up-character-toy',
  'sandbox-playground',
  'drawing-game',
  'fishing-game',
  'cooking-game',
  'photography-game',
];

const PHASE_7A_AND_7B_IDS_IN_ORDER = [...PHASE_7A_IDS_IN_ORDER, ...PHASE_7B_IDS_IN_ORDER];
const REQUIRED_IDS_IN_ORDER = [...PHASE_7A_AND_7B_IDS_IN_ORDER, ...PHASE_7C_IDS_IN_ORDER];

describe('preset catalog shape', () => {
  it('contains exactly 74 presets', () => {
    expect(PRESETS.length).toBe(74);
  });

  it('contains exactly the required 74 ids, in this exact order', () => {
    expect(PRESETS.map((preset) => preset.id)).toEqual(REQUIRED_IDS_IN_ORDER);
  });

  it('preserves all 27 Phase 7A ids as the first 27 entries, untouched', () => {
    expect(PRESETS.slice(0, 27).map((preset) => preset.id)).toEqual(PHASE_7A_IDS_IN_ORDER);
  });

  it('preserves all 49 Phase 7A+7B ids as the first 49 entries, untouched', () => {
    expect(PRESETS.slice(0, 49).map((preset) => preset.id)).toEqual(PHASE_7A_AND_7B_IDS_IN_ORDER);
  });

  it('appends exactly 25 new Phase 7C ids after the Phase 7A+7B 49', () => {
    expect(PRESETS.slice(49).map((preset) => preset.id)).toEqual(PHASE_7C_IDS_IN_ORDER);
    expect(PHASE_7C_IDS_IN_ORDER.length).toBe(25);
  });

  it('has no duplicate ids', () => {
    const ids = PRESETS.map((preset) => preset.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('family counts are exactly 10 / 10 / 7 / 5 / 10 / 7 / 8 / 7 / 10', () => {
    const counts = PRESETS.reduce<Record<string, number>>((acc, preset) => {
      acc[preset.family] = (acc[preset.family] ?? 0) + 1;
      return acc;
    }, {});
    expect(counts).toEqual({
      platforming: 10,
      'top-down-action': 10,
      shooter: 7,
      'vehicle-movement': 5,
      'puzzle-arcade': 10,
      'strategy-defense': 7,
      'simulation-management': 8,
      'narrative-exploration': 7,
      'party-toy-weird': 10,
    });
  });

  it('has exactly nine families', () => {
    const families = new Set(PRESETS.map((preset) => preset.family));
    expect(families.size).toBe(9);
  });

  it('listPresets() returns the same deterministic order on every call', () => {
    expect(listPresets().map((p) => p.id)).toEqual(listPresets().map((p) => p.id));
    expect(listPresets()).toBe(listPresets()); // same frozen array reference, not a fresh copy
  });

  it('the exported PRESETS array is frozen', () => {
    expect(Object.isFrozen(PRESETS)).toBe(true);
  });
});

describe('getPreset', () => {
  it('returns the exact preset for a known id', () => {
    expect(getPreset('metroidvania').displayName).toBe('Metroidvania');
  });

  it('throws UnknownPresetError, naming known ids, for an unknown id', () => {
    expect(() => getPreset('does-not-exist')).toThrow(UnknownPresetError);
    expect(() => getPreset('does-not-exist')).toThrow(/traditional-platformer/);
  });
});

describe('getPresetsByFamily', () => {
  it('filters to exactly the presets in one family, in catalog order', () => {
    const shooters = getPresetsByFamily('shooter');
    expect(shooters.map((p) => p.id)).toEqual([
      'horizontal-shmup',
      'vertical-shmup',
      'bullet-hell',
      'asteroids-shooter',
      'gallery-shooter',
      'run-and-gun',
      'rail-shooter',
    ]);
  });

  it('returns an empty array, not an error, for an unknown family', () => {
    expect(getPresetsByFamily('not-a-real-family')).toEqual([]);
  });

  it('filters a Phase 7B family too, in catalog order', () => {
    expect(getPresetsByFamily('vehicle-movement').map((p) => p.id)).toEqual([
      'top-down-racer',
      'kart-racer',
      'time-trial-racer',
      'endless-driving',
      'boat-flight-racer',
    ]);
  });

  it('filters a Phase 7C family too, in catalog order', () => {
    expect(getPresetsByFamily('simulation-management').map((p) => p.id)).toEqual([
      'idle-incremental',
      'shopkeeper',
      'tycoon-lite',
      'farming-lite',
      'pet-creature',
      'colony-lite',
      'restaurant',
      'aquarium-terrarium',
    ]);
  });
});
