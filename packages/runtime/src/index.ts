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
