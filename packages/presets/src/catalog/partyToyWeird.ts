import type { PresetDefinition } from '@sw2d/contracts';
import { PACK_IDS } from '@sw2d/packs/ids';
import { LIMITATIONS, POINTER_INPUT_MODES, VALIDATION_PROFILES, definePreset, pack } from '../shared.ts';

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
    displayName: 'Microgame Collection',
    family: 'party-toy-weird',
    controllerFamilies: ['ui-simulation'],
    requiredSystemPacks: [pack(PACK_IDS.arcade)],
    optionalSystemPacks: [pack(PACK_IDS.progression)],
    requiredContentRoles: ['tuning', 'microgames'],
    validationProfile: VALIDATION_PROFILES.partyToyWeird,
    knownLimitations: ['No microgame scheduler/rotation/meta-framework exists.'],
  }),

  definePreset({
    id: 'local-party-game',
    displayName: 'Local Party Game',
    family: 'party-toy-weird',
    controllerFamilies: ['ui-simulation'],
    requiredSystemPacks: [pack(PACK_IDS.arcade)],
    optionalSystemPacks: [pack(PACK_IDS.combat)],
    requiredContentRoles: ['tuning'],
    validationProfile: VALIDATION_PROFILES.partyToyWeird,
    knownLimitations: ['No multi-player/local multi-device input routing exists.'],
  }),

  definePreset({
    id: 'physics-toy',
    displayName: 'Physics Toy',
    family: 'party-toy-weird',
    controllerFamilies: ['pointer'],
    requiredSystemPacks: [],
    optionalSystemPacks: [pack(PACK_IDS.puzzle)],
    requiredContentRoles: ['tuning'],
    supportedInputModes: POINTER_INPUT_MODES,
    validationProfile: VALIDATION_PROFILES.partyToyWeird,
    knownLimitations: [LIMITATIONS.advancedPhysics],
  }),

  definePreset({
    id: 'virtual-pet',
    displayName: 'Virtual Pet',
    family: 'party-toy-weird',
    controllerFamilies: ['ui-simulation'],
    requiredSystemPacks: [pack(PACK_IDS.simulation), pack(PACK_IDS.progression)],
    optionalSystemPacks: [pack(PACK_IDS.world)],
    requiredContentRoles: ['tuning'],
    validationProfile: VALIDATION_PROFILES.partyToyWeird,
    knownLimitations: [LIMITATIONS.creatureSimulation],
  }),

  definePreset({
    id: 'dress-up-character-toy',
    displayName: 'Dress-Up Character Toy',
    family: 'party-toy-weird',
    controllerFamilies: ['pointer', 'ui-simulation'],
    requiredSystemPacks: [],
    optionalSystemPacks: [pack(PACK_IDS.progression)],
    requiredContentRoles: ['tuning', 'characters'],
    supportedInputModes: POINTER_INPUT_MODES,
    validationProfile: VALIDATION_PROFILES.partyToyWeird,
    knownLimitations: ['No spatial drag/drop wardrobe/attachment system exists.'],
  }),

  definePreset({
    id: 'sandbox-playground',
    displayName: 'Sandbox Playground',
    family: 'party-toy-weird',
    controllerFamilies: ['pointer', 'ui-simulation'],
    requiredSystemPacks: [pack(PACK_IDS.world), pack(PACK_IDS.worldEntities)],
    optionalSystemPacks: [pack(PACK_IDS.puzzle)],
    requiredContentRoles: ['tuning', 'levels'],
    supportedInputModes: POINTER_INPUT_MODES,
    validationProfile: VALIDATION_PROFILES.partyToyWeird,
    knownLimitations: ['No generalized authoring/editing sandbox exists.'],
  }),

  definePreset({
    id: 'drawing-game',
    displayName: 'Drawing Game',
    family: 'party-toy-weird',
    controllerFamilies: ['pointer'],
    requiredSystemPacks: [],
    optionalSystemPacks: [pack(PACK_IDS.arcade)],
    requiredContentRoles: ['tuning'],
    supportedInputModes: POINTER_INPUT_MODES,
    validationProfile: VALIDATION_PROFILES.partyToyWeird,
    knownLimitations: ['No spatial pointer drawing/canvas-stroke input service exists.'],
  }),

  definePreset({
    id: 'fishing-game',
    displayName: 'Fishing Game',
    family: 'party-toy-weird',
    controllerFamilies: ['ui-simulation'],
    requiredSystemPacks: [pack(PACK_IDS.arcade)],
    optionalSystemPacks: [pack(PACK_IDS.progression)],
    requiredContentRoles: ['tuning'],
    validationProfile: VALIDATION_PROFILES.partyToyWeird,
    knownLimitations: ['No reusable casting/line/tension/fish behavior system exists.'],
  }),

  definePreset({
    id: 'cooking-game',
    displayName: 'Cooking Game',
    family: 'party-toy-weird',
    controllerFamilies: ['ui-simulation'],
    requiredSystemPacks: [pack(PACK_IDS.arcade)],
    optionalSystemPacks: [pack(PACK_IDS.progression), pack(PACK_IDS.simulation)],
    requiredContentRoles: ['tuning', 'recipes'],
    validationProfile: VALIDATION_PROFILES.partyToyWeird,
    knownLimitations: ['No reusable ingredient/recipe/action-sequence cooking system exists.'],
  }),

  definePreset({
    id: 'photography-game',
    displayName: 'Photography Game',
    family: 'party-toy-weird',
    controllerFamilies: ['top-down', 'pointer'],
    requiredSystemPacks: [pack(PACK_IDS.world), pack(PACK_IDS.worldEntities)],
    optionalSystemPacks: [pack(PACK_IDS.arcade)],
    requiredContentRoles: ['tuning', 'levels'],
    supportedInputModes: POINTER_INPUT_MODES,
    validationProfile: VALIDATION_PROFILES.partyToyWeird,
    knownLimitations: ['No reusable camera/framing/scoring/photo-capture gameplay system exists.'],
  }),
];
