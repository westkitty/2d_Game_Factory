import { SCENE_KEYS, type ControllerFamily, type InputMode, type PresetDefinition, type PresetMaturity, type SystemPackSelection } from '@sw2d/contracts';

/**
 * Shared preset-authoring helpers.
 *
 * Not a framework - a small function plus some named constants, so 27
 * recipes stay honest and consistent without becoming 27 near-identical
 * class bodies. Every field a recipe does not pass explicitly gets a real,
 * currently-true default (never a placeholder): `defaultConfig: {}` because
 * nothing in the repository consumes `PresetDefinition.defaultConfig` yet
 * (MASTER_PROJECT.md section 11: "{} is acceptable"), `starterScene:
 * SCENE_KEYS.play` because every generated game boots into the one real
 * PlayScene regardless of preset - genre identity comes from which packs and
 * controller families PlayScene installs, not from a preset-specific scene.
 */

/**
 * One per family - Phase 7A registered three (platforming, top-down action,
 * shooter); Phase 7B added three more (vehicle/movement, puzzle/arcade,
 * strategy/defense); Phase 7C adds the final three (simulation/management,
 * narrative/exploration, party/toy/weird) - nine total, matching the nine
 * registered families exactly, per MASTER_PROJECT.md section 14's
 * bounded-set rule. Not one per recipe - no family's recipes differ from
 * each other at the validation-profile level yet, so a tenth profile would
 * be decoration.
 */
export const VALIDATION_PROFILES = {
  platform: 'platform-recipe',
  topDown: 'top-down-action-recipe',
  shooter: 'shooter-recipe',
  vehicleMovement: 'vehicle-movement-recipe',
  puzzleArcade: 'puzzle-arcade-recipe',
  strategyDefense: 'strategy-defense-recipe',
  simulationManagement: 'simulation-management-recipe',
  narrativeExploration: 'narrative-exploration-recipe',
  partyToyWeird: 'party-toy-weird-recipe',
} as const;

export type ValidationProfileId = (typeof VALIDATION_PROFILES)[keyof typeof VALIDATION_PROFILES];

export const ALL_VALIDATION_PROFILES: readonly ValidationProfileId[] = Object.values(VALIDATION_PROFILES);

/**
 * Verified-supported input modes (OPERATIONAL_STATE.md: keyboard + DOM touch
 * both drive semantic input today). 'gamepad' is never included here -
 * feasibility is still unknown (OPERATIONAL_STATE.md "Unknown") and claiming
 * it would violate MASTER_PROJECT.md section 13's input-mode honesty rule.
 */
export const BASE_INPUT_MODES: readonly InputMode[] = ['keyboard', 'touch'];

/**
 * For recipes whose controller family is `pointer`. `pointer` here means the
 * mouse/pointer *device* (InputMode) is usable, honestly limited to the
 * press-style actions `pointerActionController` actually exposes. The reusable
 * spatial interaction capability (world cursor, hover, drag - ADR-0018) exists
 * as of the capability program's Phase 1, and the generated `pointer` shell
 * consumes it; a recipe with a *further* spatial gap (drawing strokes,
 * wardrobe attachment, ...) still states that in its knownLimitations.
 */
export const POINTER_INPUT_MODES: readonly InputMode[] = ['keyboard', 'pointer', 'touch'];

