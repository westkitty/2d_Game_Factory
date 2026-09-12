import type { PresetDefinition } from '@sw2d/contracts';
import { PACK_IDS } from '@sw2d/packs/ids';
import { VALIDATION_PROFILES, definePreset, pack } from '../shared.ts';

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
    maturity: 'proof-validated',
    displayName: 'Action Adventure',
    family: 'top-down-action',
    controllerFamilies: ['top-down'],
    requiredSystemPacks: [pack(PACK_IDS.world), pack(PACK_IDS.worldEntities), pack(PACK_IDS.combat), pack(PACK_IDS.weapons), pack(PACK_IDS.melee)],
    optionalSystemPacks: [pack(PACK_IDS.ai), pack(PACK_IDS.progression)],
    requiredContentRoles: ['tuning', 'levels', 'melee'],
    validationProfile: VALIDATION_PROFILES.topDown,
    // Final Product Completion Wave 2 (matrix L04): combo chains, directional
    // (facing-arc) strikes, foe pursuit, hit-stun interruption and the
    // targeting reticle are the reusable sw2d.melee grammar from
    // content/melee.json.
    knownLimitations: [],
  }),

  definePreset({
    id: 'twin-stick-shooter',
    maturity: 'proof-validated',
    displayName: 'Twin-Stick Shooter',
    family: 'top-down-action',
    controllerFamilies: ['top-down'],
    // Final Product Completion Wave 2 (matrix L05): sw2d.encounters is
    // required - a freshly generated twin-stick shooter fights real waves
    // from content/encounters.json through the shared top-down shell
    // (bindStarterEncounters), never an empty arena.
    requiredSystemPacks: [pack(PACK_IDS.combat), pack(PACK_IDS.weapons), pack(PACK_IDS.encounters)],
    optionalSystemPacks: [pack(PACK_IDS.world), pack(PACK_IDS.worldEntities), pack(PACK_IDS.arcade)],
    requiredContentRoles: ['tuning', 'levels', 'encounters'],
    validationProfile: VALIDATION_PROFILES.topDown,
    // Spatial pointer aim is consumed by the generated top-down shell as of
    // the Arena finish program's Wave 2 (aimFromPointer fallback when no
    // digital AIM_* is held - the contract proofs/twin-stick-shooter proves).
    knownLimitations: [],
  }),

  definePreset({
    id: 'survivor-like',
    maturity: 'proof-validated',
    displayName: 'Survivor-Like',
    family: 'top-down-action',
    controllerFamilies: ['top-down'],
    requiredSystemPacks: [pack(PACK_IDS.combat), pack(PACK_IDS.ai), pack(PACK_IDS.progression), pack(PACK_IDS.weapons), pack(PACK_IDS.encounters), pack(PACK_IDS.runs)],
    optionalSystemPacks: [pack(PACK_IDS.arcade), pack(PACK_IDS.world)],
    requiredContentRoles: ['tuning', 'encounters', 'runs'],
    validationProfile: VALIDATION_PROFILES.topDown,
    // The generated shell loops content/encounters.json as survival waves
    // (bindStarterEncounters) and banks in-run XP on sw2d.progression
    // (Category-C Wave 17). Final Product Completion Wave 2 (matrix L06):
    // waves escalate through the encounter catalog's `escalation` (more,
    // tougher, faster enemies per loop) and the scene is one permadeath run
    // on the reusable sw2d.runs capability - death banks meta currency, K
    // buys an unlock between runs, the next run starts with that loadout.
    knownLimitations: [],
  }),

  definePreset({
    id: 'dungeon-crawler',
    maturity: 'proof-validated',
    displayName: 'Dungeon Crawler',
    family: 'top-down-action',
    controllerFamilies: ['top-down'],
    requiredSystemPacks: [pack(PACK_IDS.world), pack(PACK_IDS.worldEntities), pack(PACK_IDS.combat), pack(PACK_IDS.generation), pack(PACK_IDS.ai)],
    optionalSystemPacks: [pack(PACK_IDS.progression)],
    requiredContentRoles: ['tuning', 'levels', 'generation'],
    validationProfile: VALIDATION_PROFILES.topDown,
    // Phase 7 (ADR-0024): the dungeon is a deterministic seeded room graph from
    // content/generation.json, driven by the reusable sw2d.generation capability.
    // Final Product Completion Wave 2 (matrix L07): the room graph's Enemy
    // objects are live sw2d.ai agents (idle -> chase -> return) with sw2d.combat
    // health, rooms clear as their foes fall, the camera follows through the
    // doorways, and the exit opens when every room is cleared (bindStarterDungeon).
    knownLimitations: [],
  }),

  definePreset({
    id: 'action-roguelite',
    maturity: 'proof-validated',
    displayName: 'Action Roguelite',
    family: 'top-down-action',
    controllerFamilies: ['top-down'],
    requiredSystemPacks: [pack(PACK_IDS.combat), pack(PACK_IDS.progression), pack(PACK_IDS.generation), pack(PACK_IDS.ai), pack(PACK_IDS.runs)],
    optionalSystemPacks: [pack(PACK_IDS.world), pack(PACK_IDS.worldEntities)],
    requiredContentRoles: ['tuning', 'levels', 'generation', 'runs'],
    validationProfile: VALIDATION_PROFILES.topDown,
    // Phase 7 (ADR-0024): deterministic seeded room graph via sw2d.generation.
    // Final Product Completion Wave 2 (matrix L08): the dungeon is one run on
    // the reusable sw2d.runs capability - cleared rooms drop coin (sw2d.progression),
    // the exit clears the run, death ends it (permadeath), the result is banked
    // as meta currency, K buys an unlock between runs and the next run starts
    // with that loadout (bindStarterDungeon in rogue mode).
    knownLimitations: [],
  }),

  definePreset({
    id: 'stealth-game',
    maturity: 'proof-validated',
    displayName: 'Stealth Game',
    family: 'top-down-action',
    controllerFamilies: ['top-down'],
    requiredSystemPacks: [pack(PACK_IDS.ai), pack(PACK_IDS.combat), pack(PACK_IDS.world), pack(PACK_IDS.perception)],
    optionalSystemPacks: [pack(PACK_IDS.worldEntities), pack(PACK_IDS.navigation)],
    requiredContentRoles: ['tuning', 'levels', 'perception'],
    validationProfile: VALIDATION_PROFILES.topDown,
    // Final Product Completion Wave 2 (matrix L09): patrol routes, the observer
    // state machine (patrol / suspicious / chase / investigate / return),
    // catch, noise investigation and takedowns are the reusable sw2d.perception
    // stealth AI from content/perception.json.
    knownLimitations: [],
  }),

  definePreset({
    id: 'heist-game',
    maturity: 'proof-validated',
    displayName: 'Heist Game',
    family: 'top-down-action',
    controllerFamilies: ['top-down'],
    requiredSystemPacks: [pack(PACK_IDS.ai), pack(PACK_IDS.combat), pack(PACK_IDS.world), pack(PACK_IDS.perception)],
    optionalSystemPacks: [pack(PACK_IDS.worldEntities), pack(PACK_IDS.progression), pack(PACK_IDS.navigation)],
    requiredContentRoles: ['tuning', 'levels', 'perception'],
    validationProfile: VALIDATION_PROFILES.topDown,
    // Final Product Completion Wave 2 (matrix L09): patrol routes, the observer
    // state machine (patrol / suspicious / chase / investigate / return),
    // catch, noise investigation and takedowns are the reusable sw2d.perception
    // stealth AI from content/perception.json.
    knownLimitations: [],
  }),

  definePreset({
    id: 'arena-combat',
    maturity: 'proof-validated',
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
    // Final Product Completion Wave 2 (matrix L04): see action-adventure.
    knownLimitations: [],
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
