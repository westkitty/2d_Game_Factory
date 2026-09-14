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
    requiredSystemPacks: [pack(PACK_IDS.world), pack(PACK_IDS.worldEntities), pack(PACK_IDS.progression), pack(PACK_IDS.combat), pack(PACK_IDS.navigation), pack(PACK_IDS.targeting)],
    optionalSystemPacks: [pack(PACK_IDS.ai)],
    requiredContentRoles: ['tuning', 'levels', 'targeting'],
    supportedInputModes: POINTER_INPUT_MODES,
    validationProfile: VALIDATION_PROFILES.strategyDefense,
    // Route-following pathfinding is reusable now (sw2d.navigation, ADR-0022;
    // proof: proofs/tower-defense/). Spatial placement uses sw2d.interaction
    // (Phase 1) via the pointer shell, but this proof keeps the grid cursor.
    knownLimitations: [],
  }),

  definePreset({
    id: 'lane-defense',
    maturity: 'proof-validated',
    displayName: 'Lane Defense',
    family: 'strategy-defense',
    controllerFamilies: ['grid', 'pointer'],
    requiredSystemPacks: [pack(PACK_IDS.world), pack(PACK_IDS.worldEntities), pack(PACK_IDS.progression), pack(PACK_IDS.navigation), pack(PACK_IDS.encounters), pack(PACK_IDS.combat)],
    optionalSystemPacks: [],
    requiredContentRoles: ['tuning', 'levels'],
    supportedInputModes: POINTER_INPUT_MODES,
    validationProfile: VALIDATION_PROFILES.strategyDefense,
    // Deterministic route-following + dynamic re-path are reusable now
    // (sw2d.navigation, ADR-0022; proof: proofs/lane-defense/).
    knownLimitations: [],
  }),

  definePreset({
    id: 'auto-battler',
    maturity: 'proof-validated',
    displayName: 'Auto Battler',
    family: 'strategy-defense',
    controllerFamilies: ['ui-simulation'],
    requiredSystemPacks: [pack(PACK_IDS.strategy), pack(PACK_IDS.combat), pack(PACK_IDS.ai), pack(PACK_IDS.targeting)],
    optionalSystemPacks: [pack(PACK_IDS.progression)],
    requiredContentRoles: ['tuning', 'targeting'],
    validationProfile: VALIDATION_PROFILES.strategyDefense,
    knownLimitations: [],
  }),

  definePreset({
    id: 'simple-rts',
    maturity: 'proof-validated',
    displayName: 'Simple RTS',
    family: 'strategy-defense',
    controllerFamilies: ['top-down'],
    requiredSystemPacks: [pack(PACK_IDS.strategy), pack(PACK_IDS.combat), pack(PACK_IDS.territory), pack(PACK_IDS.navigation), pack(PACK_IDS.world), pack(PACK_IDS.worldEntities)],
    optionalSystemPacks: [pack(PACK_IDS.ai)],
    requiredContentRoles: ['tuning', 'levels', 'territory'],
    validationProfile: VALIDATION_PROFILES.strategyDefense,
    knownLimitations: [],
  }),

  definePreset({
    id: 'turn-based-tactics',
    maturity: 'proof-validated',
    displayName: 'Turn-Based Tactics',
    family: 'strategy-defense',
    controllerFamilies: ['grid', 'ui-simulation'],
    requiredSystemPacks: [pack(PACK_IDS.strategy), pack(PACK_IDS.combat), pack(PACK_IDS.navigation), pack(PACK_IDS.targeting)],
    optionalSystemPacks: [pack(PACK_IDS.ai), pack(PACK_IDS.world), pack(PACK_IDS.worldEntities)],
    requiredContentRoles: ['tuning', 'levels', 'targeting'],
    validationProfile: VALIDATION_PROFILES.strategyDefense,
    // Reachable-cell movement range + deterministic route-following are reusable
    // now (sw2d.navigation, ADR-0022; proof: proofs/turn-based-tactics/).
    knownLimitations: [],
  }),

  definePreset({
    id: 'base-defense',
    maturity: 'proof-validated',
    displayName: 'Base Defense',
    family: 'strategy-defense',
    controllerFamilies: ['top-down'],
    requiredSystemPacks: [pack(PACK_IDS.world), pack(PACK_IDS.worldEntities), pack(PACK_IDS.combat), pack(PACK_IDS.encounters), pack(PACK_IDS.targeting), pack(PACK_IDS.progression)],
    optionalSystemPacks: [pack(PACK_IDS.ai)],
    requiredContentRoles: ['tuning', 'levels', 'targeting'],
    validationProfile: VALIDATION_PROFILES.strategyDefense,
    knownLimitations: [],
  }),

  definePreset({
    id: 'territory-control',
    maturity: 'proof-validated',
    displayName: 'Territory Control',
    family: 'strategy-defense',
    controllerFamilies: ['top-down'],
    requiredSystemPacks: [pack(PACK_IDS.world), pack(PACK_IDS.worldEntities), pack(PACK_IDS.strategy), pack(PACK_IDS.combat), pack(PACK_IDS.territory)],
    optionalSystemPacks: [pack(PACK_IDS.ai)],
    requiredContentRoles: ['tuning', 'levels', 'territory'],
    validationProfile: VALIDATION_PROFILES.strategyDefense,
    knownLimitations: [],
  }),
];
