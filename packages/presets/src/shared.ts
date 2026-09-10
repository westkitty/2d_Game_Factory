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
  stealthAi:
    'Vision cones, occlusion, suspicion, noise and hiding are reusable (sw2d.perception); patrol pathfinding, takedowns and full stealth AI are not.',
  weaponsProjectiles:
    'The reusable weapon/projectile capability (sw2d.weapons, ADR-0020) exists; this starter\'s shell does not wire it yet.',
  climbingMechanics:
    'Wall-slide, wall-jump and ledge-grab movement mechanics are not yet implemented as reusable capabilities (MASTER_PROJECT.md section 9.2); vertical movement must be authored as game-specific code, the same pattern starter/src/game-specific/ demonstrates.',
  puzzleConfigIsCode:
    "Standard puzzle kinds (sokoban, switch/sequence) are now content-authorable through the sw2d.puzzle-rules capability and content/puzzles.json (ADR-0023). This recipe's board rules are not one of those built-in kinds, so it still uses the code seam: sw2d.puzzle declares configSource: 'code' (ADR-0017) and a generated game supplies createInitialState/isSolved from src/game-specific/packConfig.ts (shipped with a working placeholder to replace) - the pack really installs, but this puzzle's own rules stay game-specific TypeScript, not content.",
  chasePressure:
    'A reusable chase/pursuit-pressure system does not exist yet; it must be authored as game-specific code, the same pattern starter/src/game-specific/ demonstrates.',
  scrollingShmupCamera:
    'Horizontal and vertical scrolling-stage camera movement, player band clamp, streaming hazards and stage-clear are reusable (sw2d.stage-scroll); rail-path cameras, parallax authoring and bullet-hell pooling are not.',
  // Phase 7B additions - each reused by two or more recipes; a recipe-specific gap gets an
  // inline string in its own catalog file instead (see platforming.ts's own comment on why:
  // sharing text is a decision, not laziness, and inline is correct when nothing else repeats it).
  ballPaddleSystem:
    'Ball, paddle, rebound, brick-clear and first-to-N scoring are reusable (sw2d.ball-paddle); a full pinball table is not.',
  localPlaySeats:
    'Local hot-seat turns and simultaneous versus axes are reusable (sw2d.local-play); netcode, gamepads, split-screen cameras and more than two seats are not.',
  // Phase 7C additions - same "two or more recipes" bar as Phase 7B's four.
  customerEconomy:
    'Customer demand, queue, stock, transactions and production jobs are reusable (sw2d.economy); shop layout, walking customers, prestige and offline catch-up are not.',
  creatureSimulation:
    'Needs, decay, care actions, affinity and wellbeing hold/fail are reusable (sw2d.needs); full creature behaviour AI, relationship graphs and colony assignment are not.',
  dialoguePresentation:
    'Branching dialogue graphs, choices, flags and endings are reusable (sw2d.dialogue); portraits, scene composition, parser IF and evidence-board deduction are not.',
  meleeCombat:
    'Melee strike, knockback, hit-stun and contact damage are reusable (sw2d.melee); combo strings, directional attacks and targeting UI are not.',
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
  /** Capability program Phase 9: 'matter' opts the generated game into the Matter backend. */
  readonly physicsProfile?: 'matter';
  /** Capability program Phase 10: default vehicle profile the generated content/vehicles.json uses. */
  readonly vehicleProfile?: 'car' | 'kart' | 'boat' | 'flight';
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
    ...(spec.physicsProfile ? { physicsProfile: spec.physicsProfile } : {}),
    ...(spec.vehicleProfile ? { vehicleProfile: spec.vehicleProfile } : {}),
  };
}
