import type { PresetDefinition } from '@sw2d/contracts';
import { PACK_IDS } from '@sw2d/packs/ids';
import { LIMITATIONS, VALIDATION_PROFILES, definePreset, pack } from '../shared.ts';

/**
 * Family B - Top-down action (recipes 11-20).
 *
 * All ten use the `top-down` controller family. None claims `pointer` as a
 * controller family: none of these recipes has spatial/analog aim as a
 * proven capability today (`pointerActionController` is press-style only -
 * see `docs/architecture/ARCHITECTURE_OVERVIEW.md`'s "Honest pointer
 * support"), so `twin-stick-shooter` in particular states that gap in
 * `knownLimitations` rather than implying it through a controller claim.
 *
 * `aiPack` depends on `combat.health` (its only real cross-pack dependency -
 * see `packages/packs/src/ai/aiPack.ts`). Every recipe below that selects
 * `sw2d.ai` anywhere also selects `sw2d.combat` as *required*, so the
 * selection always resolves through `resolveInstallOrder` regardless of
 * which packs a generated game actually chooses to install from the
 * optional list.
 */
export const TOP_DOWN_ACTION_PRESETS: readonly PresetDefinition[] = [
  definePreset({
    id: 'top-down-adventure',
    displayName: 'Top-Down Adventure',
    family: 'top-down-action',
    controllerFamilies: ['top-down'],
    requiredSystemPacks: [pack(PACK_IDS.world), pack(PACK_IDS.worldEntities)],
    optionalSystemPacks: [pack(PACK_IDS.narrative), pack(PACK_IDS.progression)],
    requiredContentRoles: ['tuning', 'levels'],
    validationProfile: VALIDATION_PROFILES.topDown,
  }),

  definePreset({
    id: 'action-adventure',
    displayName: 'Action Adventure',
    family: 'top-down-action',
    controllerFamilies: ['top-down'],
    requiredSystemPacks: [pack(PACK_IDS.world), pack(PACK_IDS.worldEntities), pack(PACK_IDS.combat)],
    optionalSystemPacks: [pack(PACK_IDS.ai), pack(PACK_IDS.progression)],
    requiredContentRoles: ['tuning', 'levels'],
    validationProfile: VALIDATION_PROFILES.topDown,
    knownLimitations: [LIMITATIONS.weaponsProjectiles],
  }),

  definePreset({
    id: 'twin-stick-shooter',
    maturity: 'smoke-validated',
    displayName: 'Twin-Stick Shooter',
    family: 'top-down-action',
    controllerFamilies: ['top-down'],
    requiredSystemPacks: [pack(PACK_IDS.combat)],
    optionalSystemPacks: [pack(PACK_IDS.world), pack(PACK_IDS.worldEntities), pack(PACK_IDS.arcade)],
    requiredContentRoles: ['tuning', 'levels'],
    validationProfile: VALIDATION_PROFILES.topDown,
    knownLimitations: [LIMITATIONS.spatialAim, LIMITATIONS.weaponsProjectiles],
  }),

  definePreset({
    id: 'survivor-like',
    displayName: 'Survivor-Like',
    family: 'top-down-action',
    controllerFamilies: ['top-down'],
    requiredSystemPacks: [pack(PACK_IDS.combat), pack(PACK_IDS.ai), pack(PACK_IDS.progression)],
    optionalSystemPacks: [pack(PACK_IDS.arcade), pack(PACK_IDS.world)],
    requiredContentRoles: ['tuning'],
    validationProfile: VALIDATION_PROFILES.topDown,
    knownLimitations: [LIMITATIONS.weaponsProjectiles, 'Wave-spawning orchestration is not yet a reusable capability.'],
  }),

  definePreset({
    id: 'dungeon-crawler',
    displayName: 'Dungeon Crawler',
    family: 'top-down-action',
    controllerFamilies: ['top-down'],
    requiredSystemPacks: [pack(PACK_IDS.world), pack(PACK_IDS.worldEntities), pack(PACK_IDS.combat)],
    optionalSystemPacks: [pack(PACK_IDS.ai), pack(PACK_IDS.progression)],
    requiredContentRoles: ['tuning', 'levels'],
    validationProfile: VALIDATION_PROFILES.topDown,
    knownLimitations: [LIMITATIONS.proceduralGeneration],
  }),

  definePreset({
    id: 'action-roguelite',
    displayName: 'Action Roguelite',
    family: 'top-down-action',
    controllerFamilies: ['top-down'],
    requiredSystemPacks: [pack(PACK_IDS.combat), pack(PACK_IDS.progression)],
    optionalSystemPacks: [pack(PACK_IDS.ai), pack(PACK_IDS.world), pack(PACK_IDS.worldEntities)],
    requiredContentRoles: ['tuning', 'levels'],
    validationProfile: VALIDATION_PROFILES.topDown,
    knownLimitations: [
      LIMITATIONS.proceduralGeneration,
      'Run-based meta-progression/permadeath state is not yet a reusable capability beyond sw2d.progression.',
    ],
  }),

  definePreset({
    id: 'stealth-game',
    maturity: 'smoke-validated',
    displayName: 'Stealth Game',
    family: 'top-down-action',
    controllerFamilies: ['top-down'],
    requiredSystemPacks: [pack(PACK_IDS.ai), pack(PACK_IDS.combat), pack(PACK_IDS.world)],
    optionalSystemPacks: [pack(PACK_IDS.worldEntities)],
    requiredContentRoles: ['tuning', 'levels'],
    validationProfile: VALIDATION_PROFILES.topDown,
    knownLimitations: [LIMITATIONS.stealthAi],
  }),

  definePreset({
    id: 'heist-game',
    displayName: 'Heist Game',
    family: 'top-down-action',
    controllerFamilies: ['top-down'],
    requiredSystemPacks: [pack(PACK_IDS.ai), pack(PACK_IDS.combat), pack(PACK_IDS.world)],
    optionalSystemPacks: [pack(PACK_IDS.worldEntities), pack(PACK_IDS.progression)],
    requiredContentRoles: ['tuning', 'levels'],
    validationProfile: VALIDATION_PROFILES.topDown,
    knownLimitations: [LIMITATIONS.stealthAi],
  }),

  definePreset({
    id: 'arena-combat',
    displayName: 'Arena Combat',
    family: 'top-down-action',
    controllerFamilies: ['top-down'],
    requiredSystemPacks: [pack(PACK_IDS.combat)],
    optionalSystemPacks: [pack(PACK_IDS.ai), pack(PACK_IDS.arcade)],
    requiredContentRoles: ['tuning', 'levels'],
    validationProfile: VALIDATION_PROFILES.topDown,
    knownLimitations: [LIMITATIONS.weaponsProjectiles],
  }),

  definePreset({
    id: 'boss-rush',
    displayName: 'Boss Rush',
    family: 'top-down-action',
    controllerFamilies: ['top-down'],
    requiredSystemPacks: [pack(PACK_IDS.combat), pack(PACK_IDS.ai)],
    optionalSystemPacks: [pack(PACK_IDS.arcade)],
    requiredContentRoles: ['tuning', 'levels'],
    validationProfile: VALIDATION_PROFILES.topDown,
    knownLimitations: [LIMITATIONS.bossOrchestration],
  }),
];
