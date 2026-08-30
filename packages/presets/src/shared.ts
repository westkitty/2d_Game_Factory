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
  spatialAim:
    'Independent spatial/analog aim is not wired into this starter. The digital AIM_* axis (ADR-0016) is the aim path; the spatial pointer (ADR-0018) can supply an optional aim fallback but the generated top-down shell does not consume it.',
  stealthAi:
    'AI state exists, but full vision cones, awareness geometry, noise propagation and hiding are not implemented in this starter (reusable sw2d.ai-perception exists). Patrol/chase navigation can use sw2d.navigation (Phase 5).',
  weaponsProjectiles:
    'The reusable weapon/projectile capability (sw2d.weapons, ADR-0020) exists; this starter\'s shell does not wire it yet.',
  climbingMechanics:
    'Wall-slide, wall-jump and ledge-grab movement mechanics are not yet implemented as reusable capabilities in this starter (reusable sw2d.climbing exists); vertical movement must be authored as game-specific code, the same pattern starter/src/game-specific/ demonstrates.',
  puzzleConfigIsCode:
    "Standard puzzle kinds (sokoban, switch/sequence) are now content-authorable through the sw2d.puzzle-rules capability and content/puzzles.json (ADR-0023). This recipe's board rules are not one of those built-in kinds, so it still uses the code seam: sw2d.puzzle declares configSource: 'code' (ADR-0017) and a generated game supplies createInitialState/isSolved from src/game-specific/packConfig.ts (shipped with a working placeholder to replace) - the pack really installs, but this puzzle's own rules stay game-specific TypeScript, not content.",
  chasePressure:
    'The reusable pursuit pressure capability (sw2d.ai-perception, ai.pursuit) exists; this starter shell uses game-specific pressure tracking.',
  // Phase 7B additions - each reused by two or more recipes; a recipe-specific gap gets an
  // inline string in its own catalog file instead (see platforming.ts's own comment on why:
  // sharing text is a decision, not laziness, and inline is correct when nothing else repeats it).
  // Post-ten Phase 16 narrowed this. The simulation is reusable now
  // (sw2d.ball-paddle, arcade.ball-paddle, ADR-0030); what stays honest to
  // record is that its safety story is bounded substeps, not universal CCD.
  ballPaddleSystem:
    'Ball/paddle serve, wall and paddle bounce, hit-location steering, brick damage, goals and match rules are reusable through sw2d.ball-paddle (arcade.ball-paddle). Collision safety is bounded substepping within the definition\'s declared speed range - not universal continuous collision detection; a definition beyond that range is rejected at install rather than silently tunnelling.',
  // Phase 7C additions - same "two or more recipes" bar as Phase 7B's four.
  // Post-ten Phase 19 closed most of this. Goods, transactions, production
  // chains, stations, placement validation, customer arrival/queue/service and
  // prestige are reusable now (sw2d.economy); what stays out is the *presentation*
  // of a floor plan and any pathfinding a customer would need to walk it.
  customerEconomy:
    'Goods, stock, prices, transactions, production recipes on stations, station placement validation, customer arrival/queue/service and prestige are reusable through sw2d.economy (simulation.economy, simulation.production). Customers are a phase machine on simulation time, not agents walking a floor: placement checks zone, overlap and an authored access point, and pathfinding when a game needs it is sw2d.navigation. Floor-plan presentation stays starter-specific.',
  // Post-ten Phase 19 addition, split out of customerEconomy: what a restaurant
  // still lacks once the customer/order/economy foundation exists.
  cookingSequences:
    'The customer, order and economy foundation is reusable through sw2d.economy; the cooking action sequence itself - timed steps at a station with success windows - is not implemented yet.',
  // Post-ten Phase 19 addition. Replaces idle-incremental's inline claim that
  // offline catch-up and prestige "are not production systems".
  idleEconomy:
    'Deterministic passive production, bounded offline catch-up against an injected wall clock, and prestige with authored reset/retain scopes are reusable through sw2d.economy (simulation.economy, simulation.production). Catch-up aggregates whole completed batches rather than replaying frames, and is clamped by an authored maximum; large multi-currency economy balancing remains authoring work, not a system.',
  // Post-ten Phase 18 narrowed this. Needs, utility behaviour, schedules,
  // relationships and work orders are reusable now (sw2d.simulation-agents);
  // what stays honest to record is that agent *presentation* and the world an
  // agent moves through remain starter-specific.
  creatureSimulation:
    'Needs, utility-scored behaviour, schedules, relationships and work-order reservations are reusable through sw2d.simulation-agents (simulation.agents). Need ids, behaviours and relationship metrics are all authored content - the capability assumes no vocabulary of its own. Agent presentation, and moving an agent through a particular world, stay starter-specific; pathfinding when needed is sw2d.navigation.',
  // Capability program Phase 14 addition. Order issue/queue/cancel/lifecycle is
  // reusable (sw2d.strategy-actions); what stays starter-specific is the *input*
  // surface that turns a drag rectangle into a set of actor ids.
  // Post-ten Phase 17 addition, shared by rhythm-action and reaction-timing.
  // The capability is real; what stays honest to record is that the game must
  // supply the transport, and that no music-authoring tooling ships with it.
  rhythmTransport:
    'Chart judgement, judgement windows, combo/accuracy scoring, bounded calibration and the seeded reaction state machine are reusable through sw2d.rhythm (arcade.rhythm, arcade.reaction). Charts are judged against an audio transport the game supplies (audio.transport); the runtime ships a browser transport reading AudioContext.currentTime, and degrades to the page clock when Web Audio is unavailable. No music-authoring or waveform tooling ships with this - a chart is authored as content/rhythm.json.',
  // Post-ten Phase 15 addition. Local player routing is reusable
  // (sw2d runtime PlayerInputHub, input.players); what stays honest to record is
  // that same-device multi-touch multiplayer was not built.
  localTouchMultiplayer:
    'Local multiplayer input routing is reusable (input.players): each player gets an isolated semantic ActionInput driven by its own keyboard profile or gamepad. Same-device multi-touch multiplayer is NOT implemented - one touch-controlled player plus keyboard/gamepad players is the supported shape.',
  rtsSelectionUi:
    'Unit orders (move, attack, attack-move, hold, stop, queued and replacement commands) are reusable through sw2d.strategy-actions (strategy.orders); box-select drag input and a command-card UI are still starter-specific.',
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
