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
 * Standard puzzle kinds (sokoban, switch/sequence) are content-authorable
 * through `sw2d.puzzle-rules` + `content/puzzles.json` as of the capability
 * program's Phase 6 (ADR-0023): `sokoban` here consumes that reusable service
 * and carries no puzzle limitation. Recipes whose board rules are not a
 * built-in kind (`match-puzzle`, `falling-block-puzzle`, `physics-puzzle`)
 * still select the foundational, code-configured `sw2d.puzzle` and reuse
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
    displayName: 'Match Puzzle',
    family: 'puzzle-arcade',
    controllerFamilies: ['grid'],
    requiredSystemPacks: [pack(PACK_IDS.puzzle)],
    optionalSystemPacks: [pack(PACK_IDS.arcade)],
    requiredContentRoles: ['tuning'],
    validationProfile: VALIDATION_PROFILES.puzzleArcade,
    knownLimitations: [
      LIMITATIONS.puzzleConfigIsCode,
      'The bounded `match` engine exists in sw2d.puzzle-rules (Phase 6, ADR-0023) and is unit-tested, but no reusable match-detection/cascade board rules are consumed by this recipe yet - it stays on the code-configured sw2d.puzzle.',
      'The reusable spatial pointer (world cursor, hover, drag - ADR-0018) exists; this grid-family recipe does not consume it, so tile drag/swap interaction is game-specific code.',
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
    // Post-ten Phase 16: the ball/paddle simulation is reusable now
    // (sw2d.ball-paddle, ADR-0030; proof: proofs/breakout/).
    requiredSystemPacks: [pack(PACK_IDS.arcade), pack(PACK_IDS.ballPaddle)],
    requiredContentRoles: ['tuning', 'ball-paddle'],
    validationProfile: VALIDATION_PROFILES.puzzleArcade,
    knownLimitations: [LIMITATIONS.ballPaddleSystem],
  }),

  definePreset({
    id: 'pong',
    displayName: 'Pong',
    family: 'puzzle-arcade',
    controllerFamilies: ['top-down'],
    // Post-ten Phase 15 supplied the two-player input routing (input.players);
    // Phase 16 supplies the ball and paddles (sw2d.ball-paddle, ADR-0030).
    // Proof: proofs/pong/.
    requiredSystemPacks: [pack(PACK_IDS.arcade), pack(PACK_IDS.ballPaddle)],
    requiredContentRoles: ['tuning', 'players', 'ball-paddle'],
    validationProfile: VALIDATION_PROFILES.puzzleArcade,
    knownLimitations: [LIMITATIONS.ballPaddleSystem, LIMITATIONS.localTouchMultiplayer],
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
    // Phase 9 (ADR-0026): the Matter backend + reusable AdvancedPhysicsService
    // drive motion; the puzzle's own success condition stays in sw2d.puzzle.
    physicsProfile: 'matter',
    knownLimitations: [LIMITATIONS.puzzleConfigIsCode],
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
    // Phase 9 (ADR-0026): the Matter backend + reusable AdvancedPhysicsService
    // give the ball real rigid-body motion and collision.
    physicsProfile: 'matter',
    knownLimitations: [
      'A full pinball table (flippers, bumpers, scoring lanes) is game-specific code on top of the Matter ball + static collision the shell provides.',
    ],
  }),
];
