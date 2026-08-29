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
    optionalSystemPacks: [pack(PACK_IDS.narrative), pack(PACK_IDS.progression), pack(PACK_IDS.items), pack(PACK_IDS.dungeonChests)],
    requiredContentRoles: ['tuning', 'levels'],
    validationProfile: VALIDATION_PROFILES.topDown,
  }),

  definePreset({
    id: 'action-adventure',
    displayName: 'Action Adventure',
    family: 'top-down-action',
    controllerFamilies: ['top-down'],
    requiredSystemPacks: [pack(PACK_IDS.world), pack(PACK_IDS.worldEntities), pack(PACK_IDS.combat), pack(PACK_IDS.weapons)],
    optionalSystemPacks: [pack(PACK_IDS.ai), pack(PACK_IDS.progression)],
    requiredContentRoles: ['tuning', 'levels'],
    validationProfile: VALIDATION_PROFILES.topDown,
    // Weapons/projectiles are reusable now (Phase 3).
    knownLimitations: ['Melee / knockback combat is not a reusable capability. Encounter orchestration (sw2d.encounters, Phase 4) is reusable but this recipe does not install it.'],
  }),

  definePreset({
    id: 'twin-stick-shooter',
    maturity: 'proof-validated',
    displayName: 'Twin-Stick Shooter',
    family: 'top-down-action',
    controllerFamilies: ['top-down'],
    requiredSystemPacks: [pack(PACK_IDS.combat), pack(PACK_IDS.weapons)],
    optionalSystemPacks: [pack(PACK_IDS.world), pack(PACK_IDS.worldEntities), pack(PACK_IDS.arcade)],
    requiredContentRoles: ['tuning', 'levels'],
    validationProfile: VALIDATION_PROFILES.topDown,
    knownLimitations: [LIMITATIONS.spatialAim],
  }),

  definePreset({
    id: 'survivor-like',
    displayName: 'Survivor-Like',
    family: 'top-down-action',
    controllerFamilies: ['top-down'],
    requiredSystemPacks: [pack(PACK_IDS.combat), pack(PACK_IDS.ai), pack(PACK_IDS.progression), pack(PACK_IDS.weapons), pack(PACK_IDS.encounters)],
    optionalSystemPacks: [pack(PACK_IDS.arcade), pack(PACK_IDS.world)],
    requiredContentRoles: ['tuning'],
    validationProfile: VALIDATION_PROFILES.topDown,
    knownLimitations: ['Endless difficulty scaling / meta-progression between runs is not a reusable system; the encounter capability (sw2d.encounters, Phase 4) drives finite waves.'],
  }),

  definePreset({
    id: 'dungeon-crawler',
    displayName: 'Dungeon Crawler',
    family: 'top-down-action',
    controllerFamilies: ['top-down'],
    requiredSystemPacks: [pack(PACK_IDS.world), pack(PACK_IDS.worldEntities), pack(PACK_IDS.combat), pack(PACK_IDS.generation)],
    optionalSystemPacks: [pack(PACK_IDS.ai), pack(PACK_IDS.progression), pack(PACK_IDS.items), pack(PACK_IDS.dungeonChests)],
    requiredContentRoles: ['tuning', 'levels', 'generation'],
    validationProfile: VALIDATION_PROFILES.topDown,
    // Phase 7 (ADR-0024): the dungeon is a deterministic seeded room graph from
    // content/generation.json, driven by the reusable sw2d.generation capability.
    knownLimitations: [
      'The room graph places Enemy objects, but the generated top-down shell does not yet wire them into sw2d.combat / sw2d.ai - enemy behaviour is game-specific code.',
    ],
  }),

  definePreset({
    id: 'action-roguelite',
    displayName: 'Action Roguelite',
    family: 'top-down-action',
    controllerFamilies: ['top-down'],
    requiredSystemPacks: [pack(PACK_IDS.combat), pack(PACK_IDS.progression), pack(PACK_IDS.generation)],
    optionalSystemPacks: [pack(PACK_IDS.ai), pack(PACK_IDS.world), pack(PACK_IDS.worldEntities)],
    requiredContentRoles: ['tuning', 'levels', 'generation'],
    validationProfile: VALIDATION_PROFILES.topDown,
    // Phase 7 (ADR-0024): deterministic seeded room graph via sw2d.generation.
    knownLimitations: [
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
    optionalSystemPacks: [pack(PACK_IDS.worldEntities), pack(PACK_IDS.navigation), pack(PACK_IDS.aiPerception)],
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
    optionalSystemPacks: [pack(PACK_IDS.worldEntities), pack(PACK_IDS.progression), pack(PACK_IDS.navigation), pack(PACK_IDS.aiPerception)],
    requiredContentRoles: ['tuning', 'levels'],
    validationProfile: VALIDATION_PROFILES.topDown,
    knownLimitations: [LIMITATIONS.stealthAi],
  }),

  definePreset({
    id: 'arena-combat',
    displayName: 'Arena Combat',
    family: 'top-down-action',
    controllerFamilies: ['top-down'],
    requiredSystemPacks: [pack(PACK_IDS.combat), pack(PACK_IDS.weapons)],
    optionalSystemPacks: [pack(PACK_IDS.ai), pack(PACK_IDS.arcade)],
    requiredContentRoles: ['tuning', 'levels'],
    validationProfile: VALIDATION_PROFILES.topDown,
    knownLimitations: ['The reusable encounter capability (sw2d.encounters, ADR-0021) exists; this starter does not wire it into its shell yet.'],
  }),

  definePreset({
    id: 'boss-rush',
    displayName: 'Boss Rush',
    family: 'top-down-action',
    controllerFamilies: ['top-down'],
    requiredSystemPacks: [pack(PACK_IDS.combat), pack(PACK_IDS.ai), pack(PACK_IDS.weapons), pack(PACK_IDS.encounters)],
    optionalSystemPacks: [pack(PACK_IDS.arcade)],
    requiredContentRoles: ['tuning', 'levels'],
    validationProfile: VALIDATION_PROFILES.topDown,
    // Reusable boss-phase orchestration implemented and consumed (capability
    // program Phase 4, ADR-0021; proof: proofs/boss-rush/).
    knownLimitations: ['Sequencing multiple bosses across a run is starter-specific; sw2d.encounters drives one boss encounter at a time.'],
  }),
];
