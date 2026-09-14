import type { PresetDefinition } from '@sw2d/contracts';
import { PACK_IDS } from '@sw2d/packs/ids';
import { POINTER_INPUT_MODES, VALIDATION_PROFILES, definePreset, pack } from '../shared.ts';

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
 * Branching and authored presentation live in `sw2d.dialogue`; typed parser
 * commands live in `sw2d.narrative`; evidence and exhibit metadata live in
 * `sw2d.codex`. Generated binders render each catalog without introducing a
 * second state owner.
 */
export const NARRATIVE_EXPLORATION_PRESETS: readonly PresetDefinition[] = [
  definePreset({
    id: 'exploration-game',
    maturity: 'proof-validated',
    displayName: 'Exploration Game',
    family: 'narrative-exploration',
    controllerFamilies: ['top-down'],
    requiredSystemPacks: [pack(PACK_IDS.world), pack(PACK_IDS.worldEntities), pack(PACK_IDS.worldGraph)],
    optionalSystemPacks: [pack(PACK_IDS.narrative)],
    requiredContentRoles: ['tuning', 'levels', 'world-graph'],
    validationProfile: VALIDATION_PROFILES.narrativeExploration,
    // Phase 8 (ADR-0025): areas, discovery/visited state, transitions and the map
    // are the reusable sw2d.world-graph capability + content/world-graph.json.
    knownLimitations: [],
  }),

  definePreset({
    id: 'visual-novel',
    maturity: 'proof-validated',
    displayName: 'Visual Novel',
    family: 'narrative-exploration',
    controllerFamilies: ['ui-simulation'],
    requiredSystemPacks: [pack(PACK_IDS.narrative), pack(PACK_IDS.dialogue)],
    optionalSystemPacks: [pack(PACK_IDS.progression)],
    requiredContentRoles: ['tuning', 'dialogue'],
    validationProfile: VALIDATION_PROFILES.narrativeExploration,
    knownLimitations: [],
  }),

  definePreset({
    id: 'point-and-click',
    maturity: 'proof-validated',
    displayName: 'Point and Click',
    family: 'narrative-exploration',
    controllerFamilies: ['pointer', 'ui-simulation'],
    requiredSystemPacks: [pack(PACK_IDS.narrative), pack(PACK_IDS.world), pack(PACK_IDS.worldEntities), pack(PACK_IDS.dialogue)],
    optionalSystemPacks: [pack(PACK_IDS.puzzle)],
    requiredContentRoles: ['tuning', 'levels', 'dialogue'],
    supportedInputModes: POINTER_INPUT_MODES,
    validationProfile: VALIDATION_PROFILES.narrativeExploration,
    // Spatial pointer position, hover targets and world-coordinate click/drag
    // targeting are implemented and consumed by the pointer shell (capability
    // program Phase 1, ADR-0018; proof: proofs/point-and-click/).
    knownLimitations: [],
  }),

  definePreset({
    id: 'interactive-fiction-hybrid',
    maturity: 'proof-validated',
    displayName: 'Interactive Fiction Hybrid',
    family: 'narrative-exploration',
    controllerFamilies: ['ui-simulation'],
    requiredSystemPacks: [pack(PACK_IDS.narrative)],
    optionalSystemPacks: [pack(PACK_IDS.world)],
    requiredContentRoles: ['tuning', 'dialogue'],
    validationProfile: VALIDATION_PROFILES.narrativeExploration,
    knownLimitations: [],
  }),

  definePreset({
    id: 'investigation-game',
    maturity: 'proof-validated',
    displayName: 'Investigation Game',
    family: 'narrative-exploration',
    controllerFamilies: ['top-down', 'pointer'],
    requiredSystemPacks: [pack(PACK_IDS.narrative), pack(PACK_IDS.world), pack(PACK_IDS.worldEntities), pack(PACK_IDS.codex)],
    optionalSystemPacks: [pack(PACK_IDS.puzzle)],
    requiredContentRoles: ['tuning', 'levels', 'dialogue', 'codex'],
    supportedInputModes: POINTER_INPUT_MODES,
    validationProfile: VALIDATION_PROFILES.narrativeExploration,
    knownLimitations: [],
  }),

  definePreset({
    id: 'museum-exhibit',
    maturity: 'proof-validated',
    displayName: 'Museum Exhibit',
    family: 'narrative-exploration',
    controllerFamilies: ['top-down', 'pointer'],
    requiredSystemPacks: [pack(PACK_IDS.world), pack(PACK_IDS.worldEntities), pack(PACK_IDS.codex)],
    optionalSystemPacks: [pack(PACK_IDS.narrative)],
    requiredContentRoles: ['tuning', 'levels', 'exhibits', 'codex'],
    supportedInputModes: POINTER_INPUT_MODES,
    validationProfile: VALIDATION_PROFILES.narrativeExploration,
    knownLimitations: [],
  }),

  definePreset({
    id: 'escape-room',
    maturity: 'proof-validated',
    displayName: 'Escape Room',
    family: 'narrative-exploration',
    controllerFamilies: ['pointer', 'ui-simulation'],
    requiredSystemPacks: [pack(PACK_IDS.puzzleRules)],
    optionalSystemPacks: [pack(PACK_IDS.narrative), pack(PACK_IDS.world)],
    requiredContentRoles: ['tuning', 'puzzles'],
    supportedInputModes: POINTER_INPUT_MODES,
    validationProfile: VALIDATION_PROFILES.narrativeExploration,
    // Wave 4 L25/L46: inspect hotspots, flag gates and completion live in
    // content/puzzles.json (`escape` kind) on sw2d.puzzle-rules.
    knownLimitations: [],
  }),
];
