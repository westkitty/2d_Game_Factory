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
