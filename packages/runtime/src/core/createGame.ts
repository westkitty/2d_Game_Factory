import Phaser from 'phaser';
import {
  type ContentBundle,
  type ContentSource,
  type DebugSnapshot,
  type Disposable,
  type GameContext,
  type GameDefinition,
  type GameExtension,
  type PackConfigValidator,
  type StorageDriver,
} from '@sw2d/contracts';
import { AccessibilityStateImpl } from '../accessibility/AccessibilityStateImpl.ts';
import { WebAudioBus } from '../audio/WebAudioBus.ts';
import { AssetCatalogImpl } from '../content/AssetCatalogImpl.ts';
import { DebugStateImpl } from '../debug/DebugStateImpl.ts';
import { ActionInputHost } from '../input/ActionInputHost.ts';
import { KeyboardAdapter } from '../input/KeyboardAdapter.ts';
import { PointerAdapter } from '../input/PointerAdapter.ts';
import { mergeBindings } from '../input/defaultBindings.ts';
import { LocalStorageDriver } from '../persistence/LocalStorageDriver.ts';
import { SaveStoreImpl } from '../persistence/SaveStoreImpl.ts';
import { SettingsStoreImpl } from '../persistence/SettingsStoreImpl.ts';
import { BootScene } from '../scenes/BootScene.ts';
import { PauseScene } from '../scenes/PauseScene.ts';
import { PlayScene } from '../scenes/PlayScene.ts';
import { SceneRouterImpl } from '../scenes/SceneRouterImpl.ts';
import { TitleScene } from '../scenes/TitleScene.ts';
import type { ScenePackDefinition } from '../scenes/SceneContext.ts';
import { RUNTIME_UI } from '../scenes/theme.ts';
import { CapabilityRegistryImpl } from './CapabilityRegistryImpl.ts';
import { DisposableBagImpl } from './DisposableBagImpl.ts';
import { EventBusImpl } from './EventBusImpl.ts';

export const RUNTIME_VERSION = '0.1.0';

/** Global QA hook. Stable, read-only, and safe to leave in production builds. */
export const RUNTIME_GLOBAL_KEY = '__SW2D__';

export interface CreateGameOptions {
  readonly definition: GameDefinition;
  readonly content: ContentSource;
  /** Element (or selector) the canvas mounts into. */
  readonly parent: HTMLElement | string;
  /** DOM subtree scanned for `data-sw2d-action` controls. Defaults to document.body. */
  readonly controlsRoot?: HTMLElement;
  /** System packs available for installation. A game installs a subset by id. */
  readonly packs?: readonly ScenePackDefinition[];
  /**
   * Enforces every selected pack's declared `configSchemaId` before that pack
   * installs. Dependency-inverted (ADR-0010): pass `packConfigValidator` from
   * `@sw2d/schemas`, or any other implementation - the runtime never imports a
   * schema library itself.
   *
   * Optional for backward compatibility, but a generated game should supply
   * one: without it a declared `configSchemaId` is silently unenforced. A
   * debug build warns when that is the case (ADR-0013).
   */
  readonly packConfigValidator?: PackConfigValidator;
  /**
   * Config supplied from code, keyed by pack id, for packs that declare
   * `configSource: 'code'` - config that carries functions or other live
   * values and therefore cannot travel through the game definition's JSON
   * `systemPacks[].config`. `sw2d.puzzle` is the one such pack today
   * (`createInitialState`/`isSolved`).
   *
   * This is deliberately *not* a general escape hatch for JSON-configurable
   * packs: `SystemHostImpl` consults this map only for a pack whose definition
   * declares `configSource: 'code'`, so a JSON pack's configuration stays
   * where content authors can reach it (ADR-0015's schema/runtime boundary).
   */
  readonly packConfig?: Readonly<Record<string, unknown>>;
  /** Game-specific extensions. The only sanctioned way to add unique mechanics. */
  readonly extensions?: readonly GameExtension[];
  /** Enables development-only diagnostics. Defaults to import.meta.env.DEV. */
  readonly debug?: boolean;
  /** Override persistence (tests, or an environment with no localStorage). */
  readonly storage?: StorageDriver;
}

