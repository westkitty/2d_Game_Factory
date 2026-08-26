import type { PresetDefinition } from '@sw2d/contracts';
import { PACK_IDS } from '@sw2d/packs/ids';
import { LIMITATIONS, POINTER_INPUT_MODES, VALIDATION_PROFILES, definePreset, pack } from '../shared.ts';

/**
 * Family H - Narrative / exploration (recipes 58-64).
 *
 * Controller per recipe follows MASTER_PROJECT.md section 6's per-recipe
 * guidance exactly, not a family default: `top-down` for the two recipes
 * genuinely about moving through a space (`exploration-game`,
 * `investigation-game` alongside `pointer` for clue interaction,
 * `museum-exhibit` alongside `pointer` for exhibit interaction),
 * `ui-simulation` for the three that are fundamentally menu/text-driven
 * (`visual-novel`, `interactive-fiction-hybrid`), and `pointer` (plus
 * `ui-simulation`) for the two whose defining interaction is clicking
 * something (`point-and-click`, `escape-room`).
 *
 * `narrativePack`'s own doc comment: "lightweight state for later visual
 * novel/adventure systems ... No scripting language, renderer, portrait
 * system, dialogue graph loader, localization platform or quest framework
 * here" - every recipe that requires it therefore states what content it
 * cannot yet author declaratively.
 */
export const NARRATIVE_EXPLORATION_PRESETS: readonly PresetDefinition[] = [
  definePreset({
    id: 'exploration-game',
    displayName: 'Exploration Game',
    family: 'narrative-exploration',
    controllerFamilies: ['top-down'],
    requiredSystemPacks: [pack(PACK_IDS.world), pack(PACK_IDS.worldEntities)],
    optionalSystemPacks: [pack(PACK_IDS.narrative)],
    requiredContentRoles: ['tuning', 'levels'],
    validationProfile: VALIDATION_PROFILES.narrativeExploration,
    knownLimitations: [LIMITATIONS.worldGraphAndMap],
  }),

  definePreset({
    id: 'visual-novel',
    maturity: 'smoke-validated',
    displayName: 'Visual Novel',
    family: 'narrative-exploration',
    controllerFamilies: ['ui-simulation'],
    requiredSystemPacks: [pack(PACK_IDS.narrative)],
    optionalSystemPacks: [pack(PACK_IDS.progression)],
    requiredContentRoles: ['tuning', 'dialogue'],
    validationProfile: VALIDATION_PROFILES.narrativeExploration,
    knownLimitations: [
      'Narrative state exists, but no full content-authored branching dialogue renderer/portrait presentation system exists.',
    ],
  }),

  definePreset({
    id: 'point-and-click',
    displayName: 'Point and Click',
    family: 'narrative-exploration',
    controllerFamilies: ['pointer', 'ui-simulation'],
    requiredSystemPacks: [pack(PACK_IDS.narrative), pack(PACK_IDS.world), pack(PACK_IDS.worldEntities)],
    optionalSystemPacks: [pack(PACK_IDS.puzzle)],
    requiredContentRoles: ['tuning', 'levels', 'dialogue'],
    supportedInputModes: POINTER_INPUT_MODES,
    validationProfile: VALIDATION_PROFILES.narrativeExploration,
    knownLimitations: ['Spatial pointer position, hover targets, and world-coordinate click targeting remain unimplemented.'],
  }),

  definePreset({
    id: 'interactive-fiction-hybrid',
    displayName: 'Interactive Fiction Hybrid',
    family: 'narrative-exploration',
    controllerFamilies: ['ui-simulation'],
    requiredSystemPacks: [pack(PACK_IDS.narrative)],
    optionalSystemPacks: [pack(PACK_IDS.world)],
    requiredContentRoles: ['tuning', 'dialogue'],
    validationProfile: VALIDATION_PROFILES.narrativeExploration,
    knownLimitations: ['No dedicated parser/text-command system exists.'],
  }),

  definePreset({
    id: 'investigation-game',
    displayName: 'Investigation Game',
    family: 'narrative-exploration',
    controllerFamilies: ['top-down', 'pointer'],
    requiredSystemPacks: [pack(PACK_IDS.narrative), pack(PACK_IDS.world), pack(PACK_IDS.worldEntities)],
    optionalSystemPacks: [pack(PACK_IDS.puzzle)],
    requiredContentRoles: ['tuning', 'levels', 'dialogue'],
    supportedInputModes: POINTER_INPUT_MODES,
    validationProfile: VALIDATION_PROFILES.narrativeExploration,
    knownLimitations: ['No evidence-board/deduction/linking system exists.'],
  }),

  definePreset({
    id: 'museum-exhibit',
    displayName: 'Museum Exhibit',
    family: 'narrative-exploration',
    controllerFamilies: ['top-down', 'pointer'],
    requiredSystemPacks: [pack(PACK_IDS.world), pack(PACK_IDS.worldEntities)],
    optionalSystemPacks: [pack(PACK_IDS.narrative)],
    requiredContentRoles: ['tuning', 'levels', 'exhibits'],
    supportedInputModes: POINTER_INPUT_MODES,
    validationProfile: VALIDATION_PROFILES.narrativeExploration,
    knownLimitations: [
      'No dedicated exhibit/codex presentation framework exists beyond general world/narrative/UI foundations.',
    ],
  }),

  definePreset({
    id: 'escape-room',
    displayName: 'Escape Room',
    family: 'narrative-exploration',
    controllerFamilies: ['pointer', 'ui-simulation'],
    requiredSystemPacks: [pack(PACK_IDS.puzzle)],
    optionalSystemPacks: [pack(PACK_IDS.narrative), pack(PACK_IDS.world)],
    requiredContentRoles: ['tuning', 'puzzles'],
    supportedInputModes: POINTER_INPUT_MODES,
    validationProfile: VALIDATION_PROFILES.narrativeExploration,
    knownLimitations: [
      LIMITATIONS.puzzleConfigIsCode,
      'No content-authored escape-room puzzle grammar exists; spatial pointer remains limited.',
    ],
  }),
];
