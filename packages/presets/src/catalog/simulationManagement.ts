import type { PresetDefinition } from '@sw2d/contracts';
import { PACK_IDS } from '@sw2d/packs/ids';
import { LIMITATIONS, VALIDATION_PROFILES, definePreset, pack } from '../shared.ts';

/**
 * Family G - Simulation / management (recipes 50-57).
 *
 * All eight use `ui-simulation` only - MASTER_PROJECT.md section 6's
 * default for the family, and no recipe here has a strong enough reason to
 * add `pointer` (confirm/cancel/navigate already covers menu-style item and
 * option selection honestly; a "tap an item" pointer claim would not add a
 * real capability over that).
 *
 * `sw2d.simulation` was, before this phase, the one pack with zero preset
 * consumers (Phase 7A/7B's own "Known failures/gaps" entries). Every recipe
 * here selects it because a resource ledger plus timed jobs is genuinely
 * what a management/sim loop is built from - not to manufacture coverage.
 * `simulationPack`'s own doc comment states its scope precisely: "a
 * deterministic resource ledger plus a timed-job primitive ... No farms,
 * shops, restaurants, colonies, needs AI or tycoon UI here" - i.e. it names
 * this family's recipes directly as what it is *not*, which is exactly why
 * every recipe below carries a real `knownLimitations` entry.
 *
 * `sw2d.ai` is deliberately never selected: MASTER_PROJECT.md section 9 is
 * explicit that AI must not be selected "merely to simulate customers/
 * animals if the current AI capability does not actually represent those
 * behaviors" - `aiPack`'s idle/patrol/chase/flee vocabulary does not
 * represent shop customers, farm animals or colonists, so none of these
 * eight recipes claims it.
 */
export const SIMULATION_MANAGEMENT_PRESETS: readonly PresetDefinition[] = [
  definePreset({
    id: 'idle-incremental',
    maturity: 'proof-validated',
    displayName: 'Idle Incremental',
    family: 'simulation-management',
    controllerFamilies: ['ui-simulation'],
    requiredSystemPacks: [pack(PACK_IDS.simulation), pack(PACK_IDS.progression)],
    optionalSystemPacks: [pack(PACK_IDS.arcade)],
    requiredContentRoles: ['tuning'],
    validationProfile: VALIDATION_PROFILES.simulationManagement,
    knownLimitations: [
      'The simulation/resource core exists, but full offline-progress/catch-up, prestige, and large economy balancing are not production systems.',
    ],
  }),

  definePreset({
    id: 'shopkeeper',
    displayName: 'Shopkeeper',
    family: 'simulation-management',
    controllerFamilies: ['ui-simulation'],
    requiredSystemPacks: [pack(PACK_IDS.simulation), pack(PACK_IDS.progression)],
    optionalSystemPacks: [pack(PACK_IDS.world)],
    requiredContentRoles: ['tuning'],
    validationProfile: VALIDATION_PROFILES.simulationManagement,
    knownLimitations: [LIMITATIONS.customerEconomy],
  }),

  definePreset({
    id: 'tycoon-lite',
    displayName: 'Tycoon Lite',
    family: 'simulation-management',
    controllerFamilies: ['ui-simulation'],
    requiredSystemPacks: [pack(PACK_IDS.simulation), pack(PACK_IDS.progression)],
    optionalSystemPacks: [pack(PACK_IDS.arcade)],
    requiredContentRoles: ['tuning'],
    validationProfile: VALIDATION_PROFILES.simulationManagement,
    knownLimitations: [LIMITATIONS.customerEconomy],
  }),

  definePreset({
    id: 'farming-lite',
    displayName: 'Farming Lite',
    family: 'simulation-management',
    controllerFamilies: ['ui-simulation'],
    requiredSystemPacks: [pack(PACK_IDS.simulation), pack(PACK_IDS.world)],
    optionalSystemPacks: [pack(PACK_IDS.progression)],
    requiredContentRoles: ['tuning'],
    validationProfile: VALIDATION_PROFILES.simulationManagement,
    knownLimitations: ['No reusable crop-growth/season/plot-interaction system exists.'],
  }),

  definePreset({
    id: 'pet-creature',
    displayName: 'Pet Creature',
    family: 'simulation-management',
    controllerFamilies: ['ui-simulation'],
    requiredSystemPacks: [pack(PACK_IDS.simulation), pack(PACK_IDS.progression)],
    optionalSystemPacks: [pack(PACK_IDS.world)],
    requiredContentRoles: ['tuning'],
    validationProfile: VALIDATION_PROFILES.simulationManagement,
    knownLimitations: [LIMITATIONS.creatureSimulation],
  }),

  definePreset({
    id: 'colony-lite',
    displayName: 'Colony Lite',
    family: 'simulation-management',
    controllerFamilies: ['ui-simulation'],
    requiredSystemPacks: [pack(PACK_IDS.simulation), pack(PACK_IDS.world)],
    optionalSystemPacks: [pack(PACK_IDS.progression), pack(PACK_IDS.navigation)],
    requiredContentRoles: ['tuning'],
    validationProfile: VALIDATION_PROFILES.simulationManagement,
    knownLimitations: [
      'Colonist pathfinding is reusable (sw2d.navigation, optional); needs, assignment AI, construction placement and colony simulation are not.',
    ],
  }),

  definePreset({
    id: 'restaurant',
    displayName: 'Restaurant',
    family: 'simulation-management',
    controllerFamilies: ['ui-simulation'],
    requiredSystemPacks: [pack(PACK_IDS.simulation), pack(PACK_IDS.progression)],
    optionalSystemPacks: [pack(PACK_IDS.arcade)],
    requiredContentRoles: ['tuning'],
    validationProfile: VALIDATION_PROFILES.simulationManagement,
    knownLimitations: [LIMITATIONS.customerEconomy],
  }),

  definePreset({
    id: 'aquarium-terrarium',
    displayName: 'Aquarium / Terrarium',
    family: 'simulation-management',
    controllerFamilies: ['ui-simulation'],
    requiredSystemPacks: [pack(PACK_IDS.simulation)],
    optionalSystemPacks: [pack(PACK_IDS.progression)],
    requiredContentRoles: ['tuning'],
    validationProfile: VALIDATION_PROFILES.simulationManagement,
    knownLimitations: [LIMITATIONS.creatureSimulation],
  }),
];
