import type { PresetDefinition } from '@sw2d/contracts';
import { PACK_IDS } from '@sw2d/packs/ids';
import { LIMITATIONS, POINTER_INPUT_MODES, VALIDATION_PROFILES, definePreset, pack } from '../shared.ts';

/**
 * Family E - Puzzle / arcade (recipes 33-42).
 *
 * The smallest honest controller per recipe (MASTER_PROJECT.md section 7),
 * not a uniform default: discrete board/cell recipes get `grid`, timing/
 * confirm-driven recipes get `ui-simulation`, ball-and-paddle recipes reuse
 * `top-down`'s continuous axis for paddle movement only (not for the ball -
 * there is no reusable ball/paddle system, see `LIMITATIONS.ballPaddleSystem`),
 * and the one recipe that is genuinely about pointer interaction
 * (`physics-puzzle`) gets `pointer`, honestly limited to press-style actions.
 *
 * `sw2d.puzzle` is a foundational, code-configured capability, not a genre
 * system (`LIMITATIONS.puzzleConfigIsCode`, already established in Phase 7A
 * for `puzzle-platformer` - reused verbatim here for every recipe that
 * selects it).
 */
export const PUZZLE_ARCADE_PRESETS: readonly PresetDefinition[] = [
  definePreset({
    id: 'sokoban',
    displayName: 'Sokoban',
    family: 'puzzle-arcade',
    controllerFamilies: ['grid'],
    requiredSystemPacks: [pack(PACK_IDS.puzzle)],
    requiredContentRoles: ['tuning'],
    validationProfile: VALIDATION_PROFILES.puzzleArcade,
    knownLimitations: [LIMITATIONS.puzzleConfigIsCode, 'Pushing/goal rules are not yet a reusable content system.'],
  }),

  definePreset({
    id: 'match-puzzle',
    displayName: 'Match Puzzle',
    family: 'puzzle-arcade',
    controllerFamilies: ['grid'],
    requiredSystemPacks: [pack(PACK_IDS.puzzle)],
    optionalSystemPacks: [pack(PACK_IDS.arcade)],
    requiredContentRoles: ['tuning'],
    validationProfile: VALIDATION_PROFILES.puzzleArcade,
    knownLimitations: [
      LIMITATIONS.puzzleConfigIsCode,
      'No reusable match-detection/cascade board rules exist yet.',
      'Drag/hover interaction remains unavailable: spatial pointer support (world cursor, hover, drag) remains deferred.',
    ],
  }),

  definePreset({
    id: 'falling-block-puzzle',
    displayName: 'Falling Block Puzzle',
    family: 'puzzle-arcade',
    controllerFamilies: ['grid', 'ui-simulation'],
    requiredSystemPacks: [pack(PACK_IDS.puzzle)],
    optionalSystemPacks: [pack(PACK_IDS.arcade)],
    requiredContentRoles: ['tuning'],
    validationProfile: VALIDATION_PROFILES.puzzleArcade,
    knownLimitations: [LIMITATIONS.puzzleConfigIsCode, 'No reusable falling-piece/line-clear board engine exists yet.'],
  }),

  definePreset({
    id: 'breakout',
    displayName: 'Breakout',
    family: 'puzzle-arcade',
    controllerFamilies: ['top-down'],
    requiredSystemPacks: [pack(PACK_IDS.arcade)],
    requiredContentRoles: ['tuning'],
    validationProfile: VALIDATION_PROFILES.puzzleArcade,
    knownLimitations: [LIMITATIONS.ballPaddleSystem],
  }),

  definePreset({
    id: 'pong',
    displayName: 'Pong',
    family: 'puzzle-arcade',
    controllerFamilies: ['top-down'],
    requiredSystemPacks: [pack(PACK_IDS.arcade)],
    requiredContentRoles: ['tuning'],
    validationProfile: VALIDATION_PROFILES.puzzleArcade,
    knownLimitations: [LIMITATIONS.ballPaddleSystem, 'Pong does not yet have a proven multi-player input-routing abstraction.'],
  }),

  definePreset({
    id: 'physics-puzzle',
    displayName: 'Physics Puzzle',
    family: 'puzzle-arcade',
    controllerFamilies: ['pointer'],
    requiredSystemPacks: [pack(PACK_IDS.puzzle)],
    requiredContentRoles: ['tuning'],
    supportedInputModes: POINTER_INPUT_MODES,
    validationProfile: VALIDATION_PROFILES.puzzleArcade,
    knownLimitations: [LIMITATIONS.puzzleConfigIsCode, LIMITATIONS.advancedPhysics],
  }),

  definePreset({
    id: 'maze-game',
    displayName: 'Maze Game',
    family: 'puzzle-arcade',
    controllerFamilies: ['grid'],
    requiredSystemPacks: [pack(PACK_IDS.world), pack(PACK_IDS.worldEntities)],
    optionalSystemPacks: [pack(PACK_IDS.arcade)],
    requiredContentRoles: ['tuning', 'levels'],
    validationProfile: VALIDATION_PROFILES.puzzleArcade,
  }),

  definePreset({
    id: 'rhythm-action',
    displayName: 'Rhythm Action',
    family: 'puzzle-arcade',
    controllerFamilies: ['ui-simulation'],
    requiredSystemPacks: [pack(PACK_IDS.arcade)],
    requiredContentRoles: ['tuning'],
    validationProfile: VALIDATION_PROFILES.puzzleArcade,
    knownLimitations: ['No deterministic music-beat/audio-synchronization system exists yet.'],
  }),

  definePreset({
    id: 'reaction-timing',
    displayName: 'Reaction Timing',
    family: 'puzzle-arcade',
    controllerFamilies: ['ui-simulation'],
    requiredSystemPacks: [pack(PACK_IDS.arcade)],
    requiredContentRoles: ['tuning'],
    validationProfile: VALIDATION_PROFILES.puzzleArcade,
    knownLimitations: ['Arcade timing state exists, but no specialized reaction-test flow is implemented.'],
  }),

  definePreset({
    id: 'pinball-lite',
    displayName: 'Pinball Lite',
    family: 'puzzle-arcade',
    controllerFamilies: ['ui-simulation'],
    requiredSystemPacks: [pack(PACK_IDS.arcade)],
    requiredContentRoles: ['tuning'],
    validationProfile: VALIDATION_PROFILES.puzzleArcade,
    knownLimitations: [LIMITATIONS.advancedPhysics],
  }),
];
