/**
 * @sw2d/packs - reusable, renderer-independent system pack cores.
 *
 * Nine Phase 4 families: combat, AI, world, progression, arcade, puzzle,
 * simulation, narrative, strategy. Each is a foundational capability
 * service, not a full genre implementation - see the per-family doc comment
 * in its own file for exactly what is and is not in scope.
 *
 * No Phaser dependency: packs interact with the game only through
 * `GameContext` (events, capabilities) established in @sw2d/contracts.
 */
// Side-effect-free type-only module augmentation: this package's gameplay
// events are merged into @sw2d/contracts' GameEventMap here, not declared
// inside the dependency-free core (ADR-0012).
import './events.ts';

export { PACK_IDS, CAPABILITY_IDS } from './ids.ts';

export {
  combatPack,
  UnknownCombatEntityError,
  DuplicateCombatEntityError,
  type CombatService,
  type HealthState,
} from './combat/combatPack.ts';

export {
  aiPack,
  AI_STATES,
  UnknownAiAgentError,
  DuplicateAiAgentError,
  InvalidAiStateError,
  type AiService,
  type AiState,
} from './ai/aiPack.ts';

export { worldPack, type WorldService } from './world/worldPack.ts';

export {
  entityRegistryPack,
  DuplicateEntityFactoryError,
  type EntityFactory,
  type EntityRegistry,
} from './world/entityRegistryPack.ts';

export {
  progressionPack,
  PROGRESSION_CONFIG_SCHEMA_ID,
  type ProgressionConfig,
  type ProgressionService,
} from './progression/progressionPack.ts';

export {
  arcadePack,
  ARCADE_CONFIG_SCHEMA_ID,
  type ArcadeConfig,
  type ArcadeService,
} from './arcade/arcadePack.ts';

export { puzzlePack, type PuzzleConfig, type PuzzleService } from './puzzle/puzzlePack.ts';

export {
  simulationPack,
  DuplicateSimulationJobError,
  UnknownSimulationJobError,
  type SimulationJob,
  type SimulationService,
} from './simulation/simulationPack.ts';

export { narrativePack, type NarrativeService } from './narrative/narrativePack.ts';

export {
  strategyPack,
  DuplicateTeamError,
  NoTeamsRegisteredError,
  type StrategyService,
} from './strategy/strategyPack.ts';

export { itemsPack, ITEMS_SAVE_SLOT, UnknownItemError, type ItemsService } from './items/itemsPack.ts';
export { weaponsPack, UnknownWeaponError, type WeaponsService } from './weapons/weaponsPack.ts';
export { encountersPack, UnknownEncounterError, type EncounterService } from './encounters/encountersPack.ts';
export { navigationPack, type NavService, type NavGrid } from './navigation/navigationPack.ts';
export { puzzleRulesPack, UnknownPuzzleError, type PuzzleRulesService } from './puzzleRules/puzzleRulesPack.ts';
export { generationPack, type GenerationService } from './generation/generationPack.ts';
export { worldGraphPack, WORLD_GRAPH_SAVE_SLOT, type WorldGraphConfig, type WorldGraphService } from './worldGraph/worldGraphPack.ts';
export { vehiclesPack, type VehicleService } from './vehicles/vehiclesPack.ts';
export { racingPack, RACING_SAVE_SLOT, type RacingConfig, type RaceService } from './racing/racingPack.ts';
export { economyPack, type EconomyService } from './economy/economyPack.ts';
export { needsPack, type NeedsService } from './needs/needsPack.ts';
export { dialoguePack, type DialogueService } from './dialogue/dialoguePack.ts';
export { perceptionPack, type PerceptionService } from './perception/perceptionPack.ts';
export { ballPaddlePack, type BallPaddleService } from './ballPaddle/ballPaddlePack.ts';
export { meleePack, type MeleeService } from './melee/meleePack.ts';
export { localPlayPack, type LocalPlayService } from './localPlay/localPlayPack.ts';
export { stageScrollPack, type StageScrollService } from './stageScroll/stageScrollPack.ts';
export { timingPack, type TimingService } from './timing/timingPack.ts';
export { wallPack, type WallService } from './wall/wallPack.ts';
export { territoryPack, type TerritoryService } from './territory/territoryPack.ts';
export { pinballPack, type PinballService } from './pinball/pinballPack.ts';
export { cameraPack, type CameraService } from './camera/cameraPack.ts';
export { codexPack, type CodexService } from './codex/codexPack.ts';
export { targetingPack, type TargetingService } from './targeting/targetingPack.ts';
