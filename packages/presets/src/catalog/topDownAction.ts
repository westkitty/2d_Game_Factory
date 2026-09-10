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
    maturity: 'proof-validated',
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
    requiredSystemPacks: [pack(PACK_IDS.world), pack(PACK_IDS.worldEntities), pack(PACK_IDS.combat), pack(PACK_IDS.weapons), pack(PACK_IDS.melee)],
    optionalSystemPacks: [pack(PACK_IDS.ai), pack(PACK_IDS.progression)],
    requiredContentRoles: ['tuning', 'levels', 'melee'],
    validationProfile: VALIDATION_PROFILES.topDown,
    knownLimitations: [LIMITATIONS.meleeCombat],
  }),

  definePreset({
    id: 'twin-stick-shooter',
    maturity: 'proof-validated',
    displayName: 'Twin-Stick Shooter',
    family: 'top-down-action',
    controllerFamilies: ['top-down'],
    requiredSystemPacks: [pack(PACK_IDS.combat), pack(PACK_IDS.weapons)],
    optionalSystemPacks: [pack(PACK_IDS.world), pack(PACK_IDS.worldEntities), pack(PACK_IDS.arcade), pack(PACK_IDS.encounters)],
    requiredContentRoles: ['tuning', 'levels'],
    validationProfile: VALIDATION_PROFILES.topDown,
    // Spatial pointer aim is consumed by the generated top-down shell as of
    // the Arena finish program's Wave 2 (aimFromPointer fallback when no
    // digital AIM_* is held - the contract proofs/twin-stick-shooter proves).
    knownLimitations: [
      'The generated starter ships no enemy waves out of the box: sw2d.encounters is optional for this recipe, so opposition is added by enabling that pack or authoring game-specific spawns (the committed proof game demonstrates the latter).',
    ],
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
    // The generated shell loops content/encounters.json as survival waves
    // (bindStarterEncounters) and now banks in-run XP on sw2d.progression
    // (Category-C Wave 17). What is still missing is escalation between loops.
    knownLimitations: [
      'In-run XP and unlock flags for the generated starter use sw2d.progression; endless difficulty scaling / meta-progression between runs is not a reusable system; the starter survival loop repeats the authored encounter without escalating it.',
    ],
  }),

  definePreset({
    id: 'dungeon-crawler',
    maturity: 'proof-validated',
    displayName: 'Dungeon Crawler',
    family: 'top-down-action',
    controllerFamilies: ['top-down'],
    requiredSystemPacks: [pack(PACK_IDS.world), pack(PACK_IDS.worldEntities), pack(PACK_IDS.combat), pack(PACK_IDS.generation)],
    optionalSystemPacks: [pack(PACK_IDS.ai), pack(PACK_IDS.progression)],
    requiredContentRoles: ['tuning', 'levels', 'generation'],
    validationProfile: VALIDATION_PROFILES.topDown,
    // Phase 7 (ADR-0024): the dungeon is a deterministic seeded room graph from
    // content/generation.json, driven by the reusable sw2d.generation capability.
    // Category-C Wave 21: contact/strike for the generated starter use sw2d.combat.
    knownLimitations: [
      'Contact damage and strike for the generated starter use sw2d.combat; generated Enemy objects from the room graph and AI behaviour are not wired.',
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
    // Category-C Wave 17 banks in-run relics on sw2d.progression; permadeath
    // and between-run loadouts stay leftover.
    knownLimitations: [
      'In-run currency, XP, items and unlock flags for the generated starter use sw2d.progression; run-based permadeath and between-run loadouts are not a reusable capability.',
    ],
  }),

  definePreset({
    id: 'stealth-game',
    maturity: 'smoke-validated',
    displayName: 'Stealth Game',
    family: 'top-down-action',
    controllerFamilies: ['top-down'],
    requiredSystemPacks: [pack(PACK_IDS.ai), pack(PACK_IDS.combat), pack(PACK_IDS.world), pack(PACK_IDS.perception)],
    optionalSystemPacks: [pack(PACK_IDS.worldEntities), pack(PACK_IDS.navigation)],
    requiredContentRoles: ['tuning', 'levels', 'perception'],
    validationProfile: VALIDATION_PROFILES.topDown,
    knownLimitations: [LIMITATIONS.stealthAi],
  }),

  definePreset({
    id: 'heist-game',
    displayName: 'Heist Game',
    family: 'top-down-action',
    controllerFamilies: ['top-down'],
    requiredSystemPacks: [pack(PACK_IDS.ai), pack(PACK_IDS.combat), pack(PACK_IDS.world), pack(PACK_IDS.perception)],
    optionalSystemPacks: [pack(PACK_IDS.worldEntities), pack(PACK_IDS.progression), pack(PACK_IDS.navigation)],
    requiredContentRoles: ['tuning', 'levels', 'perception'],
    validationProfile: VALIDATION_PROFILES.topDown,
    knownLimitations: [LIMITATIONS.stealthAi],
  }),

  definePreset({
    id: 'arena-combat',
    displayName: 'Arena Combat',
    family: 'top-down-action',
    controllerFamilies: ['top-down'],
    // sw2d.encounters became required in the Arena finish program's Wave 2:
    // fighting content-driven waves in a fixed arena is this preset's whole
    // genre, and the generated top-down shell now wires it for real
    // (bindStarterEncounters).
    requiredSystemPacks: [pack(PACK_IDS.combat), pack(PACK_IDS.weapons), pack(PACK_IDS.encounters), pack(PACK_IDS.melee)],
    optionalSystemPacks: [pack(PACK_IDS.ai), pack(PACK_IDS.arcade)],
    requiredContentRoles: ['tuning', 'levels', 'melee'],
    validationProfile: VALIDATION_PROFILES.topDown,
    knownLimitations: [LIMITATIONS.meleeCombat],
  }),

  definePreset({
    id: 'boss-rush',
    maturity: 'proof-validated',
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
