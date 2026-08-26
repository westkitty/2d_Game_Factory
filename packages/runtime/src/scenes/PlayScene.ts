import Phaser from 'phaser';
import {
  DEFAULT_UI_COPY,
  SCENE_KEYS,
  type GameContext,
  type PackConfigValidator,
  type UiCopy,
} from '@sw2d/contracts';
import { DisposableBagImpl } from '../core/DisposableBagImpl.ts';
import { SystemHostImpl } from '../core/SystemHostImpl.ts';
import { type SceneContext, type ScenePackDefinition, createSceneContext } from './SceneContext.ts';
import { RUNTIME_UI, mutedStyle } from './theme.ts';

/**
 * The gameplay frame.
 *
 * PlayScene owns no gameplay of its own. It establishes the world, installs the
 * system packs the game selected, forwards the frame step, and tears everything
 * down on shutdown. Actual mechanics live in packs and in game-specific code -
 * which is the boundary that stops this file from growing into a monolith.
 */
export class PlayScene extends Phaser.Scene {
  readonly #context: GameContext;
  readonly #packs: readonly ScenePackDefinition[];
  readonly #packConfigValidator: PackConfigValidator | undefined;
  /** Code-supplied config for `configSource: 'code'` packs - see CreateGameOptions.packConfig. */
  readonly #packConfig: Readonly<Record<string, unknown>> | undefined;
  #bag = new DisposableBagImpl('play-scene');
  #host: SystemHostImpl<SceneContext> | null = null;

  constructor(
    context: GameContext,
    packs: readonly ScenePackDefinition[],
    packConfigValidator?: PackConfigValidator,
    packConfig?: Readonly<Record<string, unknown>>,
  ) {
    super(SCENE_KEYS.play);
    this.#context = context;
    this.#packs = packs;
    this.#packConfigValidator = packConfigValidator;
    this.#packConfig = packConfig;
  }

  /** Live pack ids, read by the debug snapshot. */
  get installedPackIds(): readonly string[] {
    return this.#host?.installed.map((pack) => pack.id) ?? [];
  }

  /** Live scene-scoped disposable count. A rising value across restarts is a leak. */
  get sceneDisposableCount(): number {
    return this.#bag.disposed ? 0 : this.#bag.size;
  }

  create(): void {
    this.#bag = new DisposableBagImpl('play-scene');
    const copy: UiCopy = { ...DEFAULT_UI_COPY, ...this.#context.content.ui };
    const { width, height } = this.#context.definition.viewport;

    this.cameras.main.setBackgroundColor(RUNTIME_UI.background);
    this.physics.world.setBounds(0, 0, width, height);
    this.cameras.main.setBounds(0, 0, width, height);

    this.add.text(12, 10, copy.playHint, mutedStyle(13)).setScrollFactor(0).setDepth(1000);

    const sceneContext = createSceneContext(this.#context, this, this.#bag);
    const host = new SystemHostImpl<SceneContext>(sceneContext, this.#packs, this.#packConfigValidator, this.#packConfig);
    this.#host = host;
    this.#bag.add(host);
    host.install(this.#context.definition.systemPacks);

    // A single shutdown handler owns all teardown. Registering it with `once`
    // and rebuilding the bag in create() is what keeps restart from accumulating
    // packs, listeners or debug contributions.
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.#host = null;
      this.#bag.dispose();
    });
  }

  override update(_time: number, delta: number): void {
    if (this.#context.input.consumePress('PAUSE')) {
      this.#context.audio.playCue('game.pause');
      this.#context.router.setPaused(true);
      return;
    }
    this.#host?.update(delta);
  }
}
