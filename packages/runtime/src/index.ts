/**
 * @sw2d/runtime - the reusable machine.
 *
 * A generated game composes this package; it does not edit it. Ordinary game
 * work happens in content, themes and `src/game-specific/`. See
 * docs/architecture/ARCHITECTURE_OVERVIEW.md for the protected boundary.
 */
export { createGame, RUNTIME_VERSION, RUNTIME_GLOBAL_KEY } from './core/createGame.ts';
export type { CreateGameOptions, GameRuntime } from './core/createGame.ts';

export { CapabilityRegistryImpl, DuplicateCapabilityError, MissingCapabilityError } from './core/CapabilityRegistryImpl.ts';
export { DisposableBagImpl } from './core/DisposableBagImpl.ts';
export { EventBusImpl } from './core/EventBusImpl.ts';
export { SystemHostImpl } from './core/SystemHostImpl.ts';
export { resolveInstallOrder, SystemPackResolutionError } from './core/resolveInstallOrder.ts';

export { ActionInputHost } from './input/ActionInputHost.ts';
export { KeyboardAdapter } from './input/KeyboardAdapter.ts';
export { PointerAdapter } from './input/PointerAdapter.ts';
export { SpatialPointerHost, DRAG_THRESHOLD_PX } from './input/SpatialPointerHost.ts';
export type { WorldResolver, CanvasSpaceResolver } from './input/SpatialPointerHost.ts';
export { DEFAULT_BINDINGS, mergeBindings } from './input/defaultBindings.ts';

export {
  platformController,
  topDownController,
  vehicleController,
  gridController,
  pointerActionController,
  uiSimulationController,
} from './controllers/index.ts';

/**
 * Game support: shared, Phaser-coupled helpers that are neither a controller
 * (stateless intent translation) nor a system pack (renderer-independent
 * capability). Promoted only on proven, byte-identical duplication across
 * three or more real consumers - see projectilePool.ts's own note.
 */
