import type { PresetDefinition } from '@sw2d/contracts';
import { PACK_IDS } from '@sw2d/packs/ids';
import { LIMITATIONS, VALIDATION_PROFILES, definePreset, pack } from '../shared.ts';

/**
 * Family A - Platforming (recipes 1-10).
 *
 * All ten use the `platform` controller family - side-view movement intent
 * only, per MASTER_PROJECT.md section 6. `puzzle-platformer` additionally
 * uses `grid`, because its identity is discrete puzzle interaction layered
 * on top of platform movement, not platform movement alone.
 *
 * None reference a "movement pack": platform movement is game-specific code
 * reading `platformController` intent directly (starter/src/game-specific/
 * placeholderMoverPack.ts and tiledLevelPack.ts are the worked examples), not
 * a `@sw2d/packs` capability. What a platforming recipe actually composes
 * from real packs is content/world plumbing (`sw2d.world`,
 * `sw2d.world-entities` - Phase 6) and, where the genre calls for it,
 * scoring, progression or puzzle state.
 */
export const PLATFORMING_PRESETS: readonly PresetDefinition[] = [
  definePreset({
    id: 'traditional-platformer',
    maturity: 'smoke-validated',
    displayName: 'Traditional Platformer',
    family: 'platforming',
    controllerFamilies: ['platform'],
    requiredSystemPacks: [pack(PACK_IDS.world), pack(PACK_IDS.worldEntities)],
    optionalSystemPacks: [pack(PACK_IDS.arcade)],
    requiredContentRoles: ['tuning', 'levels'],
    validationProfile: VALIDATION_PROFILES.platform,
  }),

  definePreset({
    id: 'chase-platformer',
    maturity: 'proof-validated',
    displayName: 'Chase Platformer',
    family: 'platforming',
    controllerFamilies: ['platform'],
    requiredSystemPacks: [pack(PACK_IDS.world), pack(PACK_IDS.worldEntities)],
    optionalSystemPacks: [pack(PACK_IDS.combat), pack(PACK_IDS.arcade)],
    requiredContentRoles: ['tuning', 'levels'],
    validationProfile: VALIDATION_PROFILES.platform,
    knownLimitations: [LIMITATIONS.chasePressure],
  }),

  definePreset({
    id: 'endless-runner',
    displayName: 'Endless Runner',
    family: 'platforming',
    controllerFamilies: ['platform'],
    requiredSystemPacks: [pack(PACK_IDS.arcade), pack(PACK_IDS.generation)],
    optionalSystemPacks: [pack(PACK_IDS.world), pack(PACK_IDS.worldEntities)],
    requiredContentRoles: ['tuning', 'levels', 'generation'],
    validationProfile: VALIDATION_PROFILES.platform,
    // Phase 7 (ADR-0024): the level is a deterministic seeded segment chain from
    // content/generation.json, driven by the reusable sw2d.generation capability.
    knownLimitations: [],
  }),

  definePreset({
    id: 'precision-platformer',
    displayName: 'Precision Platformer',
    family: 'platforming',
    controllerFamilies: ['platform'],
    requiredSystemPacks: [pack(PACK_IDS.world), pack(PACK_IDS.worldEntities)],
    optionalSystemPacks: [pack(PACK_IDS.arcade)],
    requiredContentRoles: ['tuning', 'levels'],
    validationProfile: VALIDATION_PROFILES.platform,
  }),

  definePreset({
    id: 'metroidvania',
    maturity: 'smoke-validated',
    displayName: 'Metroidvania',
    family: 'platforming',
    controllerFamilies: ['platform'],
    requiredSystemPacks: [pack(PACK_IDS.world), pack(PACK_IDS.worldEntities), pack(PACK_IDS.progression), pack(PACK_IDS.worldGraph)],
    optionalSystemPacks: [pack(PACK_IDS.combat), pack(PACK_IDS.ai)],
    requiredContentRoles: ['tuning', 'levels', 'world-graph'],
    validationProfile: VALIDATION_PROFILES.platform,
    // Phase 8 (ADR-0025): locations, gated connections, room transitions and the
    // map are the reusable sw2d.world-graph capability + content/world-graph.json.
    knownLimitations: [],
  }),

  definePreset({
    id: 'puzzle-platformer',
    displayName: 'Puzzle Platformer',
    family: 'platforming',
    controllerFamilies: ['platform', 'grid'],
    requiredSystemPacks: [pack(PACK_IDS.puzzleRules), pack(PACK_IDS.world), pack(PACK_IDS.worldEntities)],
    requiredContentRoles: ['tuning', 'levels', 'puzzles'],
    validationProfile: VALIDATION_PROFILES.platform,
    // Phase 6 (ADR-0023): the switch/sequence puzzle - switch set, links,
    // completion condition, solved-detection - is the validated
    // content/puzzles.json document, driven by the reusable
    // sw2d.puzzle-rules capability. No code-config seam.
    knownLimitations: [],
  }),

  definePreset({
    id: 'auto-runner',
    displayName: 'Auto Runner',
    family: 'platforming',
    controllerFamilies: ['platform'],
    requiredSystemPacks: [pack(PACK_IDS.arcade), pack(PACK_IDS.generation)],
    optionalSystemPacks: [pack(PACK_IDS.world), pack(PACK_IDS.worldEntities)],
    requiredContentRoles: ['tuning', 'levels', 'generation'],
    validationProfile: VALIDATION_PROFILES.platform,
    // Phase 7 (ADR-0024): deterministic seeded segment chain via sw2d.generation.
    knownLimitations: [],
  }),

  definePreset({
    id: 'climbing-game',
    displayName: 'Climbing Game',
    family: 'platforming',
    controllerFamilies: ['platform'],
    requiredSystemPacks: [pack(PACK_IDS.world), pack(PACK_IDS.worldEntities)],
    optionalSystemPacks: [pack(PACK_IDS.arcade)],
    requiredContentRoles: ['tuning', 'levels'],
    validationProfile: VALIDATION_PROFILES.platform,
    knownLimitations: [LIMITATIONS.climbingMechanics],
  }),

  definePreset({
    id: 'grappling-platformer',
    displayName: 'Grappling Platformer',
    family: 'platforming',
    controllerFamilies: ['platform'],
    requiredSystemPacks: [pack(PACK_IDS.world), pack(PACK_IDS.worldEntities)],
    optionalSystemPacks: [pack(PACK_IDS.arcade)],
    requiredContentRoles: ['tuning', 'levels'],
    validationProfile: VALIDATION_PROFILES.platform,
    // Phase 9 (ADR-0026): the Matter backend (physicsProfile) + the reusable
    // AdvancedPhysicsService / GrappleService give a real physical grapple.
    physicsProfile: 'matter',
    knownLimitations: [],
  }),

  definePreset({
    id: 'collectathon-platformer',
    displayName: 'Collectathon Platformer',
    family: 'platforming',
    controllerFamilies: ['platform'],
    requiredSystemPacks: [pack(PACK_IDS.world), pack(PACK_IDS.worldEntities), pack(PACK_IDS.arcade), pack(PACK_IDS.items)],
    optionalSystemPacks: [pack(PACK_IDS.progression)],
    requiredContentRoles: ['tuning', 'levels', 'items'],
    validationProfile: VALIDATION_PROFILES.platform,
    // Data-driven item/effect definitions are implemented and consumed by this
    // starter (capability program Phase 2, ADR-0019; proof:
    // proofs/collectathon-platformer/).
    knownLimitations: [],
  }),
];
