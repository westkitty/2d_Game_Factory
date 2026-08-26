import type { PresetDefinition } from '@sw2d/contracts';
import { PACK_IDS } from '@sw2d/packs/ids';
import { POINTER_INPUT_MODES, VALIDATION_PROFILES, definePreset, pack } from '../shared.ts';

/**
 * Family F - Strategy / defense (recipes 43-49).
 *
 * `grid` where discrete board/cell navigation is the real model
 * (`turn-based-tactics`, and the two lane/tower defense recipes for
 * placement), `top-down` for continuous actor/camera movement
 * (`simple-rts`, `base-defense`, `territory-control`), `ui-simulation` for
 * menu/turn/confirm intent (`auto-battler`), `pointer` only where the
 * recipe genuinely wants press-style targeting on top of a grid
 * (MASTER_PROJECT.md section 7 - no spatial pointer controller is invented).
 *
 * `sw2d.strategy` and `sw2d.simulation` had zero Family A-C consumers
 * (Phase 7A's own "Known failures/gaps" entry); this family is their first
 * real one. `aiPack.dependencies = ['combat.health']` still applies: every
 * recipe below that selects `sw2d.ai` anywhere also selects `sw2d.combat` as
 * *required*.
 */
export const STRATEGY_DEFENSE_PRESETS: readonly PresetDefinition[] = [
  definePreset({
    id: 'tower-defense',
    maturity: 'proof-validated',
    displayName: 'Tower Defense',
    family: 'strategy-defense',
    controllerFamilies: ['grid', 'pointer'],
    requiredSystemPacks: [pack(PACK_IDS.world), pack(PACK_IDS.worldEntities), pack(PACK_IDS.progression), pack(PACK_IDS.combat)],
    optionalSystemPacks: [pack(PACK_IDS.ai)],
    requiredContentRoles: ['tuning', 'levels'],
    supportedInputModes: POINTER_INPUT_MODES,
    validationProfile: VALIDATION_PROFILES.strategyDefense,
    knownLimitations: [
      'Spatial placement/hover targeting is not implemented.',
      'No reusable pathfinding/route-following/targeting/upgrade-tower system exists yet.',
    ],
  }),

  definePreset({
    id: 'lane-defense',
    displayName: 'Lane Defense',
    family: 'strategy-defense',
    controllerFamilies: ['grid', 'pointer'],
    requiredSystemPacks: [pack(PACK_IDS.world), pack(PACK_IDS.worldEntities), pack(PACK_IDS.progression)],
    optionalSystemPacks: [pack(PACK_IDS.combat)],
    requiredContentRoles: ['tuning', 'levels'],
    supportedInputModes: POINTER_INPUT_MODES,
    validationProfile: VALIDATION_PROFILES.strategyDefense,
    knownLimitations: ['No reusable lane-spawn/route/combat-resolution system exists yet.'],
  }),

  definePreset({
    id: 'auto-battler',
    displayName: 'Auto Battler',
    family: 'strategy-defense',
    controllerFamilies: ['ui-simulation'],
    requiredSystemPacks: [pack(PACK_IDS.strategy), pack(PACK_IDS.combat), pack(PACK_IDS.ai)],
    optionalSystemPacks: [pack(PACK_IDS.progression)],
    requiredContentRoles: ['tuning'],
    validationProfile: VALIDATION_PROFILES.strategyDefense,
    knownLimitations: ['AI/combat/strategy state foundations exist, but autonomous combat orchestration is not implemented.'],
  }),

  definePreset({
    id: 'simple-rts',
    displayName: 'Simple RTS',
    family: 'strategy-defense',
    controllerFamilies: ['top-down'],
    requiredSystemPacks: [pack(PACK_IDS.strategy), pack(PACK_IDS.combat)],
    optionalSystemPacks: [pack(PACK_IDS.ai), pack(PACK_IDS.world), pack(PACK_IDS.worldEntities)],
    requiredContentRoles: ['tuning', 'levels'],
    validationProfile: VALIDATION_PROFILES.strategyDefense,
    knownLimitations: ['Spatial selection/command targeting and pathfinding are not implemented.'],
  }),

  definePreset({
    id: 'turn-based-tactics',
    maturity: 'smoke-validated',
    displayName: 'Turn-Based Tactics',
    family: 'strategy-defense',
    controllerFamilies: ['grid', 'ui-simulation'],
    requiredSystemPacks: [pack(PACK_IDS.strategy), pack(PACK_IDS.combat)],
    optionalSystemPacks: [pack(PACK_IDS.ai), pack(PACK_IDS.world), pack(PACK_IDS.worldEntities)],
    requiredContentRoles: ['tuning', 'levels'],
    validationProfile: VALIDATION_PROFILES.strategyDefense,
    knownLimitations: [
      'Grid/strategy foundations exist, but movement range, attack range, pathfinding, and turn-action resolution are not reusable systems yet.',
    ],
  }),

  definePreset({
    id: 'base-defense',
    displayName: 'Base Defense',
    family: 'strategy-defense',
    controllerFamilies: ['top-down'],
    requiredSystemPacks: [pack(PACK_IDS.world), pack(PACK_IDS.worldEntities), pack(PACK_IDS.combat)],
    optionalSystemPacks: [pack(PACK_IDS.ai), pack(PACK_IDS.progression)],
    requiredContentRoles: ['tuning', 'levels'],
    validationProfile: VALIDATION_PROFILES.strategyDefense,
    knownLimitations: ['Wave spawning/targeting/base-damage orchestration is not a reusable system yet.'],
  }),

  definePreset({
    id: 'territory-control',
    displayName: 'Territory Control',
    family: 'strategy-defense',
    controllerFamilies: ['top-down'],
    requiredSystemPacks: [pack(PACK_IDS.world), pack(PACK_IDS.worldEntities), pack(PACK_IDS.strategy), pack(PACK_IDS.combat)],
    optionalSystemPacks: [pack(PACK_IDS.ai)],
    requiredContentRoles: ['tuning', 'levels'],
    validationProfile: VALIDATION_PROFILES.strategyDefense,
    knownLimitations: ['Reusable capture-zone/territory ownership/scoring mechanics do not exist yet.'],
  }),
];