export { ProjectilePool, type ProjectileOptions } from './game-support/projectilePool.ts';
export { InteractionServiceImpl, phaserBoundsShape } from './game-support/interactionService.ts';
export { bindCollectiblePickups, type CollectiblePickupBinding } from './game-support/itemPickups.ts';
export { createProjectileRuntime, type ProjectileRuntime, type ProjectileRuntimeOptions } from './game-support/projectileRuntime.ts';
export { bindStarterWeapon, type StarterWeaponBinding } from './game-support/starterWeapon.ts';
export {
  bindStarterEncounters,
  type StarterEncounterBinding,
  type StarterEncounterOptions,
  type StarterEncounterSnapshot,
} from './game-support/starterEncounters.ts';
export { createEncounterRuntime, type EncounterRuntime, type EncounterRuntimeOptions, type SpawnedEnemyHandle } from './game-support/encounterRuntime.ts';
export { resolveSceneLevel, type ResolvedSceneLevel } from './game-support/generatedLevel.ts';
export { createRoomTransitionRuntime, type RoomTransitionRuntime, type RoomTransitionHooks } from './game-support/roomTransition.ts';
export { createWorldMapOverlay, type WorldMapOverlay } from './game-support/worldMapOverlay.ts';
export { createAdvancedPhysics } from './game-support/advancedPhysics.ts';
export { createGrappleService } from './game-support/grappleService.ts';
export { bindStarterEconomy, type StarterEconomyBinding, type StarterEconomySnapshot } from './game-support/starterEconomy.ts';
export { bindStarterNeeds, type StarterNeedsBinding, type StarterNeedsSnapshot } from './game-support/starterNeeds.ts';
export { bindStarterDialogue, type StarterDialogueBinding, type StarterDialogueSnapshot } from './game-support/starterDialogue.ts';
export { bindStarterPerception, type StarterPerceptionBinding, type StarterPerceptionSnapshot } from './game-support/starterPerception.ts';
export { bindStarterBallPaddle, type StarterBallPaddleBinding, type StarterBallPaddleSnapshot } from './game-support/starterBallPaddle.ts';
export { bindStarterMelee, type StarterMeleeBinding, type StarterMeleeSnapshot } from './game-support/starterMelee.ts';
export { bindStarterLocalPlay, type StarterLocalPlayBinding, type StarterLocalPlaySnapshot } from './game-support/starterLocalPlay.ts';
export { bindStarterStageScroll, type StarterStageScrollBinding, type StarterStageScrollSnapshot } from './game-support/starterStageScroll.ts';
export { bindStarterPuzzle, type StarterPuzzleBinding, type StarterPuzzleSnapshot } from './game-support/starterPuzzle.ts';
export { bindStarterTiming, type StarterTimingBinding, type StarterTimingSnapshot } from './game-support/starterTiming.ts';
export {
  bindStarterSimulation,
  type StarterSimulationBinding,
  type StarterSimulationSnapshot,
  type SimulationStarterMode,
} from './game-support/starterSimulation.ts';
export {
  bindStarterNarrative,
  type StarterNarrativeBinding,
  type StarterNarrativeSnapshot,
  type NarrativeStarterMode,
} from './game-support/starterNarrative.ts';
export {
  bindStarterArcade,
  type StarterArcadeBinding,
  type StarterArcadeSnapshot,
  type ArcadeStarterMode,
} from './game-support/starterArcade.ts';
export {
  bindStarterPointer,
  type StarterPointerBinding,
  type StarterPointerSnapshot,
  type PointerStarterMode,
} from './game-support/starterPointer.ts';
export {
  bindStarterProgression,
  type StarterProgressionBinding,
  type StarterProgressionSnapshot,
  type ProgressionStarterMode,
} from './game-support/starterProgression.ts';
export {
  bindStarterStrategy,
  type StarterStrategyBinding,
  type StarterStrategySnapshot,
  type StrategyStarterMode,
} from './game-support/starterStrategy.ts';
export {
  bindStarterNavigation,
  type StarterNavigationBinding,
  type StarterNavigationSnapshot,
  type NavigationStarterMode,
} from './game-support/starterNavigation.ts';
export {
  bindStarterToy,
  type StarterToyBinding,
  type StarterToySnapshot,
  type ToyStarterMode,
} from './game-support/starterToy.ts';
export {
  bindStarterCombat,
  type StarterCombatBinding,
  type StarterCombatSnapshot,
  type CombatStarterMode,
} from './game-support/starterCombat.ts';
export {
  bindStarterRun,
  type StarterRunBinding,
  type StarterRunSnapshot,
  type RunStarterMode,
} from './game-support/starterRun.ts';
export {
  bindStarterVehicle,
  type StarterVehicleBinding,
  type StarterVehicleSnapshot,
  type VehicleStarterMode,
} from './game-support/starterVehicle.ts';
export {
  bindStarterPhysics,
  type StarterPhysicsBinding,
  type StarterPhysicsSnapshot,
  type PhysicsStarterMode,
} from './game-support/starterPhysics.ts';
export {
  bindStarterCommand,
  type StarterCommandBinding,
  type StarterCommandSnapshot,
  type CommandStarterMode,
} from './game-support/starterCommand.ts';
export {
  bindStarterLook,
  type StarterLookBinding,
  type StarterLookSnapshot,
  type LookStarterMode,
} from './game-support/starterLook.ts';
export {
  bindStarterParkour,
  type StarterParkourBinding,
  type StarterParkourSnapshot,
  type ParkourStarterMode,
} from './game-support/starterParkour.ts';
export {
  bindStarterKartItem,
  type StarterKartItemBinding,
  type StarterKartItemSnapshot,
} from './game-support/starterKartItem.ts';

export { LocalStorageDriver, MemoryStorageDriver } from './persistence/LocalStorageDriver.ts';
export { SaveStoreImpl } from './persistence/SaveStoreImpl.ts';
export {
  FACTORY_DEFAULT_SETTINGS,
  SETTINGS_SCHEMA_VERSION,
  SETTINGS_SLOT,
  SettingsStoreImpl,
  normaliseSettings,
} from './persistence/SettingsStoreImpl.ts';

export { AccessibilityStateImpl, readAccessibilityEnvironment } from './accessibility/AccessibilityStateImpl.ts';
export type { AccessibilityEnvironment } from './accessibility/AccessibilityStateImpl.ts';
export { WebAudioBus } from './audio/WebAudioBus.ts';

export { AssetCatalogImpl, UnknownAssetRoleError } from './content/AssetCatalogImpl.ts';
export { createGeneratedTextures, queueImageAssets } from './content/placeholderTextures.ts';
export { bindRoleAnimations, queueRoleAnimationFrames, registerRoleAnimations } from './content/roleAnimations.ts';

export { DebugStateImpl, DEBUG_SNAPSHOT_VERSION } from './debug/DebugStateImpl.ts';

export { BootScene } from './scenes/BootScene.ts';
export { PauseScene } from './scenes/PauseScene.ts';
export { PlayScene } from './scenes/PlayScene.ts';
export { TitleScene } from './scenes/TitleScene.ts';
export { SceneRouterImpl } from './scenes/SceneRouterImpl.ts';
export { createSceneContext } from './scenes/SceneContext.ts';
export type { SceneContext, ScenePackDefinition } from './scenes/SceneContext.ts';
export { RUNTIME_UI, accentStyle, headingStyle, mutedStyle } from './scenes/theme.ts';
