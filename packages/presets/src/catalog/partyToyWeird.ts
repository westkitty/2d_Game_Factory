import type { PresetDefinition } from '@sw2d/contracts';
import { PACK_IDS } from '@sw2d/packs/ids';
import { POINTER_INPUT_MODES, VALIDATION_PROFILES, definePreset, pack } from '../shared.ts';

/**
 * Family I - Party / toy / weird (recipes 65-74, the final family).
 *
 * "Use the existing closest semantic controller only" (MASTER_PROJECT.md
 * section 6) - `pointer` where the recipe's identity genuinely is clicking/
 * tapping something (`physics-toy`, `drawing-game`), `ui-simulation` where
 * confirm/cancel/navigate already covers it honestly (`microgame-collection`,
 * `local-party-game`, `virtual-pet`, `fishing-game`, `cooking-game`), and a
 * combination only where a real spatial-plus-selection identity justifies it
 * (`dress-up-character-toy`, `sandbox-playground`, `photography-game`) - the
 * same restraint Family H already applied, not a new rule invented here.
 */
export const PARTY_TOY_WEIRD_PRESETS: readonly PresetDefinition[] = [
  definePreset({
    id: 'microgame-collection',
    maturity: 'proof-validated',
    displayName: 'Microgame Collection',
    family: 'party-toy-weird',
    controllerFamilies: ['ui-simulation'],
    requiredSystemPacks: [pack(PACK_IDS.arcade)],
    optionalSystemPacks: [pack(PACK_IDS.progression)],
    requiredContentRoles: ['tuning', 'microgames'],
    validationProfile: VALIDATION_PROFILES.partyToyWeird,
    knownLimitations: [],
  }),

  definePreset({
    id: 'local-party-game',
    maturity: 'proof-validated',
    displayName: 'Local Party Game',
    family: 'party-toy-weird',
    controllerFamilies: ['ui-simulation'],
    requiredSystemPacks: [pack(PACK_IDS.arcade), pack(PACK_IDS.localPlay)],
    optionalSystemPacks: [pack(PACK_IDS.combat)],
    requiredContentRoles: ['tuning', 'local-play'],
    validationProfile: VALIDATION_PROFILES.partyToyWeird,
    knownLimitations: [],
  }),

  definePreset({
    id: 'physics-toy',
    maturity: 'proof-validated',
    displayName: 'Physics Toy',
    family: 'party-toy-weird',
    controllerFamilies: ['pointer'],
    requiredSystemPacks: [],
    optionalSystemPacks: [pack(PACK_IDS.puzzle)],
    requiredContentRoles: ['tuning'],
    supportedInputModes: POINTER_INPUT_MODES,
    validationProfile: VALIDATION_PROFILES.partyToyWeird,
    // Phase 9 (ADR-0026): the Matter backend + reusable AdvancedPhysicsService
    // (rigid bodies, collision, springs) drive the generated pointer shell.
    physicsProfile: 'matter',
    knownLimitations: [],
  }),

  definePreset({
    id: 'virtual-pet',
    maturity: 'proof-validated',
    displayName: 'Virtual Pet',
    family: 'party-toy-weird',
    controllerFamilies: ['ui-simulation'],
    requiredSystemPacks: [pack(PACK_IDS.simulation), pack(PACK_IDS.progression), pack(PACK_IDS.needs)],
    optionalSystemPacks: [pack(PACK_IDS.world)],
    requiredContentRoles: ['tuning', 'needs'],
    validationProfile: VALIDATION_PROFILES.partyToyWeird,
    knownLimitations: [],
  }),

  definePreset({
    id: 'dress-up-character-toy',
    maturity: 'proof-validated',
    displayName: 'Dress-Up Character Toy',
    family: 'party-toy-weird',
    controllerFamilies: ['pointer', 'ui-simulation'],
    requiredSystemPacks: [pack(PACK_IDS.items)],
    optionalSystemPacks: [pack(PACK_IDS.progression)],
    requiredContentRoles: ['tuning', 'characters', 'items'],
    supportedInputModes: POINTER_INPUT_MODES,
    validationProfile: VALIDATION_PROFILES.partyToyWeird,
    knownLimitations: [],
  }),

  definePreset({
    id: 'sandbox-playground',
    maturity: 'proof-validated',
    displayName: 'Sandbox Playground',
    family: 'party-toy-weird',
    controllerFamilies: ['pointer', 'ui-simulation'],
    requiredSystemPacks: [pack(PACK_IDS.world), pack(PACK_IDS.worldEntities)],
    optionalSystemPacks: [pack(PACK_IDS.puzzle)],
    requiredContentRoles: ['tuning', 'levels'],
    supportedInputModes: POINTER_INPUT_MODES,
    validationProfile: VALIDATION_PROFILES.partyToyWeird,
    knownLimitations: [],
  }),

  definePreset({
    id: 'drawing-game',
    maturity: 'proof-validated',
    displayName: 'Drawing Game',
    family: 'party-toy-weird',
    controllerFamilies: ['pointer'],
    requiredSystemPacks: [],
    optionalSystemPacks: [pack(PACK_IDS.arcade)],
    requiredContentRoles: ['tuning'],
    supportedInputModes: POINTER_INPUT_MODES,
    validationProfile: VALIDATION_PROFILES.partyToyWeird,
    knownLimitations: [],
  }),

  definePreset({
    id: 'fishing-game',
    maturity: 'proof-validated',
    displayName: 'Fishing Game',
    family: 'party-toy-weird',
    controllerFamilies: ['ui-simulation'],
    requiredSystemPacks: [pack(PACK_IDS.arcade)],
    optionalSystemPacks: [pack(PACK_IDS.progression)],
    requiredContentRoles: ['tuning'],
    validationProfile: VALIDATION_PROFILES.partyToyWeird,
    knownLimitations: [],
  }),

  definePreset({
    id: 'cooking-game',
    maturity: 'proof-validated',
    displayName: 'Cooking Game',
    family: 'party-toy-weird',
    controllerFamilies: ['ui-simulation'],
    requiredSystemPacks: [pack(PACK_IDS.arcade)],
    optionalSystemPacks: [pack(PACK_IDS.progression), pack(PACK_IDS.simulation)],
    requiredContentRoles: ['tuning', 'recipes'],
    validationProfile: VALIDATION_PROFILES.partyToyWeird,
    knownLimitations: [],
  }),

  definePreset({
    id: 'photography-game',
    maturity: 'proof-validated',
    displayName: 'Photography Game',
    family: 'party-toy-weird',
    controllerFamilies: ['top-down', 'pointer'],
    requiredSystemPacks: [pack(PACK_IDS.world), pack(PACK_IDS.worldEntities), pack(PACK_IDS.camera)],
    optionalSystemPacks: [pack(PACK_IDS.arcade)],
    requiredContentRoles: ['tuning', 'levels', 'camera'],
    supportedInputModes: POINTER_INPUT_MODES,
    validationProfile: VALIDATION_PROFILES.partyToyWeird,
    knownLimitations: [],
  }),
];
