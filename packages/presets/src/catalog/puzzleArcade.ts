import type { PresetDefinition } from '@sw2d/contracts';
import { PACK_IDS } from '@sw2d/packs/ids';
import { LIMITATIONS, POINTER_INPUT_MODES, VALIDATION_PROFILES, definePreset, pack } from '../shared.ts';

/**
 * Family E - Puzzle / arcade (recipes 33-42).
 *
 * The smallest honest controller per recipe (MASTER_PROJECT.md section 7),
 * not a uniform default: discrete board/cell recipes get `grid`, timing/
 * confirm-driven recipes get `ui-simulation`, ball-and-paddle recipes reuse
 * `top-down`'s continuous axis for paddle movement (ball motion is
 * `sw2d.ball-paddle`, see `LIMITATIONS.ballPaddleSystem`),
 * timing recipes consume `sw2d.timing` (visual reaction / beat windows,
 * ADR-0037), and the one recipe that is genuinely about pointer interaction
 * (`physics-puzzle`) gets `pointer`, honestly limited to press-style actions.
 *
 * Standard puzzle kinds (sokoban, switch/sequence, match, falling-block) are
 * content-authorable through `sw2d.puzzle-rules` + `content/puzzles.json`
 * (ADR-0023, Category-C Wave 9). `sokoban`, `match-puzzle` and
 * `falling-block-puzzle` consume that reusable service. `physics-puzzle`
 * still selects the foundational, code-configured `sw2d.puzzle` (Category-C
 * Wave 12 consumes that seam with a Matter ball-in-goal) and reuses
 * `LIMITATIONS.puzzleConfigIsCode` verbatim.
 */