/** Recorded, reused verbatim wherever more than one recipe shares the same real gap. Keeps wording from drifting across recipes that share a limitation. */
export const LIMITATIONS = {
  grapplingPhysics: 'No advanced rope/constraint/grappling physics exists yet.',
  spatialAim:
    'Independent spatial/analog aim is not wired into this starter. The digital AIM_* axis (ADR-0016) is the aim path; the spatial pointer (ADR-0018) can supply an optional aim fallback but the generated top-down shell does not consume it.',
  stealthAi:
    'AI state exists, but full vision cones, awareness geometry, noise propagation and hiding are not implemented. Patrol/chase navigation can use sw2d.navigation (Phase 5).',
  weaponsProjectiles:
    'The reusable weapon/projectile capability (sw2d.weapons, ADR-0020) exists; this starter\'s shell does not wire it yet.',
  worldGraphAndMap:
    'A world graph, room transitions and a map system are not yet implemented; only flat single-level Tiled maps plus world flags/checkpoints exist (Phase 6).',
  climbingMechanics:
    'Wall-slide, wall-jump and ledge-grab movement mechanics are not yet implemented as reusable capabilities (MASTER_PROJECT.md section 9.2); vertical movement must be authored as game-specific code, the same pattern starter/src/game-specific/ demonstrates.',
  puzzleConfigIsCode:
    "Standard puzzle kinds (sokoban, switch/sequence) are now content-authorable through the sw2d.puzzle-rules capability and content/puzzles.json (ADR-0023). This recipe's board rules are not one of those built-in kinds, so it still uses the code seam: sw2d.puzzle declares configSource: 'code' (ADR-0017) and a generated game supplies createInitialState/isSolved from src/game-specific/packConfig.ts (shipped with a working placeholder to replace) - the pack really installs, but this puzzle's own rules stay game-specific TypeScript, not content.",
  chasePressure:
    'A reusable chase/pursuit-pressure system does not exist yet; it must be authored as game-specific code, the same pattern starter/src/game-specific/ demonstrates.',
  // Phase 7B additions - each reused by two or more recipes; a recipe-specific gap gets an
  // inline string in its own catalog file instead (see platforming.ts's own comment on why:
  // sharing text is a decision, not laziness, and inline is correct when nothing else repeats it).
  vehicleIntentOnly:
    'The vehicle controller supplies steering/throttle/brake intent only; no reusable vehicle-physics/drift/handling system exists.',
  raceOrchestration: 'Lap/checkpoint/time-trial race orchestration is not a dedicated reusable system yet.',
  advancedPhysics: 'Optional advanced rigid-body/constraint physics has not been implemented.',
  ballPaddleSystem: 'No reusable ball/paddle collision-and-bounce system exists yet.',
  // Phase 7C additions - same "two or more recipes" bar as Phase 7B's four.
  customerEconomy:
    'No complete customer AI, demand/economy model, queue/placement UI, or content-authored production chain exists.',
  creatureSimulation:
    'No reusable needs/behavior/relationship/creature simulation exists beyond foundational resources/state.',
} as const;

export interface PresetSpec {
  readonly id: string;
  readonly displayName: string;
  readonly family: string;
  readonly controllerFamilies: readonly ControllerFamily[];
  readonly requiredSystemPacks: readonly SystemPackSelection[];
  readonly optionalSystemPacks?: readonly SystemPackSelection[];
  readonly requiredContentRoles: readonly string[];
  readonly supportedInputModes?: readonly InputMode[];
  readonly validationProfile: ValidationProfileId;
  readonly knownLimitations?: readonly string[];
  /** Defaults to 'recipe'. Only set to 'smoke-validated' once a real, committed browser smoke test passes (Phase 8's twelve demos) - never hand-waved. */
  readonly maturity?: PresetMaturity;
}

/** A bare pack reference with no config - honest when no preset-level tuning is consumed yet (MASTER_PROJECT.md section 11). */
export function pack(packId: string): SystemPackSelection {
  return { packId };
}

export function definePreset(spec: PresetSpec): PresetDefinition {
  return {
    id: spec.id,
    displayName: spec.displayName,
    family: spec.family,
    maturity: spec.maturity ?? 'recipe',
    controllerFamilies: spec.controllerFamilies,
    requiredSystemPacks: spec.requiredSystemPacks,
    optionalSystemPacks: spec.optionalSystemPacks ?? [],
    defaultConfig: {},
    requiredContentRoles: spec.requiredContentRoles,
    supportedInputModes: spec.supportedInputModes ?? BASE_INPUT_MODES,
    starterScene: SCENE_KEYS.play,
    validationProfile: spec.validationProfile,
    knownLimitations: spec.knownLimitations ?? [],
  };
}