export interface GameRuntime extends Disposable {
  readonly context: GameContext;
  readonly phaser: Phaser.Game;
  snapshot(): DebugSnapshot;
}

/**
 * Boot one game.
 *
 * Everything the runtime owns is constructed here, wired through a single
 * GameContext, and released by a single dispose(). No module-level mutable
 * state exists anywhere in the runtime, so two games can coexist on one page and
 * a torn-down game leaves nothing behind.
 */
export async function createGame(options: CreateGameOptions): Promise<GameRuntime> {
  const definition = options.definition;
  const debugEnabled = options.debug ?? Boolean(import.meta.env?.DEV);
  const rootBag = new DisposableBagImpl('game-runtime');

  const events = new EventBusImpl();
  const storage = options.storage ?? new LocalStorageDriver();
  const saves = new SaveStoreImpl(definition.id, storage);
  const settings = new SettingsStoreImpl(saves, events, definition.defaultSettings ?? {});
  const accessibility = new AccessibilityStateImpl(settings);
  const audio = rootBag.add(new WebAudioBus());
  const capabilities = new CapabilityRegistryImpl();
  const router = new SceneRouterImpl(events);
  const input = rootBag.add(new ActionInputHost(mergeBindings(definition.bindings)));

  const content: ContentBundle = await options.content.load();
  const assets = new AssetCatalogImpl(content.assets);

  let playScene: PlayScene | null = null;

  const debug = new DebugStateImpl(
    {
      gameId: definition.id,
      runtimeVersion: RUNTIME_VERSION,
      scene: () => router.current,
      paused: () => router.paused,
      runIndex: () => router.runIndex,
      fps: () => game.loop.actualFps,
      actions: () => input.values(),
      installedPacks: () => playScene?.installedPackIds ?? [],
      capabilities: () => capabilities.list(),
      listeners: () => ({
        ...events.listenerCounts(),
        'input.adapters': input.adapterCount,
        'context.disposables': rootBag.size,
        'scene.disposables': playScene?.sceneDisposableCount ?? 0,
      }),
      settings: () => settings.get(),
      accessibility: () => accessibility.toJSON(),
      audioUnlock: () => audio.unlockState,
    },
    debugEnabled,
  );

  const context: GameContext = {
    gameId: definition.id,
    definition,
    events,
    input,
    settings,
    saves,
    audio,
    accessibility,
    assets,
    content,
    capabilities,
    router,
    debug,
    disposables: rootBag,
  };

  if (debugEnabled && !options.packConfigValidator) {
    const unenforced = (options.packs ?? [])
      .filter((pack) => pack.configSchemaId)
      .map((pack) => pack.id);
    if (unenforced.length > 0) {
      console.warn(
        `[sw2d] no packConfigValidator supplied: configSchemaId is declared but NOT enforced for ${unenforced.join(', ')}. ` +
          "Pass createGame({ packConfigValidator }) - `@sw2d/schemas` exports one.",
      );
    }
  }

  const boot = new BootScene(context);
  const title = new TitleScene(context);
  const play = new PlayScene(context, options.packs ?? [], options.packConfigValidator, options.packConfig);
  const pause = new PauseScene(context);
  playScene = play;

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: options.parent,
    width: definition.viewport.width,
    height: definition.viewport.height,
    backgroundColor: RUNTIME_UI.background,
    // Mobile play is a baseline requirement, so scaling is configured here rather
    // than being each game's problem.
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    physics: { default: 'arcade', arcade: { gravity: { x: 0, y: 0 }, debug: false } },
    // Phaser's own keyboard capture is disabled: the semantic input layer is the
    // single reader of physical input, so nothing can consume a key twice.
    input: { keyboard: false },
    scene: [boot, title, play, pause],
  });
  router.attach(game);

  // Phaser.Scale.FIT measures `options.parent`'s box synchronously during
  // `new Phaser.Game(...)`, above - before the browser has finished laying
  // out the canvas it just inserted alongside its `#touch-controls` sibling.
  // When `parent` is a flex/grid item sized by its own layout (this
  // runtime's real index.html, not a `parent: document.body` fill-the-window
  // setup), that first measurement can be taken before the parent's true,
  // settled size exists, producing a canvas sized/centered for the wrong
  // box (observed: off-screen top clipping in a short landscape viewport,
  // self-correcting only once *something else* triggered a `resize` event).
  // One `refresh()` after the browser's next paint re-measures the same
  // parent once its layout is guaranteed final - cheap, idempotent, and
  // exactly what `ScaleManager.refresh()` exists for.
  requestAnimationFrame(() => game.scale.refresh());

  input.addAdapter(new KeyboardAdapter(input));
  input.addAdapter(new PointerAdapter(input, options.controlsRoot ?? document.body));

  // One input advance per game step, before any scene update. Two scenes reading
  // `justPressed` in the same frame therefore always agree.
  const advanceInput = (): void => input.update();
  game.events.on(Phaser.Core.Events.PRE_STEP, advanceInput);
  rootBag.addFn(() => game.events.off(Phaser.Core.Events.PRE_STEP, advanceInput));

  rootBag.add(
    events.on('settings:changed', () => {
      audio.applySettings(settings.get());
      events.emit('accessibility:changed', {});
    }),
  );
  audio.applySettings(settings.get());

  // The accessibility projection is derived at read time, so a settings write
  // already re-projects it live - but the OS-level half of that projection
  // (prefers-reduced-motion, pointer: coarse) can change while the tab stays
  // open, with no settings write to trigger a re-read. matchMedia's own
  // change event is the natural, non-polling signal for that (Phase 6's
  // theme/UI layer is the first real consumer of AccessibilityStateImpl's
  // previously-unwired refreshEnvironment()). Guarded like
  // readAccessibilityEnvironment() itself: environments without matchMedia
  // (Vitest's Node environment, older browsers) simply get no listener.
  const mediaQueries = [
    globalThis.matchMedia?.('(prefers-reduced-motion: reduce)'),
    globalThis.matchMedia?.('(pointer: coarse)'),
  ].filter((query): query is MediaQueryList => query !== undefined);
  const onEnvironmentChange = (): void => {
    accessibility.refreshEnvironment();
    events.emit('accessibility:changed', {});
  };
  for (const query of mediaQueries) query.addEventListener('change', onEnvironmentChange);
  rootBag.addFn(() => {
    for (const query of mediaQueries) query.removeEventListener('change', onEnvironmentChange);
  });

  // Web Audio must be created inside a real user gesture; nothing is assumed
  // about autoplay. The listener removes itself once unlocked.
  const unlockAudio = (): void => {
    audio.unlock();
    if (audio.unlockState !== 'locked') {
      window.removeEventListener('pointerdown', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
      events.emit('audio:unlocked', {});
    }
  };
  window.addEventListener('pointerdown', unlockAudio);
  window.addEventListener('keydown', unlockAudio);
  rootBag.addFn(() => {
    window.removeEventListener('pointerdown', unlockAudio);
    window.removeEventListener('keydown', unlockAudio);
  });

  // A hidden tab must not keep punishing the player. Held keys are cleared too,
  // because the browser will not deliver the keyup.
  const onVisibilityChange = (): void => {
    if (document.visibilityState !== 'hidden') return;
    input.clear();
    router.setPaused(true);
  };
  document.addEventListener('visibilitychange', onVisibilityChange);
  rootBag.addFn(() => document.removeEventListener('visibilitychange', onVisibilityChange));

  for (const extension of options.extensions ?? []) extension.setup(context);

  const runtime: GameRuntime = {
    context,
    phaser: game,
    snapshot: () => debug.snapshot(),
    dispose: () => {
      rootBag.dispose();
      game.destroy(true);
      const host = globalThis as Record<string, unknown>;
      if (host[RUNTIME_GLOBAL_KEY] === runtime) delete host[RUNTIME_GLOBAL_KEY];
    },
  };

  (globalThis as Record<string, unknown>)[RUNTIME_GLOBAL_KEY] = runtime;
  return runtime;
}
