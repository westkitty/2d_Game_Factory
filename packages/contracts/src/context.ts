import type { AccessibilityState } from './accessibility.ts';
import type { ActionInput } from './input.ts';
import type { AssetCatalog, ContentBundle } from './content.ts';
import type { AudioBus } from './audio.ts';
import type { CapabilityRegistry } from './systems.ts';
import type { DebugState } from './debug.ts';
import type { DisposableBag } from './disposable.ts';
import type { EventBus } from './events.ts';
import type { GameDefinition } from './game.ts';
import type { SaveStore, SettingsStore } from './persistence.ts';
import type { SceneRouter } from './scenes.ts';

/**
 * The one bounded dependency surface.
 *
 * Systems receive a GameContext instead of importing each other or reaching for
 * globals. Nothing in the runtime is reachable except through this object, which
 * is what keeps ownership acyclic and teardown provable.
 *
 * Hosts may extend this (see SceneContext in @sw2d/runtime) to add
 * engine-specific services for packs that render or simulate.
 */
export interface GameContext {
  readonly gameId: string;
  readonly definition: GameDefinition;
  readonly events: EventBus;
  readonly input: ActionInput;
  readonly settings: SettingsStore;
  readonly saves: SaveStore;
  readonly audio: AudioBus;
  /** Live projection of settings plus device capability. */
  readonly accessibility: AccessibilityState;
  readonly assets: AssetCatalog;
  readonly content: ContentBundle;
  readonly capabilities: CapabilityRegistry;
  readonly router: SceneRouter;
  readonly debug: DebugState;
  /** Context-lifetime teardown. Scene-scoped work uses the scene's own bag. */
  readonly disposables: DisposableBag;
}

/**
 * The game-specific extension boundary.
 *
 * Unique mechanics live in a generated game's `src/game-specific/` directory and
 * enter the runtime only through this hook. A game extension may consume stable
 * runtime services; it may not patch runtime internals. If three games need the
 * same extension, promote it to a reusable system pack.
 */
export interface GameExtension {
  readonly id: string;
  /** Register game-specific system packs, capabilities and debug sections. */
  setup(context: GameContext): void;
}
