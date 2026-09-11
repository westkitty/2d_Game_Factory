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
    maturity: 'proof-validated',
    displayName: 'Microgame Collection',
    family: 'party-toy-weird',
    controllerFamilies: ['ui-simulation'],
    requiredSystemPacks: [pack(PACK_IDS.arcade)],
    optionalSystemPacks: [pack(PACK_IDS.progression)],
    requiredContentRoles: ['tuning', 'microgames'],
    validationProfile: VALIDATION_PROFILES.partyToyWeird,
    knownLimitations: [
      'Wait/go then mash rounds are a generated starter scheduler on sw2d.arcade; a content-authored rotation/meta-framework is not.',
    ],
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
    knownLimitations: [LIMITATIONS.localPlaySeats],
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
    knownLimitations: [
      'Toy launch/goal is game-specific presentation of Matter; pinball-lite consumes sw2d.pinball instead.',
    ],
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
    knownLimitations: [
      'Wardrobe slots for the generated starter use interaction drag/drop (ADR-0018); a reusable attachment/skeleton wardrobe system is not.',
    ],
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
    knownLimitations: [
      'Block, ball and crate stamps, plus pick-up/move/delete, for the generated starter use interaction click (ADR-0018); a generalized authoring/editing sandbox pack is not.',
    ],
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
    knownLimitations: [
      'Stroke polylines for the generated starter are captured through the spatial pointer (ADR-0018); pressure, layers, export and a reusable drawing-canvas system are not.',
    ],
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
    knownLimitations: [LIMITATIONS.arcadeScore],
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
    knownLimitations: [LIMITATIONS.arcadeScore],
  }),

  definePreset({
    id: 'photography-game',
    displayName: 'Photography Game',
    family: 'party-toy-weird',
    controllerFamilies: ['top-down', 'pointer'],
    requiredSystemPacks: [pack(PACK_IDS.world), pack(PACK_IDS.worldEntities), pack(PACK_IDS.camera)],
    optionalSystemPacks: [pack(PACK_IDS.arcade)],
    requiredContentRoles: ['tuning', 'levels', 'camera'],
    supportedInputModes: POINTER_INPUT_MODES,
    validationProfile: VALIDATION_PROFILES.partyToyWeird,
    knownLimitations: [
      'Subjects for the generated starter are captured through the spatial pointer (ADR-0018) when the player is in range; framing capture is reusable (sw2d.camera); pressure, exposure and a photography scoring overlay are not.',
    ],
  }),
];