export const PUZZLE_ARCADE_PRESETS: readonly PresetDefinition[] = [
  definePreset({
    id: 'sokoban',
    maturity: 'proof-validated',
    displayName: 'Sokoban',
    family: 'puzzle-arcade',
    controllerFamilies: ['grid'],
    requiredSystemPacks: [pack(PACK_IDS.puzzleRules)],
    requiredContentRoles: ['tuning', 'puzzles'],
    validationProfile: VALIDATION_PROFILES.puzzleArcade,
    // Phase 6 (ADR-0023): the entire push/goal ruleset - board, boxes, goals,
    // solved-detection, undo, reset - is the validated content/puzzles.json
    // document, driven by the reusable sw2d.puzzle-rules capability. No
    // game-specific rule code, no code-config seam.
    knownLimitations: [],
  }),

  definePreset({
    id: 'match-puzzle',
    maturity: 'proof-validated',
    displayName: 'Match Puzzle',
    family: 'puzzle-arcade',
    controllerFamilies: ['grid'],
    requiredSystemPacks: [pack(PACK_IDS.puzzleRules)],
    optionalSystemPacks: [pack(PACK_IDS.arcade)],
    requiredContentRoles: ['tuning', 'puzzles'],
    validationProfile: VALIDATION_PROFILES.puzzleArcade,
    // Final Product Completion Wave 4 (matrix L21/L22): pointer drag-swap via
    // the spatial pointer; keyboard swap remains. Match cascade lives in sw2d.puzzle-rules.
    knownLimitations: [],
  }),

  definePreset({
    id: 'falling-block-puzzle',
    maturity: 'proof-validated',
    displayName: 'Falling Block Puzzle',
    family: 'puzzle-arcade',
    controllerFamilies: ['grid', 'ui-simulation'],
    requiredSystemPacks: [pack(PACK_IDS.puzzleRules)],
    optionalSystemPacks: [pack(PACK_IDS.arcade)],
    requiredContentRoles: ['tuning', 'puzzles'],
    validationProfile: VALIDATION_PROFILES.puzzleArcade,
    // Final Product Completion Wave 4 (matrix L21): wall kicks + hard drop on
    // the reusable falling-block engine.
    knownLimitations: [],
  }),

  definePreset({
    id: 'breakout',
    maturity: 'proof-validated',
    displayName: 'Breakout',
    family: 'puzzle-arcade',
    controllerFamilies: ['top-down'],
    requiredSystemPacks: [pack(PACK_IDS.arcade), pack(PACK_IDS.ballPaddle)],
    requiredContentRoles: ['tuning', 'ball-paddle'],
    validationProfile: VALIDATION_PROFILES.puzzleArcade,
    knownLimitations: [LIMITATIONS.ballPaddleSystem],
  }),

  definePreset({
    id: 'pong',
    maturity: 'proof-validated',
    displayName: 'Pong',
    family: 'puzzle-arcade',
    controllerFamilies: ['top-down'],
    requiredSystemPacks: [pack(PACK_IDS.arcade), pack(PACK_IDS.ballPaddle), pack(PACK_IDS.localPlay)],
    requiredContentRoles: ['tuning', 'ball-paddle', 'local-play'],
    validationProfile: VALIDATION_PROFILES.puzzleArcade,
    knownLimitations: [LIMITATIONS.ballPaddleSystem, LIMITATIONS.localPlaySeats],
  }),

  definePreset({
    id: 'physics-puzzle',
    maturity: 'proof-validated',
    displayName: 'Physics Puzzle',
    family: 'puzzle-arcade',
    controllerFamilies: ['pointer'],
    requiredSystemPacks: [pack(PACK_IDS.puzzle)],
    requiredContentRoles: ['tuning'],
    supportedInputModes: POINTER_INPUT_MODES,
    validationProfile: VALIDATION_PROFILES.puzzleArcade,
    // Phase 9 (ADR-0026): the Matter backend + reusable AdvancedPhysicsService
    // drive motion; the puzzle's own success condition stays in sw2d.puzzle.
    physicsProfile: 'matter',
    knownLimitations: [LIMITATIONS.puzzleConfigIsCode],
  }),

  definePreset({
    id: 'maze-game',
    maturity: 'proof-validated',
    displayName: 'Maze Game',
    family: 'puzzle-arcade',
    controllerFamilies: ['grid'],
    requiredSystemPacks: [pack(PACK_IDS.world), pack(PACK_IDS.worldEntities), pack(PACK_IDS.navigation)],
    optionalSystemPacks: [pack(PACK_IDS.arcade)],
    requiredContentRoles: ['tuning', 'levels'],
    validationProfile: VALIDATION_PROFILES.puzzleArcade,
    knownLimitations: [
      'Grid pathfinding and walkable occupancy are reusable (sw2d.navigation); fog-of-war, minimap and authored maze generation are not.',
    ],
  }),

  definePreset({
    id: 'rhythm-action',
    maturity: 'proof-validated',
    displayName: 'Rhythm Action',
    family: 'puzzle-arcade',
    controllerFamilies: ['ui-simulation'],
    requiredSystemPacks: [pack(PACK_IDS.arcade), pack(PACK_IDS.timing)],
    requiredContentRoles: ['tuning', 'timing'],
    validationProfile: VALIDATION_PROFILES.puzzleArcade,
    knownLimitations: [LIMITATIONS.visualTiming],
  }),

  definePreset({
    id: 'reaction-timing',
    maturity: 'proof-validated',
    displayName: 'Reaction Timing',
    family: 'puzzle-arcade',
    controllerFamilies: ['ui-simulation'],
    requiredSystemPacks: [pack(PACK_IDS.arcade), pack(PACK_IDS.timing)],
    requiredContentRoles: ['tuning', 'timing'],
    validationProfile: VALIDATION_PROFILES.puzzleArcade,
    knownLimitations: [LIMITATIONS.visualTiming],
  }),

  definePreset({
    id: 'pinball-lite',
    maturity: 'proof-validated',
    displayName: 'Pinball Lite',
    family: 'puzzle-arcade',
    controllerFamilies: ['ui-simulation'],
    requiredSystemPacks: [pack(PACK_IDS.arcade), pack(PACK_IDS.pinball)],
    requiredContentRoles: ['tuning', 'pinball'],
    validationProfile: VALIDATION_PROFILES.puzzleArcade,
    // Phase 9 (ADR-0026): the Matter backend + reusable AdvancedPhysicsService
    // give the ball real rigid-body motion and collision. Wave 30 pinball-lite
    // consumes sw2d.pinball instead of the Matter table path.
    physicsProfile: 'matter',
    knownLimitations: [
      'Flippers, bumpers and bumper-score are reusable (sw2d.pinball); Matter presentation stays on physics-toy.',
    ],
  }),
];
